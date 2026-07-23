#!/bin/bash

# =============================================================================
# ACME Project Management — Integration Test Suite
# Tests all API endpoints against a running environment.
# Usage: ./scripts/test.sh [API_BASE_URL]
# Default: http://localhost:3001/api
# =============================================================================

API="${1:-http://localhost:3001/api}"
PASS=0
FAIL=0
TOTAL=0

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}PASS${NC} $1"; PASS=$((PASS+1)); TOTAL=$((TOTAL+1)); }
fail() { echo -e "${RED}FAIL${NC} $1 — $2"; FAIL=$((FAIL+1)); TOTAL=$((TOTAL+1)); }
section() { echo ""; echo -e "${YELLOW}=== $1 ===${NC}"; }

# ── Setup ──────────────────────────────────────────────────────────────────
section "Setup: Register test user"

TIMESTAMP=$(date +%s)
TEST_EMAIL="testrunner_${TIMESTAMP}@acme.com"

REG=$(curl -s -X POST "$API/auth-service/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Test Runner\",\"email\":\"$TEST_EMAIL\",\"password\":\"Test@1234\",\"role\":\"admin\"}")

TOKEN=$(echo $REG | jq -r '.token // empty')
USER_ID=$(echo $REG | jq -r '.user.id // empty')

if [ -n "$TOKEN" ]; then
  pass "Register new admin user"
else
  fail "Register new admin user" "$(echo $REG | jq -r '.error // "unknown"')"
  echo "Cannot continue without token. Exiting."
  exit 1
fi

# ── Auth Service ───────────────────────────────────────────────────────────
section "Auth Service"

LOGIN=$(curl -s -X POST "$API/auth-service/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"Test@1234\"}")
[ "$(echo $LOGIN | jq -r '.token // empty')" != "" ] && pass "Login with valid credentials" || fail "Login with valid credentials" "$LOGIN"

BAD_LOGIN=$(curl -s -X POST "$API/auth-service/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"wrongpass\"}")
[ "$(echo $BAD_LOGIN | jq -r '.error // empty')" != "" ] && pass "Login rejects wrong password" || fail "Login rejects wrong password" "$BAD_LOGIN"

ME=$(curl -s "$API/auth-service/me" -H "Authorization: Bearer $TOKEN")
[ "$(echo $ME | jq -r '.user.email // empty')" = "$TEST_EMAIL" ] && pass "GET /me returns current user" || fail "GET /me returns current user" "$ME"

NO_AUTH=$(curl -s "$API/auth-service/me")
[ "$(echo $NO_AUTH | jq -r '.error // empty')" != "" ] && pass "Reject request without token" || fail "Reject request without token" "$NO_AUTH"

# ── Projects Service ───────────────────────────────────────────────────────
section "Projects Service"

