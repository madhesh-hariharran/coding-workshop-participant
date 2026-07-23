#!/bin/bash

# =============================================================================
# ACME Project Management — Demo Seed Script
# Populates the database with demo users, projects, deliverables,
# resources, and allocations covering all features and edge cases.
# Usage: ./scripts/seed.sh [API_BASE_URL]
# Default API: http://localhost:3001/api
# For production: ./scripts/seed.sh https://your-api-gateway-url/api
# =============================================================================

set -e

API="${1:-http://localhost:3001/api}"
echo "Seeding against: $API"
echo ""

post() {
  local endpoint=$1
  local data=$2
  local token=$3
  if [ -n "$token" ]; then
    curl -s -X POST "$API/$endpoint" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $token" \
      -d "$data"
  else
    curl -s -X POST "$API/$endpoint" \
      -H "Content-Type: application/json" \
      -d "$data"
  fi
}

echo "=== Step 1: Registering demo users ==="

ADMIN_RES=$(post "auth-service/register" '{"name":"Arthur Morgan","email":"arthur.morgan@acme.com","password":"Demo@1234","role":"admin"}')
ADMIN_TOKEN=$(echo $ADMIN_RES | jq -r '.token')
ADMIN_ID=$(echo $ADMIN_RES | jq -r '.user.id')
echo "Admin: Arthur Morgan (RDR2)"

MANAGER_RES=$(post "auth-service/register" '{"name":"Joel Miller","email":"joel.miller@acme.com","password":"Demo@1234","role":"manager"}')
MANAGER_TOKEN=$(echo $MANAGER_RES | jq -r '.token')
MANAGER_ID=$(echo $MANAGER_RES | jq -r '.user.id')
echo "Manager: Joel Miller (The Last of Us)"

CONTRIB_RES=$(post "auth-service/register" '{"name":"Ellie Williams","email":"ellie.williams@acme.com","password":"Demo@1234","role":"contributor"}')
CONTRIB_TOKEN=$(echo $CONTRIB_RES | jq -r '.token')
CONTRIB_ID=$(echo $CONTRIB_RES | jq -r '.user.id')
echo "Contributor: Ellie Williams (The Last of Us)"

VIEWER_RES=$(post "auth-service/register" '{"name":"Kratos Spartan","email":"kratos.spartan@acme.com","password":"Demo@1234","role":"viewer"}')
VIEWER_ID=$(echo $VIEWER_RES | jq -r '.user.id')
echo "Viewer: Kratos Spartan (God of War)"

NIKO_RES=$(post "auth-service/register" '{"name":"Niko Bellic","email":"niko.bellic@acme.com","password":"Demo@1234","role":"contributor"}')
NIKO_ID=$(echo $NIKO_RES | jq -r '.user.id')
echo "Contributor: Niko Bellic (GTA IV)"

TREVOR_RES=$(post "auth-service/register" '{"name":"Trevor Philips","email":"trevor.philips@acme.com","password":"Demo@1234","role":"contributor"}')
TREVOR_ID=$(echo $TREVOR_RES | jq -r '.user.id')
echo "Contributor: Trevor Philips (GTA V)"

DUTCH_RES=$(post "auth-service/register" '{"name":"Dutch van der Linde","email":"dutch.vanderlinde@acme.com","password":"Demo@1234","role":"manager"}')
DUTCH_ID=$(echo $DUTCH_RES | jq -r '.user.id')
echo "Manager: Dutch van der Linde (RDR2)"

echo ""
echo "=== Step 2: Creating projects (all statuses + budget edge cases) ==="

P1_RES=$(post "projects-service" "{\"name\":\"Blackwater Heist\",\"description\":\"Plan and execute the Blackwater ferry job. Coordination across all gang members required.\",\"status\":\"active\",\"start_date\":\"2026-07-01\",\"end_date\":\"2026-09-30\",\"budget_planned\":80000,\"budget_consumed\":24000,\"owner_id\":$MANAGER_ID}" $ADMIN_TOKEN)
P1_ID=$(echo $P1_RES | jq -r '.project.id')
echo "Project 1 (In Progress, 30% budget): Blackwater Heist"

