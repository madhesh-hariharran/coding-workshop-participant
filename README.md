# ACME Project Management Platform

A centralized project management and tracking platform built for ACME Inc. to provide real-time visibility into project health, resource utilization, and delivery progress across departments.

Live deployment: **https://d2wqugjglyrwvr.cloudfront.net**

---

## Business Problem

ACME Inc. manages multiple projects across departments but lacked a unified view of progress, resource allocation, and delivery timelines. Project managers struggled to track deliverables, identify bottlenecks, and communicate status to stakeholders, leading to missed deadlines, resource conflicts, and budget overruns going unnoticed.

This platform answers seven critical business questions:

- What is the current status of each active project?
- Which projects are at risk of missing their deadlines?
- How are resources allocated across projects?
- What are the key deliverables and their completion status?
- Which team members are over-allocated across multiple projects?
- What is the dependency chain between deliverables?
- How much budget has been consumed versus planned for each project?

---

## Development Philosophy

The priority throughout was building something that works the way a project manager would actually expect it to, rather than something that looks impressive in a screenshot. Every interaction follows a predictable pattern. Forms validate as you type. Errors appear next to the field that caused them. Role-based access adapts the interface without making it confusing for lower-permission users.

The dependency chain visualization was chosen deliberately because it directly answers one of the seven core business questions and gives any user a clear picture of what is blocking progress and why. The dashboard was designed so that someone unfamiliar with the system could look at it for ten seconds and know which projects need attention.

Edge cases are handled as first-class concerns rather than afterthoughts. Over-allocation is allowed with a visible warning rather than silently blocked, because managers need the full picture before deciding what to do. Circular dependencies are caught on both the backend and in the form before any API call is made. Completed projects cannot receive new allocations. Resource utilization automatically excludes allocations from completed projects, so freed-up capacity is reflected immediately.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Material UI v9 |
| Backend | Python 3.13, AWS Lambda (microservices) |
| Database | PostgreSQL via psycopg3 (Aurora RDS) |
| Infrastructure | Terraform, AWS S3, CloudFront, Lambda URLs |
| Auth | JWT (PyJWT), bcrypt |
| Version Control | Git, GitHub |

---

## Architecture

The backend follows a microservices pattern where each domain (auth, projects, deliverables, resources, allocations, users) is an independent Lambda function with its own deployment package. Shared utilities live in `backend/_shared/` and are copied into each service at deploy time, ensuring Lambda isolation without cross-function dependencies.

The frontend follows a thin page wrapper pattern. Each route has a lightweight page component that renders a Content component where all business logic lives. This separation keeps pages clean and makes the logic independently testable.

```
frontend/
  src/
    api/           Axios client and per-service API modules
    context/       Auth context split into 3 files for Vite fast-refresh compliance
    components/    Feature-grouped Content components
    pages/         Thin route wrappers
    theme/         Light and dark MUI themes

backend/
  _shared/         db.py, auth.py, requirements.txt (copied per service)
  auth-service/
  projects-service/
  deliverables-service/
  resources-service/
  allocations-service/
  users-service/
```

---

## Features

### Authentication and Authorization
- JWT-based authentication with bcrypt password hashing
- Four roles with strict hierarchy: Admin, Manager, Contributor, Viewer
- Role enforcement at both the API layer via a decorator and the UI layer via a RoleGuard component
- Password strength validation on registration with live character-by-character feedback

### Projects
- Full CRUD with status tracking across In Progress, At Risk, On Hold, and Completed
- Budget tracking showing consumed vs planned with color-coded progress bars
- Two-section layout separating active and completed projects
- Status and budget filters that apply automatically when navigated from dashboard alerts
- Inline field editing on the project detail page without opening a modal

### Deliverables
- Full CRUD scoped to projects with dynamic date range validation against project start and end dates
- Dependency tracking via a depends-on relationship
- Circular dependency detection on both the backend and in the form before submission
- Blocked completion enforcement: a deliverable cannot be marked complete if its dependency is not finished
- Dependency chain visualization as an interactive tree in the project detail tabs, with blocked indicators where relevant

### Resources
- Team member tracking with optional user account linking scoped to the same email domain
- Total allocation percentage aggregated across active projects only, so completed project allocations do not inflate utilization figures
- Over-allocation flagged visually on the resources page, allocations page, and dashboard

### Allocations
- Resource-to-project allocation with percentage tracking per project (max 100% per individual allocation)
- Over-allocation across projects allowed with a warning rather than a hard block
- Allocation blocked for completed projects and projects past their end date
- Duplicate project selection prevented with dynamic inline validation before submission

### Dashboard
- Two-tier project health donut chart: outer ring for Active vs Completed, inner ring for In Progress, At Risk, On Hold breakdown
- Upcoming deadline tracker for deliverables due within the next 14 days
- Budget health section with per-project consumption bars
- Resource utilization with over-allocation indicators
- Alerts for at-risk projects, over-budget projects, and over-allocated resources with one-click navigation to filtered views

---

## Database Schema

