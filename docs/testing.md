# Testing Report

> [Back to README](../README.md)

This document covers the full testing approach for the ACME Project Management Platform, including methodology, results, and honest notes on coverage gaps.

---

## Summary

| Test Type | Tool | Tests | Passed | Failed |
|---|---|---|---|---|
| Backend Unit Tests | pytest | 73 | 73 | 0 |
| API Integration Tests | curl + bash | 29 | 29 | 0 |
| Performance Tests | Artillery | 975 requests | 975 | 0 |
| Frontend Component Tests | Jest + RTL | Planned | | |

---

## Backend Unit Tests

**Tool:** pytest 9.1.1  
**Location:** `backend/tests/`  
**Command:**
```sh
cd backend && python3.14 -m pytest tests/ -v
```

**Result:** 73 passed, 0 failed in 1.25 seconds

### What is tested

Each service has its own test file. Tests target pure logic functions that have no database dependency and can be executed in isolation with mocked infrastructure.

**test_auth.py** (12 tests)
- JWT encode returns a valid string token
- JWT decode returns correct payload fields (sub, email, role)
- JWT sub is stored as string per PyJWT 2.x requirement
- Invalid token raises InvalidTokenError
- Bearer token extraction from event headers
- Missing token returns None
- Role hierarchy ordering (admin > manager > contributor > viewer)
- require_auth decorator returns 401 when token is missing
- require_auth decorator returns 403 when role is insufficient
- require_auth decorator passes through when role is sufficient
- Response helper formats statusCode, headers, and body correctly
- Response helper handles error payloads

**test_auth_service.py** (9 tests)
- Empty email rejected
- Malformed email rejected
- Email with no domain rejected
- Valid email accepted
- Valid email with subdomain accepted
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
- Circular dependency: deliverable depending on itself
- Circular dependency: direct two-node chain (A depends on B, try to make B depend on A)
- Circular dependency: three-node chain (A depends on B depends on C, try to make A depend on C)
- No circular dependency: new independent deliverable
- Title required on create
- project_id required on create
- Valid deliverable passes validation
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
- Percentage over 100 rejected with message referencing 100
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
- eligible-users path detection from URL string
- Numeric ID extracted from path
- eligible-users path returns None (not parsed as integer)
- Empty path returns None

**test_users.py** (6 tests)
- Valid numeric ID extracted from path
- Empty path returns None
- Viewer role rejected from list_users (403)
- Admin role allowed through list_users (200)
- Admin cannot delete their own account (400)
- Path with no ID returns None

### Key design decisions for tests

**Module isolation:** Each service has its own `function.py` but they all share the same module name. Python caches modules by name, so importing `function` in one test file would contaminate subsequent test files. Each test file uses an `autouse` fixture that inserts the correct service directory into `sys.path`, imports the module, and removes it from the cache after the test completes.

**No database required:** All tests mock `init_schema` to prevent the module-level schema initialization from attempting a real database connection. Functions that interact with the database are tested at the integration level instead.

---

## API Integration Tests

**Tool:** bash + curl + jq  
**Location:** `scripts/test.sh`  
**Command:**
```sh
./scripts/test.sh https://d2wqugjglyrwvr.cloudfront.net/api
```

**Result:** 29 passed, 0 failed

These tests run against the live production deployment and verify real end-to-end behavior including database writes, JWT validation, and business rule enforcement.

### Test coverage by service

**Auth Service (4 tests)**
- Register a new user returns token and user object
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
- Warning message is present in response body
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
npx artillery run scripts/artillery.yml --output scripts/artillery-report.json
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

The median response time of 18ms reflects warm Lambda performance, which is the expected state during a live session. The high p95 and p99 values (4-5 seconds) are Lambda cold starts triggered when a container has been idle. This is a known characteristic of serverless deployment and not a code-level performance issue.

To avoid cold start delays during a presentation or demo, run the warm-up script a few minutes before:

```sh
curl -s https://d2wqugjglyrwvr.cloudfront.net/api/auth-service/health > /dev/null
curl -s https://d2wqugjglyrwvr.cloudfront.net/api/projects-service > /dev/null
curl -s https://d2wqugjglyrwvr.cloudfront.net/api/deliverables-service > /dev/null
curl -s https://d2wqugjglyrwvr.cloudfront.net/api/resources-service > /dev/null
curl -s https://d2wqugjglyrwvr.cloudfront.net/api/allocations-service > /dev/null
```

Lambda containers stay warm for approximately 15 minutes after the last request.

---

## Frontend Component Tests

Frontend component tests using Jest and React Testing Library are planned but not yet implemented. The following areas are scoped for coverage:

**Form validation logic**
- LoginContent: email format validation, password required
- RegisterContent: password strength rules, role selection
- ProjectForm: date range validation, budget field validation
- DeliverableForm: due date against project dates, circular dependency check
- AllocationForm: duplicate project detection, percentage cap

**Component behavior**
- StatusBadge renders correct label and color for each status value
- RoleGuard hides or shows content based on current user role
- DependencyChain renders tree structure and blocked indicators correctly
- ProjectCard displays over-budget chip when consumption exceeds planned

**API interaction**
- Axios interceptor attaches Authorization header
- 401 response triggers logout and redirect except for auth endpoints

These tests will be added to `frontend/src/__tests__/` and run with:

```sh
cd frontend && npm test
```

Results will be updated in this document once implemented.

---

## Running All Tests

```sh
# Backend unit tests
cd backend && python3.14 -m pytest tests/ -v 2>&1 | tee scripts/pytest-results.txt && cd ..

# Integration tests (requires production to be running)
./scripts/test.sh https://d2wqugjglyrwvr.cloudfront.net/api 2>&1 | tee scripts/integration-test-results.txt

# Performance tests
npx artillery run scripts/artillery.yml --output scripts/artillery-report.json
```