P2_RES=$(post "projects-service" "{\"name\":\"Guarma Extraction\",\"description\":\"Extract the gang from Guarma before the army closes in. Timeline is critical.\",\"status\":\"at_risk\",\"start_date\":\"2026-07-01\",\"end_date\":\"2026-07-31\",\"budget_planned\":50000,\"budget_consumed\":41000,\"owner_id\":$MANAGER_ID}" $ADMIN_TOKEN)
P2_ID=$(echo $P2_RES | jq -r '.project.id')
echo "Project 2 (At Risk, 82% budget): Guarma Extraction"

P3_RES=$(post "projects-service" "{\"name\":\"Liberty City Expansion\",\"description\":\"Expand ACME operations into Liberty City. Budget overrun due to unexpected complications.\",\"status\":\"at_risk\",\"start_date\":\"2026-06-01\",\"end_date\":\"2026-08-31\",\"budget_planned\":60000,\"budget_consumed\":87000,\"owner_id\":$ADMIN_ID}" $ADMIN_TOKEN)
P3_ID=$(echo $P3_RES | jq -r '.project.id')
echo "Project 3 (At Risk, OVER budget 145%): Liberty City Expansion"

P4_RES=$(post "projects-service" "{\"name\":\"Atreus Training Program\",\"description\":\"Comprehensive training program for junior analysts. On hold pending board approval.\",\"status\":\"on_hold\",\"start_date\":\"2026-08-01\",\"end_date\":\"2026-12-31\",\"budget_planned\":35000,\"budget_consumed\":0,\"owner_id\":$MANAGER_ID}" $ADMIN_TOKEN)
P4_ID=$(echo $P4_RES | jq -r '.project.id')
echo "Project 4 (On Hold): Atreus Training Program"

P5_RES=$(post "projects-service" "{\"name\":\"San Andreas Infrastructure\",\"description\":\"Completed infrastructure upgrade across all San Andreas offices. Delivered on time and within budget.\",\"status\":\"completed\",\"start_date\":\"2026-01-01\",\"end_date\":\"2026-06-30\",\"budget_planned\":120000,\"budget_consumed\":98000,\"owner_id\":$ADMIN_ID}" $ADMIN_TOKEN)
P5_ID=$(echo $P5_RES | jq -r '.project.id')
echo "Project 5 (Completed, within budget): San Andreas Infrastructure"

P6_RES=$(post "projects-service" "{\"name\":\"New Austin Railway\",\"description\":\"Railway network expansion across New Austin. Completed with minor budget overrun.\",\"status\":\"completed\",\"start_date\":\"2026-02-01\",\"end_date\":\"2026-05-31\",\"budget_planned\":200000,\"budget_consumed\":215000,\"owner_id\":$MANAGER_ID}" $ADMIN_TOKEN)
P6_ID=$(echo $P6_RES | jq -r '.project.id')
echo "Project 6 (Completed, over budget): New Austin Railway"

P7_RES=$(post "projects-service" "{\"name\":\"Elysium Platform Migration\",\"description\":\"Migrate all legacy systems to the new Elysium cloud platform. Budget TBD.\",\"status\":\"active\",\"start_date\":\"2026-07-15\",\"end_date\":\"2026-10-15\",\"budget_planned\":0,\"budget_consumed\":0,\"owner_id\":$MANAGER_ID}" $ADMIN_TOKEN)
P7_ID=$(echo $P7_RES | jq -r '.project.id')
echo "Project 7 (In Progress, no budget set): Elysium Platform Migration"

echo ""
echo "=== Step 3: Creating deliverables with dependency chains ==="

# Project 1 — full chain A(completed) → B(completed) → C(in_progress) → D(pending/blocked)
D1_RES=$(post "deliverables-service" "{\"project_id\":$P1_ID,\"title\":\"Recruit gang members\",\"description\":\"Identify and onboard all necessary personnel.\",\"status\":\"completed\",\"due_date\":\"2026-07-15\"}" $ADMIN_TOKEN)
D1_ID=$(echo $D1_RES | jq -r '.deliverable.id')

D2_RES=$(post "deliverables-service" "{\"project_id\":$P1_ID,\"title\":\"Scout the ferry route\",\"description\":\"Identify guards, patrol routes, and escape paths.\",\"status\":\"completed\",\"due_date\":\"2026-07-25\",\"depends_on\":$D1_ID}" $ADMIN_TOKEN)
D2_ID=$(echo $D2_RES | jq -r '.deliverable.id')