```
users           id, name, email, password, role, created_at
projects        id, name, description, status, start_date, end_date,
                budget_planned, budget_consumed, owner_id, created_at, updated_at
deliverables    id, project_id, title, description, status, due_date,
                assignee_id, depends_on, created_at, updated_at
resources       id, user_id (optional), name, role_title, department, created_at
allocations     id, resource_id, project_id, allocation_percentage,
                start_date, end_date, created_at
```

---

## Local Development

### Prerequisites
- Node.js 18+
- Python 3.13
- Docker (for LocalStack)
- LocalStack account

### Setup

```sh
# Clone the repository
git clone https://github.com/madhesh-hariharran/coding-workshop-participant.git
cd coding-workshop-participant

# Start the local environment
./bin/start-dev.sh

# Install backend dependencies for each service
for service in auth-service projects-service deliverables-service \
               resources-service allocations-service users-service; do
  pip install \
    --platform manylinux2014_x86_64 \
    --target backend/$service \
    --implementation cp \
    --python-version 3.13 \
    --only-binary=:all: \
    --upgrade \
    "psycopg[binary]==3.2.13" PyJWT bcrypt
  md5sum backend/$service/requirements.txt | cut -d' ' -f1 \
    > backend/$service/.pip_installed
done

# Install and start frontend
cd frontend && npm install && npm run dev
```

The frontend runs at `http://localhost:3000` and proxies API calls through `http://localhost:3001`.

### Seed Demo Data

```sh
# Local
./scripts/seed.sh

# Production
./scripts/seed.sh https://d2wqugjglyrwvr.cloudfront.net/api
```

The seed script creates 7 users (characters from RDR2, GTA IV, GTA V, God of War, The Last of Us), 7 projects across all statuses and budget scenarios, 14 deliverables with dependency chains and upcoming deadlines, 8 resources with mixed user account linking, and 12 allocations including 2 intentionally over-allocated resources to demonstrate the warning system.

### Demo Mode

The login page includes one-click demo buttons for all four roles. No typing required.

```
Admin        arthur.morgan@acme.com   / Demo@1234
Manager      joel.miller@acme.com     / Demo@1234
Contributor  ellie.williams@acme.com  / Demo@1234
Viewer       kratos.spartan@acme.com  / Demo@1234
```

---

## Deployment

```sh
# Deploy backend
./bin/deploy-backend.sh

# Deploy frontend
./bin/deploy-frontend.sh
```

---

## API Reference

All endpoints require `Authorization: Bearer <token>` except register and login.

| Service | Base Path | Minimum Role |
|---|---|---|
| Auth | `/api/auth-service` | Public (register/login) |
| Projects | `/api/projects-service` | Viewer |
| Deliverables | `/api/deliverables-service` | Viewer |
| Resources | `/api/resources-service` | Viewer |
| Allocations | `/api/allocations-service` | Viewer |
| Users | `/api/users-service` | Admin |

---

## Design Decisions and Trade-offs

**Single depends_on per deliverable.** The schema uses a single integer foreign key for dependency rather than a junction table. This covers the majority of real-world use cases cleanly. Multiple dependency support is noted as a planned enhancement and would require a schema migration to a `deliverable_dependencies` junction table.

**Over-allocation as a warning, not a block.** Resources can be allocated beyond 100% total across projects. Managers need full visibility to make resourcing decisions, not a system that refuses to save their work. The warning is surfaced on the dashboard, allocations page, and resources page.

**Completed project allocations excluded from utilization.** When a project is marked as completed, its allocations are excluded from the resource total allocation calculation. This means a resource's available capacity is reflected accurately as projects finish, without needing to delete historical allocation records.

**Active status displayed as In Progress.** The database stores the value as `active` for schema consistency with the constraint definition. The UI renders it as "In Progress" throughout, which is more natural for end users.

**Shared code copied per service.** `db.py` and `auth.py` are copied into each Lambda package rather than shared via a Lambda layer. This maintains full service isolation and simplifies the deployment pipeline.

**Module-level DB connection.** The psycopg3 connection is held at module level so it persists across Lambda invocations within the same warm container, reducing connection overhead on subsequent requests.

**JWT sub stored as string.** PyJWT 2.x requires the `sub` claim to be a string. All service code that reads `current_user["sub"]` casts it to `int()` at the point of database interaction.

**MUI v9 Grid.** Material UI v9 removed the `item` prop from Grid. All layout grids use flexbox via `Box` components instead, which avoids the silent rendering failures that the old Grid API produced.

---

## Known Limitations and Planned Enhancements

- Multiple deliverable dependencies (requires junction table migration)
- Email notifications for deadline reminders and over-allocation alerts
- Gantt chart view for project timelines
- E2E tests with Playwright covering complete user workflows
- Assignee field on deliverables is stored in the schema but not yet surfaced in the UI

---

## Testing

179 tests across unit, integration, and performance suites — all passed. For a full breakdown of methodology, coverage, and results see [docs/testing.md](./docs/testing.md).

---

## Repository Structure

```
backend/     Lambda microservices and shared utilities
bin/         Deployment and environment scripts
docs/        Project documentation and testing report
frontend/    React application
infra/       Terraform configuration
scripts/     Seed script, integration test suite, and performance tests
```

---

## Author

Madhesh Hariharran Sundaresan
Shiv Nadar University Chennai