import express from "express";
import pool from "./db.js";
import * as a2a from "./a2aModel.js";

const app = express();
app.use(express.json());

// Access log
app.use((req, _res, next) => {
  console.log(new Date().toISOString(), req.method, req.url);
  next();
});

// Ensure schema at boot
async function ensureSchema() {
  const fs = await import("fs/promises");
  const sql = await fs.readFile("./db.sql", "utf8");
  await pool.query(sql);
}
ensureSchema().catch(err => {
  console.error("SCHEMA_INIT_ERROR", err);
  process.exit(1);
});

// Health check
app.get("/health", (_req, res) => res.json({ 
  status: "ok",
  version: process.env.A2A_REGISTRY_VERSION || "1.0.0-alpha",
  time: new Date().toISOString()
}));

// Check delegation permission
app.get("/a2a/check", async (req, res, next) => {
  try {
    const { from, to, action } = req.query;
    
    if (!from || !to) {
      return res.status(400).json({ 
        error: "from and to parameters required" 
      });
    }

    const result = await a2a.checkDelegation(from, to, action);
    return res.json(result);
  } catch (err) {
    next(err);
  }
});

// List all policies with pagination
app.get("/a2a/policies", async (req, res, next) => {
  try {
    const page = parseInt(req.query.page || "1", 10);
    const limit = parseInt(req.query.limit || "50", 10);
    const data = await a2a.listPolicies(page, limit);
    return res.json(data);
  } catch (err) {
    next(err);
  }
});

// Get policies FROM an agent (where agent can delegate FROM)
app.get("/a2a/policies/from/:did", async (req, res, next) => {
  try {
    const fromDid = decodeURIComponent(req.params.did);
    const policies = await a2a.getPoliciesFrom(fromDid);
    return res.json({ policies });
  } catch (err) {
    next(err);
  }
});

// Get policies TO an agent (where others can delegate TO)
app.get("/a2a/policies/to/:did", async (req, res, next) => {
  try {
    const toDid = decodeURIComponent(req.params.did);
    const policies = await a2a.getPoliciesTo(toDid);
    return res.json({ policies });
  } catch (err) {
    next(err);
  }
});

// Register delegation policy
app.post("/a2a/policies", async (req, res, next) => {
  try {
    // TODO: Add authentication (API key / OAuth)
    const policy = req.body || {};
    
    const required = ['fromAgent', 'toAgent', 'allowedActions', 'issuedBy'];
    const missing = required.filter(k => !policy[k]);
    
    if (missing.length) {
      return res.status(400).json({ 
        error: `Missing required fields: ${missing.join(', ')}` 
      });
    }

    const result = await a2a.registerPolicy(policy);
    return res.json(result);
  } catch (err) {
    next(err);
  }
});

// Revoke policy
app.post("/a2a/revoke", async (req, res, next) => {
  try {
    const { policyId, reason } = req.body || {};
    
    if (!policyId) {
      return res.status(400).json({ error: "policyId required" });
    }

    const result = await a2a.revokePolicy(policyId, reason);
    return res.json(result);
  } catch (err) {
    next(err);
  }
});

// Get audit log
app.get("/a2a/audit", async (req, res, next) => {
  try {
    const filters = {
      from: req.query.from,
      to: req.query.to,
      action: req.query.action,
      startDate: req.query.startDate,
      endDate: req.query.endDate
    };
    
    const page = parseInt(req.query.page || "1", 10);
    const limit = parseInt(req.query.limit || "100", 10);
    
    const entries = await a2a.getAuditLog(filters, page, limit);
    return res.json({ entries });
  } catch (err) {
    next(err);
  }
});

// Global error handler
app.use((err, _req, res, _next) => {
  console.error("UNCAUGHT", err);
  res.status(500).json({ error: "internal" });
});

// Start server
const port = Number(process.env.PORT || 4003);
const host = "0.0.0.0";
app.listen(port, host, () => 
  console.log(`A2A Registry listening on http://${host}:${port}`)
);