D3_RES=$(post "deliverables-service" "{\"project_id\":$P1_ID,\"title\":\"Acquire getaway horses\",\"description\":\"Source and prepare horses for the escape route.\",\"status\":\"in_progress\",\"due_date\":\"2026-08-10\",\"depends_on\":$D2_ID}" $ADMIN_TOKEN)
D3_ID=$(echo $D3_RES | jq -r '.deliverable.id')

D4_RES=$(post "deliverables-service" "{\"project_id\":$P1_ID,\"title\":\"Execute the heist\",\"description\":\"Carry out the plan. No mistakes.\",\"status\":\"pending\",\"due_date\":\"2026-09-01\",\"depends_on\":$D3_ID}" $ADMIN_TOKEN)
D4_ID=$(echo $D4_RES | jq -r '.deliverable.id')
echo "Deliverables 1-4: Blackwater Heist chain (completed → completed → in_progress → blocked)"

# Project 2 — upcoming deadlines
TOMORROW=$(date -d "+1 day" +%Y-%m-%d 2>/dev/null || date -v+1d +%Y-%m-%d 2>/dev/null || echo "2026-07-24")
IN7=$(date -d "+7 days" +%Y-%m-%d 2>/dev/null || date -v+7d +%Y-%m-%d 2>/dev/null || echo "2026-07-30")
IN12=$(date -d "+12 days" +%Y-%m-%d 2>/dev/null || date -v+12d +%Y-%m-%d 2>/dev/null || echo "2026-08-04")

D5_RES=$(post "deliverables-service" "{\"project_id\":$P2_ID,\"title\":\"Secure the boat\",\"status\":\"completed\",\"due_date\":\"2026-07-20\"}" $ADMIN_TOKEN)
D5_ID=$(echo $D5_RES | jq -r '.deliverable.id')

D6_RES=$(post "deliverables-service" "{\"project_id\":$P2_ID,\"title\":\"Bribe the harbour master\",\"status\":\"in_progress\",\"due_date\":\"$TOMORROW\",\"depends_on\":$D5_ID}" $ADMIN_TOKEN)
D6_ID=$(echo $D6_RES | jq -r '.deliverable.id')

D7_RES=$(post "deliverables-service" "{\"project_id\":$P2_ID,\"title\":\"Navigate to Annesburg\",\"status\":\"pending\",\"due_date\":\"$IN7\",\"depends_on\":$D6_ID}" $ADMIN_TOKEN)
D7_ID=$(echo $D7_RES | jq -r '.deliverable.id')

D8_RES=$(post "deliverables-service" "{\"project_id\":$P2_ID,\"title\":\"Regroup at Shady Belle\",\"status\":\"pending\",\"due_date\":\"$IN12\",\"depends_on\":$D7_ID}" $ADMIN_TOKEN)
D8_ID=$(echo $D8_RES | jq -r '.deliverable.id')
echo "Deliverables 5-8: Guarma Extraction (upcoming deadlines: tomorrow, 7d, 12d)"

# Project 3
D9_RES=$(post "deliverables-service" "{\"project_id\":$P3_ID,\"title\":\"Establish Roman contacts\",\"status\":\"completed\",\"due_date\":\"2026-06-15\"}" $ADMIN_TOKEN)
D9_ID=$(echo $D9_RES | jq -r '.deliverable.id')

D10_RES=$(post "deliverables-service" "{\"project_id\":$P3_ID,\"title\":\"Set up safe houses\",\"status\":\"in_progress\",\"due_date\":\"2026-07-25\",\"depends_on\":$D9_ID}" $ADMIN_TOKEN)
D10_ID=$(echo $D10_RES | jq -r '.deliverable.id')

D11_RES=$(post "deliverables-service" "{\"project_id\":$P3_ID,\"title\":\"Negotiate with Pegorino family\",\"status\":\"pending\",\"due_date\":\"2026-08-01\",\"depends_on\":$D10_ID}" $ADMIN_TOKEN)
D11_ID=$(echo $D11_RES | jq -r '.deliverable.id')
echo "Deliverables 9-11: Liberty City Expansion"

# Project 5 — all completed
D12_RES=$(post "deliverables-service" "{\"project_id\":$P5_ID,\"title\":\"Network infrastructure audit\",\"status\":\"completed\",\"due_date\":\"2026-02-28\"}" $ADMIN_TOKEN)
D12_ID=$(echo $D12_RES | jq -r '.deliverable.id')

