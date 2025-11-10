# Project Template Guide

This document explains how to reuse the PureStream platform structure when bootstrapping a new product. It captures the directory layout, Docker Compose configurations for development and production, and the minimum steps required to adapt the scaffold to a new domain.

---

## 1. Repository Layout

```
project-root/
├── admin-frontend/              # Vite + React admin SPA
├── web-frontend/                # Next.js storefront/client app
├── backend-services/
│   └── user-service/            # FastAPI application (monolith with modular features)
├── docker-compose.dev.yml       # Local development stack
├── docker-compose.prod.yml      # Production stack (Traefik reverse proxy)
├── docker-compose.yml           # Thin wrapper → choose dev/prod via `COMPOSE_FILE`
├── docker-compose.ci.yml        # Optional: CI pipeline stack
├── infra/                       # Terraform / IaC helpers (if any)
├── docs/                        # Architecture & operating runbooks
└── README.md / DEVELOPMENT.md   # High-level overview & local dev instructions
```

- The backend is split into feature modules under `backend-services/user-service/app/**` (users, stores, products, orders, etc.). Each module encapsulates routers, schemas, services, repositories, and migrations.
- Both frontends share design tokens (Tailwind + shadcn/ui) but remain fully independent for deployment and build pipelines.
- Docker Compose orchestrates a PostgreSQL database, the FastAPI API, and the two frontends.

> **Tip:** When duplicating the repo, keep the overall structure and rename only the top-level directory and Git remote. Internal module names can stay generic (e.g., `user-service`) until you need specific branding.

---

## 2. Development Environment (`docker-compose.dev.yml`)

### Services

| Service         | Role                                            | Default Port | Notes                                                                                  |
|-----------------|--------------------------------------------------|--------------|----------------------------------------------------------------------------------------|
| `db`            | PostgreSQL 16                                    | `5432`       | Credentials defined inline (`user/password`). Volume `postgres_data` persists data.    |
| `user-service`  | FastAPI backend with auto-reload                 | `8001`       | Runs `alembic upgrade head` before starting; mounts app directory for hot reloading.   |
| `web-frontend`  | Next.js dev server                               | `3001`       | Uses `Dockerfile.dev`; code mounted from host, `node_modules` kept inside container.    |
| `admin-frontend`| Vite dev server                                  | `5173`       | Same dev Dockerfile pattern as storefront.                                             |

### Usage

1. Copy `.env.example` (if present) to `.env` inside `backend-services/user-service/`.
2. Start the stack:
   ```bash
   docker compose -f docker-compose.dev.yml up --build
   ```
3. Visit the frontends at:
   - Admin: http://localhost:5173
   - Storefront: http://localhost:3001
4. API docs available at http://localhost:8001/docs.

### Customisation Checklist

- Update `ALLOWED_ORIGINS` / CORS values under the `user-service` `environment` block when your dev URLs change.
- If your new project needs additional services (e.g., Redis, worker queues), add them here and wire them into the backend as needed.
- Rename database credentials if multiple templates will run side-by-side on the same machine.

---

## 3. Production Environment (`docker-compose.prod.yml`)

The production stack intentionally mirrors the dev topology while layering on Traefik for TLS termination and host-based routing.

### Services

| Service         | Role                                                      |
|-----------------|-----------------------------------------------------------|
| `reverse-proxy` | Traefik v2.10 with automatic Let’s Encrypt certificates.   |
| `db`            | PostgreSQL 16 (configured via environment variables).      |
| `user-service`  | FastAPI backend; served behind Traefik with strict CORS.   |
| `web-frontend`  | Next.js production build (static export + runtime server). |
| `admin-frontend`| React admin build served via Nginx (Dockerfile.prod).      |

### Key Concepts

- **Networks & Volumes:** All services join the `web` network. Shared volumes (`postgres_data`, `uploads`, `letsencrypt`) preserve state.
- **Traefik Labels:** Each service exposes HTTP routers and middlewares through labels. When cloning the template:
  - Replace `API_HOST`, `WEB_HOST`, `ROOT_HOST`, `ADMIN_HOST` with your domain names.
  - Update CORS allow lists and security headers to match your domains.
- **Environment Variables:** The production compose file expects secrets via environment (e.g., `POSTGRES_PASSWORD`, `NEXT_PUBLIC_API_ORIGIN`). Create a `.env.production` in the project root and load it with `docker compose --env-file`.

