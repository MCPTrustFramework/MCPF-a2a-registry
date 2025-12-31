import pool from "./db.js";

function rowToPolicy(row) {
  return {
    id: row.id,
    fromAgent: row.from_agent,
    toAgent: row.to_agent,
    allowedActions: row.allowed_actions,
    constraints: row.constraints,
    status: row.status,
    issuedBy: row.issued_by,
    validFrom: row.valid_from,
    validUntil: row.valid_until,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    revokedAt: row.revoked_at,
    revocationReason: row.revocation_reason
  };
}

export async function checkDelegation(fromDid, toDid, action = null) {
  // Find active policy matching from/to
  const { rows } = await pool.query(
    `SELECT * FROM a2a_policies 
     WHERE from_agent = $1 
       AND to_agent = $2 
       AND status = 'active'
       AND (valid_from IS NULL OR valid_from <= now())
       AND (valid_until IS NULL OR valid_until >= now())
     LIMIT 1`,
    [fromDid, toDid]
  );

  if (rows.length === 0) {
    // Log denial
    await logAudit(fromDid, toDid, action, 'denied', null, {
      reason: 'No active policy found'
    });
    
    return {
      allowed: false,
      reason: "No active delegation policy found"
    };
  }

  const policy = rowToPolicy(rows[0]);

  // Check if action is allowed (if action specified)
  if (action && !policy.allowedActions.includes(action)) {
    await logAudit(fromDid, toDid, action, 'denied', policy.id, {
      reason: 'Action not in allowed list'
    });
    
    return {
      allowed: false,
      reason: `Action '${action}' not in allowed actions`,
      policy: policy
    };
  }

  // TODO: Check additional constraints (time, scope, etc.)
  const constraintsValid = validateConstraints(policy.constraints);
  
  if (!constraintsValid.valid) {
    await logAudit(fromDid, toDid, action, 'denied', policy.id, {
      reason: constraintsValid.reason
    });
    
    return {
      allowed: false,
      reason: constraintsValid.reason,
      policy: policy
    };
  }

  // Log approval
  await logAudit(fromDid, toDid, action, 'allowed', policy.id, {});

  return {
    allowed: true,
    policy: policy
  };
}

function validateConstraints(constraints) {
  // TODO: Implement constraint validation
  // - Check maxDuration
  // - Check allowedDays/allowedHours
  // - Check scope
  // - Check custom conditions
  
  return { valid: true };
}

export async function listPolicies(page = 1, limit = 50) {
  const offset = (page - 1) * limit;

  const [{ rows }, countResult] = await Promise.all([
    pool.query(
      "SELECT * FROM a2a_policies ORDER BY created_at DESC LIMIT $1 OFFSET $2",
      [limit, offset]
    ),
    pool.query("SELECT COUNT(*) AS total FROM a2a_policies")
  ]);

  const total = Number(countResult.rows?.[0]?.total || 0);

  return {
    page,
    limit,
    total,
    items: rows.map(rowToPolicy)
  };
}

export async function getPoliciesFrom(fromDid) {
  const { rows } = await pool.query(
    "SELECT * FROM a2a_policies WHERE from_agent = $1 ORDER BY created_at DESC",
    [fromDid]
  );
  
  return rows.map(rowToPolicy);
}

export async function getPoliciesTo(toDid) {
  const { rows } = await pool.query(
    "SELECT * FROM a2a_policies WHERE to_agent = $1 ORDER BY created_at DESC",
    [toDid]
  );
  
  return rows.map(rowToPolicy);
}

export async function registerPolicy(policy) {
  const {
    fromAgent,
    toAgent,
    allowedActions,
    constraints = {},
    issuedBy,
    validFrom,
    validUntil
  } = policy;

  const { rows } = await pool.query(
    `INSERT INTO a2a_policies (
      from_agent, to_agent, allowed_actions, constraints,
      issued_by, valid_from, valid_until
    ) VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $6, $7)
    ON CONFLICT (from_agent, to_agent) DO UPDATE SET
      allowed_actions = EXCLUDED.allowed_actions,
      constraints = EXCLUDED.constraints,
      issued_by = EXCLUDED.issued_by,
      valid_from = EXCLUDED.valid_from,
      valid_until = EXCLUDED.valid_until,
      status = 'active',
      updated_at = now()
    RETURNING id`,
    [
      fromAgent,
      toAgent,
      JSON.stringify(allowedActions),
      JSON.stringify(constraints),
      issuedBy,
      validFrom || null,
      validUntil || null
    ]
  );

  return {
    status: "ok",
    policyId: rows[0].id
  };
}

export async function revokePolicy(policyId, reason = null) {
  const { rows } = await pool.query(
    `UPDATE a2a_policies 
     SET status = 'revoked', 
         revoked_at = now(),
         revocation_reason = $2,
         updated_at = now()
     WHERE id = $1
     RETURNING id`,
    [policyId, reason]
  );

  if (rows.length === 0) {
    return { status: "error", error: "Policy not found" };
  }

  return { status: "ok", policyId: rows[0].id };
}

async function logAudit(fromDid, toDid, action, result, policyId, metadata) {
  await pool.query(
    `INSERT INTO a2a_audit_log (
      from_agent, to_agent, action, result, policy_id, metadata
    ) VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
    [
      fromDid,
      toDid,
      action || 'check',
      result,
      policyId,
      JSON.stringify(metadata)
    ]
  );
}

export async function getAuditLog(filters, page = 1, limit = 100) {
  const offset = (page - 1) * limit;
  const where = [];
  const params = [];

  if (filters.from) {
    params.push(filters.from);
    where.push(`from_agent = $${params.length}`);
  }
  if (filters.to) {
    params.push(filters.to);
    where.push(`to_agent = $${params.length}`);
  }
  if (filters.action) {
    params.push(filters.action);
    where.push(`action = $${params.length}`);
  }
  if (filters.startDate) {
    params.push(filters.startDate);
    where.push(`timestamp >= $${params.length}`);
  }
  if (filters.endDate) {
    params.push(filters.endDate);
    where.push(`timestamp <= $${params.length}`);
  }

  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  
  params.push(limit, offset);
  const { rows } = await pool.query(
    `SELECT * FROM a2a_audit_log ${whereClause} 
     ORDER BY timestamp DESC 
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return rows.map(row => ({
    id: row.id,
    timestamp: row.timestamp,
    fromAgent: row.from_agent,
    toAgent: row.to_agent,
    action: row.action,
    result: row.result,
    policyId: row.policy_id,
    metadata: row.metadata
  }));
}