D13_RES=$(post "deliverables-service" "{\"project_id\":$P5_ID,\"title\":\"Hardware procurement\",\"status\":\"completed\",\"due_date\":\"2026-03-31\",\"depends_on\":$D12_ID}" $ADMIN_TOKEN)
D13_ID=$(echo $D13_RES | jq -r '.deliverable.id')

D14_RES=$(post "deliverables-service" "{\"project_id\":$P5_ID,\"title\":\"System rollout and testing\",\"status\":\"completed\",\"due_date\":\"2026-06-15\",\"depends_on\":$D13_ID}" $ADMIN_TOKEN)
D14_ID=$(echo $D14_RES | jq -r '.deliverable.id')
echo "Deliverables 12-14: San Andreas Infrastructure (all completed chain)"

echo ""
echo "=== Step 4: Creating resources ==="

R1_RES=$(post "resources-service" "{\"name\":\"Arthur Morgan\",\"role_title\":\"Lead Strategist\",\"department\":\"Operations\",\"user_id\":$ADMIN_ID}" $ADMIN_TOKEN)
R1_ID=$(echo $R1_RES | jq -r '.resource.id')
echo "Resource: Arthur Morgan (linked to admin)"

R2_RES=$(post "resources-service" "{\"name\":\"Joel Miller\",\"role_title\":\"Project Manager\",\"department\":\"Operations\",\"user_id\":$MANAGER_ID}" $ADMIN_TOKEN)
R2_ID=$(echo $R2_RES | jq -r '.resource.id')
echo "Resource: Joel Miller (linked to manager)"

R3_RES=$(post "resources-service" "{\"name\":\"Ellie Williams\",\"role_title\":\"Senior Engineer\",\"department\":\"Engineering\",\"user_id\":$CONTRIB_ID}" $ADMIN_TOKEN)
R3_ID=$(echo $R3_RES | jq -r '.resource.id')
echo "Resource: Ellie Williams (linked to contributor)"

R4_RES=$(post "resources-service" "{\"name\":\"Niko Bellic\",\"role_title\":\"Field Operative\",\"department\":\"Operations\",\"user_id\":$NIKO_ID}" $ADMIN_TOKEN)
R4_ID=$(echo $R4_RES | jq -r '.resource.id')
echo "Resource: Niko Bellic (linked to contributor)"

R5_RES=$(post "resources-service" "{\"name\":\"Trevor Philips\",\"role_title\":\"Risk Analyst\",\"department\":\"Finance\",\"user_id\":$TREVOR_ID}" $ADMIN_TOKEN)
R5_ID=$(echo $R5_RES | jq -r '.resource.id')
echo "Resource: Trevor Philips (linked to contributor)"

R6_RES=$(post "resources-service" "{\"name\":\"John Marston\",\"role_title\":\"Infrastructure Engineer\",\"department\":\"Engineering\"}" $ADMIN_TOKEN)
R6_ID=$(echo $R6_RES | jq -r '.resource.id')
echo "Resource: John Marston (external — no user link)"

R7_RES=$(post "resources-service" "{\"name\":\"Michael De Santa\",\"role_title\":\"Financial Analyst\",\"department\":\"Finance\"}" $ADMIN_TOKEN)
R7_ID=$(echo $R7_RES | jq -r '.resource.id')
echo "Resource: Michael De Santa (external — no user link)"

R8_RES=$(post "resources-service" "{\"name\":\"Atreus\",\"role_title\":\"Junior Analyst\",\"department\":\"Operations\"}" $ADMIN_TOKEN)
R8_ID=$(echo $R8_RES | jq -r '.resource.id')
echo "Resource: Atreus (external — no user link)"

echo ""
echo "=== Step 5: Creating allocations (normal, over-allocated, edge cases) ==="

post "allocations-service" "{\"resource_id\":$R1_ID,\"project_id\":$P1_ID,\"allocation_percentage\":50,\"start_date\":\"2026-07-01\",\"end_date\":\"2026-09-30\"}" $ADMIN_TOKEN > /dev/null
echo "Arthur Morgan → Blackwater Heist (50%)"

post "allocations-service" "{\"resource_id\":$R2_ID,\"project_id\":$P1_ID,\"allocation_percentage\":60,\"start_date\":\"2026-07-01\",\"end_date\":\"2026-09-30\"}" $ADMIN_TOKEN > /dev/null
echo "Joel Miller → Blackwater Heist (60%)"

