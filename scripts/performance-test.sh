#!/bin/bash

# =============================================================================
# ACME Project Management — Performance Test
# Runs Artillery load test against production deployment.
# =============================================================================

echo "Checking Artillery installation..."
if ! command -v artillery &> /dev/null; then
  echo "Installing Artillery..."
  npm install -g artillery
fi

echo ""
echo "Running performance test against production..."
echo "Phase 1: Warm up (30s, 2 users/sec)"
echo "Phase 2: Load test (30s, 5 users/sec)"
echo ""

artillery run scripts/artillery.yml --output scripts/artillery-report.json

echo ""
echo "Generating HTML report..."
artillery report scripts/artillery-report.json --output scripts/artillery-report.html 2>/dev/null || true

echo ""
echo "Performance test complete."
echo "Results saved to scripts/artillery-report.json"