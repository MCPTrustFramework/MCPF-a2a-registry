#!/bin/bash
# Check if delegation is allowed

FROM=${1:-"did:web:fraud-detector.bank.example"}
TO=${2:-"did:web:risk-analyzer.bank.example"}
ACTION=${3:-"analyze"}

echo "Checking delegation: $FROM -> $TO (action: $ACTION)"
curl "http://localhost:4003/a2a/check?from=$FROM&to=$TO&action=$ACTION" | jq .
