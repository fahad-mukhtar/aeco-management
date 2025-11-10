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
  - `GET /leaves` and `/leaves/by-employee/{id}` – filter/paginate leave history, including monthly views.

All admin routes require an `Authorization: Bearer <token>` header and will reject non–super admin users.

## Working on the backend

- Shared dependencies live in `backend-services/requirements/base.txt`.
- The FastAPI app is modularised under `backend-services/user-service/app`:
  - `api/routes/` contains routers for auth, admin tooling, inventory, production, and health.
  - `core/` holds configuration and security utilities.
  - `db/` provides SQLAlchemy models, sessions, and bootstrap logic.
  - `schemas/` exposes the Pydantic models shared across routes.
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
```

## Working on the frontends

- `admin-frontend` is the admin SPA. Use `npm install` and `npm run dev` if you prefer not to run it inside Docker. The UI now requires a super admin login before showing any protected routes.
  - Employees workspace: list employees with pagination, add new records, and edit existing profiles.
  - Employee detail view: inspect monthly attendance/allowance summaries per employee with pagination.
  - Attendance workspace: clock staff in/out; Daily Advances workspace handles allowances; Leaves workspace records paid/unpaid absences.
- `web-frontend` is a minimal Next.js app. Extend `app/page.tsx` with customer/operator features as needed. Run it via Docker Compose or locally with `npm run dev`.

Both frontends talk to the FastAPI service at `http://localhost:8001`.

## Next steps

1. Introduce database migrations (Alembic) for `user-service`.
2. Add authentication flows to the frontends that consume `/auth/login`.
3. Extend the API with real inventory and production data once persistence requirements are defined.
4. Set up automated testing (pytest for FastAPI, Playwright or React Testing Library for the UIs).
