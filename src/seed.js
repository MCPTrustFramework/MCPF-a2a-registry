import pool from "./db.js";
import * as a2a from "./a2aModel.js";

async function seed() {
  console.log("Seeding A2A Registry with example policies...\n");

  // Example 1: Banking - Fraud detector to risk analyzer
  await a2a.registerPolicy({
    fromAgent: "did:web:fraud-detector.bank.example",
    toAgent: "did:web:risk-analyzer.bank.example",
    allowedActions: ["analyze", "query", "report"],
    constraints: {
      maxDuration: 3600,
      scope: ["transaction-data"],
      requiresApproval: false,
      maxConcurrent: 5
    },
    issuedBy: "did:web:bank.example",
    validFrom: "2025-01-01T00:00:00Z",
    validUntil: "2026-01-01T00:00:00Z"
  });
  console.log("✓ Banking fraud-to-risk policy registered");

  // Example 2: Healthcare - Primary to specialist
  await a2a.registerPolicy({
    fromAgent: "did:web:primary-diagnostics.hospital.example",
    toAgent: "did:web:radiology-specialist.hospital.example",
    allowedActions: ["analyze-xray", "analyze-ct", "generate-report"],
    constraints: {
      maxDuration: 1800,
      scope: ["radiology-images"],
      requiresApproval: true,
      allowedDays: ["Mon","Tue","Wed","Thu","Fri"]
    },
    issuedBy: "did:web:hospital.example",
    validFrom: "2025-01-01T00:00:00Z",
    validUntil: "2025-12-31T23:59:59Z"
  });
  console.log("✓ Healthcare diagnostic policy registered");

  // Example 3: Customer service - L1 to supervisor
  await a2a.registerPolicy({
    fromAgent: "did:web:chatbot-l1.company.example",
    toAgent: "did:web:supervisor-ai.company.example",
    allowedActions: ["escalate", "review", "approve"],
    constraints: {
      maxDuration: 600,
      scope: ["customer-support"],
      requiresApproval: false,
      conditions: {
        minimumSeverity: "medium"
      }
    },
    issuedBy: "did:web:company.example",
    validFrom: "2025-01-01T00:00:00Z"
  });
  console.log("✓ Customer service escalation policy registered");

  console.log("\n✅ Seeding complete!");
  await pool.end();
}

seed().catch(err => {
  console.error("Seed error:", err);
  process.exit(1);
});