PROJ=$(curl -s -X POST "$API/projects-service" \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Integration Test Project","status":"active","start_date":"2026-07-01","end_date":"2026-12-31","budget_planned":100000,"budget_consumed":30000}')
PROJ_ID=$(echo $PROJ | jq -r '.project.id // empty')
[ -n "$PROJ_ID" ] && pass "POST /projects-service creates project" || fail "POST /projects-service creates project" "$PROJ"

GET_PROJ=$(curl -s "$API/projects-service" -H "Authorization: Bearer $TOKEN")
[ "$(echo $GET_PROJ | jq -r '.total // 0')" -gt "0" ] && pass "GET /projects-service returns list" || fail "GET /projects-service returns list" "$GET_PROJ"

GET_ONE=$(curl -s "$API/projects-service/$PROJ_ID" -H "Authorization: Bearer $TOKEN")
[ "$(echo $GET_ONE | jq -r '.project.id // empty')" = "$PROJ_ID" ] && pass "GET /projects-service/:id returns project" || fail "GET /projects-service/:id returns project" "$GET_ONE"

UPD=$(curl -s -X PUT "$API/projects-service/$PROJ_ID" \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"status":"at_risk"}')
[ "$(echo $UPD | jq -r '.project.status // empty')" = "at_risk" ] && pass "PUT /projects-service/:id updates status" || fail "PUT /projects-service/:id updates status" "$UPD"

FILT=$(curl -s "$API/projects-service?status=at_risk" -H "Authorization: Bearer $TOKEN")
[ "$(echo $FILT | jq -r '.total // 0')" -gt "0" ] && pass "GET /projects-service?status=at_risk filters correctly" || fail "GET /projects-service?status=at_risk filters" "$FILT"

BAD_DATE=$(curl -s -X POST "$API/projects-service" \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Bad Dates","start_date":"2026-12-31","end_date":"2026-01-01"}')
[ "$(echo $BAD_DATE | jq -r '.error // empty')" != "" ] && pass "Reject project with end_date before start_date" || fail "Reject bad dates" "$BAD_DATE"

# ── Deliverables Service ───────────────────────────────────────────────────
section "Deliverables Service"

DEL_A=$(curl -s -X POST "$API/deliverables-service" \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d "{\"title\":\"Deliverable A\",\"project_id\":$PROJ_ID,\"status\":\"completed\"}")
DEL_A_ID=$(echo $DEL_A | jq -r '.deliverable.id // empty')
[ -n "$DEL_A_ID" ] && pass "POST /deliverables-service creates deliverable" || fail "POST /deliverables-service" "$DEL_A"

DEL_B=$(curl -s -X POST "$API/deliverables-service" \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d "{\"title\":\"Deliverable B\",\"project_id\":$PROJ_ID,\"status\":\"pending\",\"depends_on\":$DEL_A_ID}")
DEL_B_ID=$(echo $DEL_B | jq -r '.deliverable.id // empty')
[ -n "$DEL_B_ID" ] && pass "POST deliverable with depends_on" || fail "POST deliverable with depends_on" "$DEL_B"

CIRC=$(curl -s -X PUT "$API/deliverables-service/$DEL_A_ID" \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d "{\"depends_on\":$DEL_B_ID}")
[ "$(echo $CIRC | jq -r '.error // empty')" != "" ] && pass "Reject circular dependency" || fail "Reject circular dependency" "$CIRC"

BLOCK=$(curl -s -X PUT "$API/deliverables-service/$DEL_B_ID" \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"status":"completed","depends_on":null}')

UPD_B=$(curl -s -X PUT "$API/deliverables-service/$DEL_B_ID" \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"status":"pending"}')

DEL_C=$(curl -s -X POST "$API/deliverables-service" \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d "{\"title\":\"Deliverable C\",\"project_id\":$PROJ_ID,\"status\":\"pending\",\"depends_on\":$DEL_B_ID}")
DEL_C_ID=$(echo $DEL_C | jq -r '.deliverable.id // empty')

BLOCKED=$(curl -s -X PUT "$API/deliverables-service/$DEL_C_ID" \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"status":"completed"}')
[ "$(echo $BLOCKED | jq -r '.error // empty')" != "" ] && pass "Block completion when dependency not complete" || fail "Block completion" "$BLOCKED"

GET_DELS=$(curl -s "$API/deliverables-service?project_id=$PROJ_ID" -H "Authorization: Bearer $TOKEN")
[ "$(echo $GET_DELS | jq -r '.total // 0')" -gt "0" ] && pass "GET /deliverables-service?project_id filters correctly" || fail "GET deliverables by project" "$GET_DELS"

# ── Resources Service ──────────────────────────────────────────────────────
section "Resources Service"

RES=$(curl -s -X POST "$API/resources-service" \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"John Marston","role_title":"Infrastructure Engineer","department":"Engineering"}')
RES_ID=$(echo $RES | jq -r '.resource.id // empty')
[ -n "$RES_ID" ] && pass "POST /resources-service creates resource" || fail "POST /resources-service" "$RES"

LINKED=$(curl -s -X POST "$API/resources-service" \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d "{\"name\":\"Linked Resource\",\"role_title\":\"Engineer\",\"department\":\"Engineering\",\"user_id\":$USER_ID}")
LINKED_ID=$(echo $LINKED | jq -r '.resource.id // empty')
[ -n "$LINKED_ID" ] && pass "POST resource with user_id link" || fail "POST resource with user link" "$LINKED"

DUP_LINK=$(curl -s -X POST "$API/resources-service" \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d "{\"name\":\"Duplicate Link\",\"role_title\":\"Engineer\",\"department\":\"Engineering\",\"user_id\":$USER_ID}")
[ "$(echo $DUP_LINK | jq -r '.error // empty')" != "" ] && pass "Reject duplicate user link" || fail "Reject duplicate user link" "$DUP_LINK"

ELIGIBLE=$(curl -s "$API/resources-service/eligible-users" -H "Authorization: Bearer $TOKEN")
[ "$(echo $ELIGIBLE | jq -r '.users // empty')" != "" ] && pass "GET /resources-service/eligible-users" || fail "GET eligible-users" "$ELIGIBLE"

GET_RES=$(curl -s "$API/resources-service" -H "Authorization: Bearer $TOKEN")
[ "$(echo $GET_RES | jq -r '.total // 0')" -gt "0" ] && pass "GET /resources-service returns list" || fail "GET resources" "$GET_RES"

# ── Allocations Service ────────────────────────────────────────────────────
section "Allocations Service"

ALLOC=$(curl -s -X POST "$API/allocations-service" \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d "{\"resource_id\":$RES_ID,\"project_id\":$PROJ_ID,\"allocation_percentage\":60}")
ALLOC_ID=$(echo $ALLOC | jq -r '.allocation.id // empty')
[ -n "$ALLOC_ID" ] && pass "POST /allocations-service creates allocation" || fail "POST allocation" "$ALLOC"

PROJ2=$(curl -s -X POST "$API/projects-service" \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Second Project","status":"active"}')
PROJ2_ID=$(echo $PROJ2 | jq -r '.project.id // empty')

OVER=$(curl -s -X POST "$API/allocations-service" \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d "{\"resource_id\":$RES_ID,\"project_id\":$PROJ2_ID,\"allocation_percentage\":60}")
WARNING=$(echo $OVER | jq -r '.warning // empty')
[ -n "$ALLOC_ID" ] && [ -n "$(echo $OVER | jq -r '.allocation.id // empty')" ] && pass "Allow over-allocation with warning" || fail "Allow over-allocation" "$OVER"
[ -n "$WARNING" ] && pass "Over-allocation warning message returned" || fail "Over-allocation warning missing" "$OVER"

DUP=$(curl -s -X POST "$API/allocations-service" \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d "{\"resource_id\":$RES_ID,\"project_id\":$PROJ_ID,\"allocation_percentage\":10}")
[ "$(echo $DUP | jq -r '.error // empty')" != "" ] && pass "Reject duplicate allocation same project" || fail "Reject duplicate allocation" "$DUP"

COMP_PROJ=$(curl -s -X POST "$API/projects-service" \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"name":"Completed Project","status":"completed"}')
COMP_ID=$(echo $COMP_PROJ | jq -r '.project.id // empty')

COMP_ALLOC=$(curl -s -X POST "$API/allocations-service" \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d "{\"resource_id\":$RES_ID,\"project_id\":$COMP_ID,\"allocation_percentage\":10}")
[ "$(echo $COMP_ALLOC | jq -r '.error // empty')" != "" ] && pass "Reject allocation to completed project" || fail "Reject completed project allocation" "$COMP_ALLOC"

GET_ALLOC=$(curl -s "$API/allocations-service" -H "Authorization: Bearer $TOKEN")
[ "$(echo $GET_ALLOC | jq -r '.total // 0')" -gt "0" ] && pass "GET /allocations-service returns list with over_allocated_resources" || fail "GET allocations" "$GET_ALLOC"

# ── Users Service ──────────────────────────────────────────────────────────
section "Users Service"

USERS=$(curl -s "$API/users-service" -H "Authorization: Bearer $TOKEN")
[ "$(echo $USERS | jq -r '.total // 0')" -gt "0" ] && pass "GET /users-service returns user list (admin)" || fail "GET users" "$USERS"

VIEWER_REG=$(curl -s -X POST "$API/auth-service/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Viewer\",\"email\":\"viewer_${TIMESTAMP}@acme.com\",\"password\":\"Test@1234\",\"role\":\"viewer\"}")
VIEWER_TOKEN=$(echo $VIEWER_REG | jq -r '.token // empty')

VIEWER_USERS=$(curl -s "$API/users-service" -H "Authorization: Bearer $VIEWER_TOKEN")
[ "$(echo $VIEWER_USERS | jq -r '.error // empty')" != "" ] && pass "Reject non-admin access to users-service" || fail "Reject non-admin users access" "$VIEWER_USERS"

# ── Summary ────────────────────────────────────────────────────────────────
echo ""
echo "================================================================="
echo -e "Results: ${GREEN}$PASS passed${NC} / ${RED}$FAIL failed${NC} / $TOTAL total"
if [ $FAIL -eq 0 ]; then
  echo -e "${GREEN}All tests passed!${NC}"
else
  echo -e "${RED}$FAIL test(s) failed.${NC}"
fi
echo "================================================================="