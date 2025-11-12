# Factory Management Platform

This repository now follows the simplified project template described in `docs/project-template.md`. The goal is to keep the development workflow approachable while leaving room to scale up later. The product is tailored for **AECO — Arshad Engineering Company**.

## Layout

```
├── admin-frontend/              # Vite + React admin SPA
├── web-frontend/                # Next.js operator/client portal
├── backend-services/
│   ├── requirements/            # Shared Python requirement sets
│   └── user-service/            # FastAPI application (auth + domain APIs)
├── docker-compose.dev.yml       # Local development stack
├── docs/                        # Documentation (project template, etc.)
└── README.md                    # You are here
```

## Prerequisites

- Docker with Compose v2
- Node.js 18+ and npm (if you prefer running the frontends locally without containers)

## Quick start

```bash
# from the repository root
docker compose -f docker-compose.dev.yml up --build
```

> 💡 Once the initial images are built you can usually skip `--build`. The updated Dockerfiles copy dependency
> manifests before application code, so `docker compose up` will reuse cached layers unless `requirements*.txt`
> or `package-lock.json` change. Rebuilding only the affected service via `docker compose build user-service`
> or `docker compose build admin-frontend` further shortens feedback loops. Compose now loads
> `backend-services/user-service/.env`, so tweak backend credentials there instead of editing the compose file.

Stack overview:

| Service         | Port | Notes                                                         |
|-----------------|------|---------------------------------------------------------------|
| postgres        | 5432 | Dev database for the FastAPI service                          |
| user-service    | 8001 | FastAPI app with auth, inventory, and production endpoints    |
| admin-frontend  | 5173 | React admin panel (Vite dev server)                           |
| web-frontend    | 3001 | Next.js portal (app router)                                   |

The FastAPI docs are available at http://localhost:8001/docs once the containers are up.

### Default credentials

The backend seeds two users during startup:

| Role        | Email                   | Password          |
|-------------|-------------------------|-------------------|
| Super Admin | `superadmin@example.com`| `SuperSecure123!` |
| Admin       | `admin@example.com`     | `AdminSecure123!` |

Change these defaults by editing `backend-services/user-service/.env.example` and creating a matching `.env` file.

### Super admin capabilities

Authenticated users can query `GET /employees?page=1&page_size=10` for a paginated roster. Super admins (bearer token from `/auth/login`) get additional management capabilities:

- `GET /admin/users` – list every account.
- `POST /admin/users` – create admins or additional super admins (pass `role` in the body).
- `PATCH /admin/users/{id}/role` – elevate or demote a user.
- `PATCH /admin/users/{id}/status` – activate or disable accounts.
- `POST /employees` – register new employees (attendance roll). Employee IDs follow the automatic `AECO-XXXX` pattern so they stay memorable.
- `PUT /employees/{id}` – update employee profile information.
- Daily salary is derived automatically (`monthly_salary / days_in_month`) so you only need to enter the monthly amount.
- Attendance/allowances:
  - `POST /attendance/clock-in` & `/attendance/clock-out` – record presence with automatic break handling (8am–5pm with 1–2pm break). Timestamp overrides are accepted for manual adjustments.
  - `PATCH /attendance/{id}` – edit clock-in/out times retroactively (e.g., fixing punch errors).
  - `GET /attendance` – review logs.
  - `POST /attendance/advances` – log daily allowances/advances; later queried via `GET /attendance/advances`.
  - Full/half-day tracking: any shift ending before 13:00 is marked as a half-day; otherwise it's a full day. Monthly summaries expose both counts for payroll context.
- Leaves:
  - `POST /leaves` – record paid or unpaid leave windows per employee.
  - `PUT /leaves/{id}` and `DELETE /leaves/{id}` – correct or remove mistakes without touching the database manually.
  - `GET /leaves` and `/leaves/by-employee/{id}` – filter/paginate leave history, including monthly views.
  - Penalty deductions show up alongside recorded leave. Super admins can delete a penalty entry, which files an override so the deduction is forgiven the next time payroll runs.