### Deployment Flow

1. Build images locally or via CI:
   ```bash
   docker compose -f docker-compose.prod.yml build
   ```
2. Push to registry if required (tag images and push).
3. On the server, pull images and run:
   ```bash
   docker compose --env-file .env.production -f docker-compose.prod.yml up -d
   ```
4. Monitor logs:
   ```bash
   docker compose -f docker-compose.prod.yml logs -f reverse-proxy user-service
   ```

> **Security Note:** Production `.env` files should never be committed. Use secret managers or CI/CD environments to inject sensitive values.

---

## 4. Adapting the Backend Module

1. **Rename Domain Concepts:** Inside `backend-services/user-service/app/features`, update module names or keep them generic (e.g., `products`, `orders`). The modular layout already matches a microservices-style separation.
2. **Migrations:** Create new Alembic revisions per project. Run inside the container:
   ```bash
   docker compose -f docker-compose.dev.yml exec user-service alembic revision -m "descr"
   docker compose -f docker-compose.dev.yml exec user-service alembic upgrade head
   ```
3. **Settings:** All runtime configuration lives in `app/core/config.py`. Keep defaults friendly for dev and override via environment for prod.
4. **Extend Services:** Adding more APIs? Follow the existing pattern: `*_router.py` (FastAPI routes) → `*_service.py` (business logic) → `*_repository.py` (database access).

---

## 5. Frontend Reuse Strategy

### Admin Frontend (`admin-frontend/`)
- Vite config lives in `vite.config.ts`. Update `server.proxy` targets when API host changes.
- Auth context (`src/context/AuthContext.tsx`) expects JWTs from the backend. Replace branding and layouts but retain context/provider structure for consistency.
- Use `npm run build` to produce static assets served by the production Dockerfile (Nginx by default).

### Web Frontend (`web-frontend/`)
- Built with Next.js App Router. API origin configured via environment (`NEXT_PUBLIC_API_ORIGIN`).
- Review existing `src/app/**` routes as examples for SSR/CSR hybrid flows.
- Update `Dockerfile.dev` / `Dockerfile.prod` only if you need additional build steps (e.g., custom fonts, analytics packages).

---

## 6. Suggested Workflow for a New Project

1. **Clone the Template**
   ```bash
   git clone <purestream-template> new-project
   cd new-project
   rm -rf .git
   git init
   ```
2. **Rename References (Optional):**
   - Update `package.json` names in both frontends.
   - Adjust branding inside `admin-frontend/src/components/MainLayout.tsx`, `web-frontend/src/app/layout.tsx`, etc.
3. **Configure Environments:**
   - Dev: copy `.env` files, tweak credentials, ensure Compose ports do not collide with other local apps.
   - Prod: prepare `.env.production` with hostnames, database secrets, third-party keys.
4. **Spin Up Dev Stack:** `docker compose -f docker-compose.dev.yml up --build`
5. **Add New Feature Modules:** Follow the existing backend architecture, create migrations, add API tests.
6. **Document Differences:** Keep a `docs/CHANGELOG.md` or similar to track divergences from the template for future upgrades.

---

## 7. Maintenance Tips

- **Keep Compose Files in Sync:** When adding/removing services, modify both `docker-compose.dev.yml` and `docker-compose.prod.yml` so environments stay aligned.
- **Automate Builds:** Use `docker-compose.ci.yml` or a GitHub Actions workflow to run tests, builds, and publish images.
- **Monitor Dependencies:** Frontends rely on Node 18+; backend expects Python 3.11 in the Dockerfile. Align your local tooling to avoid version drift.
- **Logging & Observability:** Add volumes or external sinks (e.g., Prometheus, Loki) in Compose if your new project needs observability out of the gate.

---

## 8. Quick Reference Commands

```bash
# Development
docker compose -f docker-compose.dev.yml up --build
docker compose -f docker-compose.dev.yml exec user-service alembic upgrade head

# Production dry run
docker compose --env-file .env.production -f docker-compose.prod.yml config
docker compose --env-file .env.production -f docker-compose.prod.yml up -d

# Rebuild single service (dev)
docker compose -f docker-compose.dev.yml up --build user-service
```

Use this guide as a baseline whenever you spin up a new product. Keeping the structure consistent makes it easier to share tooling, CI pipelines, and operational knowledge across projects.

