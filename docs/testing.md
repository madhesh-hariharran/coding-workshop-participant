# Testing Report

> [Back to README](../README.md)

This document covers the full testing approach for the ACME Project Management Platform, including methodology, results, and honest notes on coverage.

---

## Summary

| Test Type | Tool | Tests | Passed | Failed |
|---|---|---|---|---|
| Backend Unit Tests | pytest | 73 | 73 | 0 |
| Frontend Unit and Component Tests | Jest + RTL | 77 | 77 | 0 |
| API Integration Tests | curl + bash | 29 | 29 | 0 |
| Performance Tests | Artillery | 975 requests | 975 | 0 |

**Total: 179 tests, 0 failures**

---

## Backend Unit Tests

**Tool:** pytest 9.1.1
**Location:** `backend/tests/`
**Command:**
```sh
cd backend && python3.14 -m pytest tests/ -v 2>&1 | tee ../scripts/pytest-results.txt
```

**Result:** 73 passed, 0 failed in 1.25 seconds

### What is tested

**test_auth.py** (12 tests)
- JWT encode returns a valid string token
- JWT decode returns correct payload (sub, email, role)
- JWT sub is stored as string per PyJWT 2.x requirement
- Invalid token raises InvalidTokenError
- Bearer token extraction from Authorization header
- Missing token returns None
- Role hierarchy: admin > manager > contributor > viewer
- require_auth returns 401 when token is missing
- require_auth returns 403 when role is insufficient
- require_auth passes through when role is sufficient
- Response helper formats statusCode, headers, and body
- Response helper handles error payloads

**test_auth_service.py** (9 tests)
- Empty email rejected
- Malformed email rejected
- Email with no domain rejected
- Valid email accepted
- Valid subdomain email accepted
- Password below minimum length rejected
- Password with no uppercase rejected
- Password with no digit rejected
- Strong password accepted

**test_projects.py** (11 tests)
- Name required on create
- Name over 255 characters rejected
- All valid statuses accepted (active, at_risk, on_hold, completed)
- Invalid status rejected
- end_date before start_date rejected
- Valid date range accepted
- Negative budget_planned rejected
- Zero budget accepted
- Partial update skips name requirement
- Partial update still validates status
- Path ID extraction from URL

**test_deliverables.py** (12 tests)
- Circular dependency: self reference
- Circular dependency: direct two-node chain
- Circular dependency: three-node chain
- No circular: independent deliverable
- Title required on create
- project_id required on create
- Valid deliverable passes
- Invalid status rejected
- All valid statuses accepted (pending, in_progress, completed)
- Partial update skips required fields
- Title over 255 characters rejected
- Path ID extraction from URL

**test_allocations.py** (14 tests)
- resource_id required
- project_id required
- allocation_percentage required
- Percentage of 0 rejected
- Percentage over 100 rejected
- Percentage of 100 accepted
- Percentage of 1 accepted
- Percentage of 50 accepted
- end_date before start_date rejected
- Valid date range accepted
- Partial update skips required fields
- Partial update still validates percentage
- Non-numeric percentage rejected
- Path ID extraction from URL

**test_resources.py** (9 tests)
- Name required on create
- Name over 255 characters rejected
- Valid name accepted
- Valid resource with all fields accepted
- Partial update skips name requirement
- eligible-users path detection
- Numeric ID extracted from path
- eligible-users path returns None
- Empty path returns None

**test_users.py** (6 tests)
- Valid numeric ID extracted from path
- Empty path returns None
- Viewer role rejected from list_users (403)
- Admin role allowed through list_users (200)
- Admin cannot delete their own account (400)
- Path with no ID returns None

### Key design note

Each service has its own `function.py` sharing the same module name. Python caches modules by name, causing cross-service contamination if not handled. Each test file uses an `autouse` fixture that inserts the correct service path into `sys.path`, imports the module, and clears the cache after every test.

---

## Frontend Unit and Component Tests