- Payroll:
  - `GET /payroll` – monthly roll-up that surfaces penalty Fridays, overtime credits, and advance deductions for every employee. This powers the Payroll screen in the admin panel and feeds CSV exports.

All admin routes require an `Authorization: Bearer <token>` header and will reject non–super admin users.

## Working on the backend

- Shared dependencies live in `backend-services/requirements/base.txt`.
- The FastAPI app is modularised under `backend-services/user-service/app`:
  - `api/routes/` contains routers for auth, admin tooling, inventory, production, and health.
  - `core/` holds configuration and security utilities.
  - `db/` provides SQLAlchemy models, sessions, and bootstrap logic.
  - `schemas/` exposes the Pydantic models shared across routes.
- Dev-friendly defaults live in `backend-services/user-service/.env` (duplicated from `.env.example`); `docker-compose.dev.yml`
  automatically loads it so you only need to edit one file when changing ports or bootstrap credentials.
- When the container starts it auto-creates tables and seeds the default accounts. Add Alembic later if you need formal migrations.

To run the backend without Docker:

```bash
cd backend-services/user-service
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
# Run database migrations when models change
alembic upgrade head

# FastAPI unit tests live under tests/
pytest
```

### Testing

API-level regression tests live in `backend-services/user-service/tests`. They rely on an in-memory SQLite database, so you can run them without Docker:

```bash
cd backend-services/user-service
pytest
```

## Working on the frontends

- `admin-frontend` is the admin SPA. Use `npm install` and `npm run dev` if you prefer not to run it inside Docker. The UI now requires a super admin login before showing any protected routes.
  - Employees workspace: list employees with pagination, add new records, and edit existing profiles.
  - Employee detail view: inspect monthly attendance/allowance summaries per employee with pagination, including paid/unpaid leave counts, penalty deductions, and overtime credits.
  - Attendance workspace: clock staff in/out with manual time pickers; Daily Advances workspace handles allowances; the redesigned Leaves workspace lets you edit/delete entries and shows monthly penalties at a glance.
  - Payroll workspace: a month selector plus CSV export that surfaces net payable, deductions, and overtime credits for every employee.
- `web-frontend` is a minimal Next.js app. Extend `app/page.tsx` with customer/operator features as needed. Run it via Docker Compose or locally with `npm run dev`.

Both frontends talk to the FastAPI service at `http://localhost:8001`.

## CI/CD

- **build.yml** – runs on semantic tags (`v*.*.*`). It builds the user-service, web, and admin images using the production Dockerfiles and publishes them to GHCR under `ghcr.io/<owner>/<repo>/{service}` with both the tag name and commit SHA.
- **deploy.yml** – runs on every push to `main` (and can be dispatched manually). It builds the frontends for verification, rebuilds/pushes all service images, and then connects over SSH (via `appleboy/ssh-action`) to run `docker compose -f docker-compose.ci.yml up -d`. Make sure these secrets exist: `SSH_HOST`, `SSH_USER`, `SSH_KEY`, `APP_DIR`. Set repository variables for `VITE_API_BASE_URL` and `NEXT_PUBLIC_API_BASE_URL` so the frontend build args resolve.
- **docker-compose.ci.yml** – production stack that expects environment values such as `ACME_EMAIL`, `API_HOST`, `WEB_HOST`, `ADMIN_HOST`, `ROOT_HOST`, `POSTGRES_*`, and `CORS_ORIGINS`. Create a `.env` alongside it on the server (or export before running compose) plus reuse `backend-services/user-service/.env` for database/application settings.

## Next steps

1. Production hardening: add a dedicated `docker-compose.prod.yml`, managed secrets, and observability for the payroll + attendance services.
2. Payroll approval workflow: introduce a lock/approve step so super admins can freeze a month's figures before disbursing salaries.
3. Broaden automated tests with integration coverage (e.g., exercising attendance + leave flows end-to-end via FastAPI TestClient and adding React Testing Library specs for the new Payroll UI).
