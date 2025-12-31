#!/bin/bash
# Register A2A delegation policy

curl -X POST http://localhost:4003/a2a/policies \
  -H 'Content-Type: application/json' \
  -d '{
    "fromAgent": "did:web:fraud-detector.bank.example",
    "toAgent": "did:web:risk-analyzer.bank.example",
    "allowedActions": ["analyze", "query", "report"],
    "constraints": {
      "maxDuration": 3600,
      "scope": ["transaction-data"],
      "requiresApproval": false,
      "maxConcurrent": 5
    },
    "issuedBy": "did:web:bank.example",
    "validFrom": "2025-01-01T00:00:00Z",
    "validUntil": "2026-01-01T00:00:00Z"
  }' | jq .

echo ""
echo "Policy registered!"