**Tool:** Jest 29 + React Testing Library
**Location:** `frontend/src/__tests__/`
**Command:**
```sh
cd frontend && npx jest --no-coverage 2>&1 | tee src/__tests__/jest-results.txt
```

**Result:** 77 passed, 0 failed in 1.996 seconds

### What is tested

**validation.test.js** (35 tests)

Project form validation:
- Name required, name too long, valid name
- end_date before start_date rejected, valid range accepted
- Negative budget rejected, zero budget accepted, non-numeric budget rejected

Deliverable form validation:
- Title required, title too long, valid title
- Due date before project start date rejected
- Due date after project end date rejected
- Due date within project range accepted
- Empty due date accepted

Allocation form validation:
- resource_id, project_id, allocation_percentage all required
- Percentage 0 rejected, over 100 rejected, 100 accepted, 1 accepted
- Non-numeric percentage rejected
- end_date before start_date rejected, valid range accepted

Login form validation:
- Email required, invalid format rejected, valid email accepted
- Password required, non-empty password accepted

Circular dependency detection:
- No circular: new deliverable depending on existing chain
- Direct circular: A depends on B, B tries to depend on A
- Three-chain circular: A→B→C, A tries to depend on C
- Self dependency detected
- Independent deliverable: no cycle

**statusbadge.test.jsx** (7 tests)
- `active` renders as "In Progress"
- `at_risk` renders as "At Risk"
- `on_hold` renders as "On Hold"
- `completed` renders as "Completed"
- `pending` renders as "Pending"
- `in_progress` renders as "In Progress"
- Unknown status renders as-is

**dependencychain.test.js** (9 tests)

Tree building:
- Linear chain produces one root
- Root has correct single child
- Depth-2 node has correct child
- Branching tree: one root with two children
- Root with two shared-parent children renders both
- Two independent deliverables produce two roots

isBlocked logic:
- Node with no depends_on is not blocked
- Node depending on completed node is not blocked
- Node depending on pending node is blocked

**api.test.js** (26 tests)

Auth token handling:
- Request includes Authorization header when token exists
- No header when token is missing
- Token stored correctly on login
- Token removed on logout

API response parsing:
- Error message extracted from response data
- Falls back to default when error field missing
- Falls back to default when response is undefined
- Network error has no response

Auth API request shapes:
- Login body has email and password
- Register body has all required fields
- Role must be one of four valid values

Projects API request shapes:
- Create body has required name field
- Valid project statuses
- Budget fields are numeric
- Date range validation

Allocations API request shapes:
- Create body has required fields
- Percentage 1-100 is valid
- Percentage outside range is invalid
- Over-allocation warning in response body
- Successful allocation has no warning

Deliverables API request shapes:
- Create body has required fields
- Valid deliverable statuses
- depends_on is optional
- Circular dependency error response shape
- Blocked completion error response shape

---

## API Integration Tests

**Tool:** bash + curl + jq
**Location:** `scripts/test.sh`
**Command:**
```sh
./scripts/test.sh https://d2wqugjglyrwvr.cloudfront.net/api 2>&1 | tee scripts/integration-test-results.txt
```

**Result:** 29 passed, 0 failed

These tests run against the live production deployment and verify real end-to-end behavior including database writes, JWT validation, and business rule enforcement.

**Auth Service (4 tests)**
- Register new admin user returns token and user object
- Login with correct credentials returns token
- Login with wrong password returns error
- GET /me without token returns 401

**Projects Service (6 tests)**
- Create project with all fields
- List projects returns non-empty total
- Get project by ID returns correct record
- Update project status
- Filter projects by status
- Reject project with end_date before start_date

**Deliverables Service (5 tests)**
- Create deliverable
- Create deliverable with depends_on
- Reject circular dependency
- Reject marking as completed when dependency is not complete
- Filter deliverables by project_id