post "allocations-service" "{\"resource_id\":$R3_ID,\"project_id\":$P1_ID,\"allocation_percentage\":40,\"start_date\":\"2026-07-01\",\"end_date\":\"2026-09-30\"}" $ADMIN_TOKEN > /dev/null
echo "Ellie Williams → Blackwater Heist (40%)"

post "allocations-service" "{\"resource_id\":$R4_ID,\"project_id\":$P2_ID,\"allocation_percentage\":70,\"start_date\":\"2026-07-01\",\"end_date\":\"2026-07-31\"}" $ADMIN_TOKEN > /dev/null
echo "Niko Bellic → Guarma Extraction (70%)"

post "allocations-service" "{\"resource_id\":$R5_ID,\"project_id\":$P3_ID,\"allocation_percentage\":80,\"start_date\":\"2026-06-01\",\"end_date\":\"2026-08-31\"}" $ADMIN_TOKEN > /dev/null
echo "Trevor Philips → Liberty City Expansion (80%)"

post "allocations-service" "{\"resource_id\":$R6_ID,\"project_id\":$P7_ID,\"allocation_percentage\":100,\"start_date\":\"2026-07-15\",\"end_date\":\"2026-10-15\"}" $ADMIN_TOKEN > /dev/null
echo "John Marston → Elysium Platform Migration (100%)"

post "allocations-service" "{\"resource_id\":$R7_ID,\"project_id\":$P2_ID,\"allocation_percentage\":30}" $ADMIN_TOKEN > /dev/null
echo "Michael De Santa → Guarma Extraction (30%)"

post "allocations-service" "{\"resource_id\":$R8_ID,\"project_id\":$P4_ID,\"allocation_percentage\":25}" $ADMIN_TOKEN > /dev/null
echo "Atreus → Atreus Training Program (25%)"

post "allocations-service" "{\"resource_id\":$R2_ID,\"project_id\":$P7_ID,\"allocation_percentage\":40,\"start_date\":\"2026-07-15\",\"end_date\":\"2026-10-15\"}" $ADMIN_TOKEN > /dev/null
echo "Joel Miller → Elysium Platform Migration (40%) — now at 100% total"

# Over-allocated: Arthur Morgan 50% + 70% = 120%
OVER1=$(post "allocations-service" "{\"resource_id\":$R1_ID,\"project_id\":$P3_ID,\"allocation_percentage\":70,\"start_date\":\"2026-06-01\",\"end_date\":\"2026-08-31\"}" $ADMIN_TOKEN)
echo "Arthur Morgan → Liberty City Expansion (70%) — OVER-ALLOCATED: $(echo $OVER1 | jq -r '.warning // "no warning"')"

# Over-allocated: Ellie Williams 40% + 80% = 120%
OVER2=$(post "allocations-service" "{\"resource_id\":$R3_ID,\"project_id\":$P7_ID,\"allocation_percentage\":80,\"start_date\":\"2026-07-15\",\"end_date\":\"2026-10-15\"}" $ADMIN_TOKEN)
echo "Ellie Williams → Elysium Platform Migration (80%) — OVER-ALLOCATED: $(echo $OVER2 | jq -r '.warning // "no warning"')"

echo ""
echo "==================================================================="
echo "Seed complete. Database is ready for demo."
echo ""
echo "Demo login credentials (use buttons on login page):"
echo "  Admin       — arthur.morgan@acme.com   / Demo@1234"
echo "  Manager     — joel.miller@acme.com     / Demo@1234"
echo "  Contributor — ellie.williams@acme.com  / Demo@1234"
echo "  Viewer      — kratos.spartan@acme.com  / Demo@1234"
echo ""
echo "Demo coverage:"
echo "  Dashboard   — 2 over-allocated resources, 1 over-budget alert, at-risk alert, upcoming deadlines"
echo "  Projects    — 2 In Progress, 2 At Risk, 1 On Hold, 2 Completed"
echo "  Budget      — within budget, 82%, over budget (145%), no budget set"
echo "  Deliverables — full dependency chain with blocked indicators"
echo "  Allocations — normal, 100%, and 2 over-allocated resources"
echo "  Resources   — linked and unlinked accounts"
echo "  Roles       — all 4 roles with different permission levels"
echo "==================================================================="