**Resources Service (5 tests)**
- Create resource without user link
- Create resource with user_id link
- Reject duplicate user_id link
- GET eligible-users returns list
- List resources returns total

**Allocations Service (6 tests)**
- Create allocation
- Allow over-allocation with warning message
- Warning message present in response body
- Reject duplicate allocation to same project
- Reject allocation to completed project
- List allocations returns over_allocated_resources field

**Users Service (2 tests)**
- Admin can list users
- Viewer cannot list users (403)

---

## Performance Tests

**Tool:** Artillery 2.0.33
**Location:** `scripts/artillery.yml`
**Command:**
```sh
npx artillery run scripts/artillery.yml --output scripts/artillery-report.json 2>&1 | tee scripts/performance-test-results.txt
```

**Configuration:**
- Phase 1: Warm up, 30 seconds, 2 virtual users per second
- Phase 2: Load test, 30 seconds, 5 virtual users per second
- Two scenarios: Auth and read flow (60% weight), Dashboard data load (40% weight)

**Results:**

| Metric | Value |
|---|---|
| Total requests | 975 |
| HTTP 200 responses | 975 |
| Failed users | 0 |
| Min response time | 12ms |
| Median response time | 18ms |
| Mean response time | 949ms |
| p95 response time | 4316ms |
| p99 response time | 4867ms |
| Peak request rate | 15 requests/sec |

**Interpretation:**

The median response time of 18ms reflects warm Lambda performance. The high p95 and p99 values are Lambda cold starts triggered when a container has been idle — a known characteristic of serverless architecture, not a code-level performance issue.

To avoid cold start delays during a demo, run the warm-up script a few minutes before presenting:

```sh
curl -s https://d2wqugjglyrwvr.cloudfront.net/api/auth-service/health > /dev/null
curl -s https://d2wqugjglyrwvr.cloudfront.net/api/projects-service > /dev/null
curl -s https://d2wqugjglyrwvr.cloudfront.net/api/deliverables-service > /dev/null
curl -s https://d2wqugjglyrwvr.cloudfront.net/api/resources-service > /dev/null
curl -s https://d2wqugjglyrwvr.cloudfront.net/api/allocations-service > /dev/null
```

Lambda containers stay warm for approximately 15 minutes after the last request.

---

## Manual Verification

The following behaviors were verified manually through the UI and confirmed working:

**Completed project allocation exclusion**
When a project status is changed to Completed, the resource total allocation percentage updates immediately to exclude that project. A resource previously showing 120% total (50% on Project A + 70% on Project B) correctly drops to 50% after Project B is marked completed. Verified on the Resources page and Dashboard resource utilization panel.

**Dependency chain branching**
When multiple deliverables share the same parent dependency, the dependency chain tab correctly renders them as branches at the same indentation level rather than a linear chain. Verified with two deliverables both depending on a single root deliverable.

**Demo mode login**
All four demo buttons on the login page successfully authenticate and redirect to the dashboard with the correct role permissions applied. Verified for Admin, Manager, Contributor, and Viewer roles.

---

## What is Not Covered

**E2E tests:** Playwright or Cypress end-to-end tests covering complete user workflows are planned but not yet implemented. The integration test suite covers API behavior end-to-end against production, and manual verification covers UI workflows.

**Frontend component tests with full MUI provider:** Component tests requiring the full Material UI theme provider setup are not included. The current component tests (StatusBadge) cover components that render without provider dependencies.

---

## Running All Tests

```sh
# Backend unit tests
cd backend && python3.14 -m pytest tests/ -v 2>&1 | tee ../scripts/pytest-results.txt && cd ..

# Frontend tests
cd frontend && npx jest --no-coverage 2>&1 | tee src/__tests__/jest-results.txt && cd ..

# Integration tests
./scripts/test.sh https://d2wqugjglyrwvr.cloudfront.net/api 2>&1 | tee scripts/integration-test-results.txt

# Performance tests
npx artillery run scripts/artillery.yml --output scripts/artillery-report.json
```