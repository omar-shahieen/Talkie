# AGENTS.md — Agent Operations & Codebase Manual for Talkie

Welcome to **Talkie**! This guide is tailored for AI agents and human developers operating within this repository. It provides key architecture guidelines, operational commands, system patterns, and critical gotchas to ensure fast, safe, and coherent contributions.

---

## 1. Project Overview & Philosophy

**Talkie** is a Discord-inspired real-time collaboration and chat platform structured as a monorepo managed with **Nx** and **npm workspaces**.

### Applications

| Package            | Directory       | Tech Stack                                                                                                        | Role / Description                                                                    |
| ------------------ | --------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `@talkie/api`      | `apps/api`      | NestJS 11, TypeScript 5.9, TypeORM (PostgreSQL), Redis (BullMQ, Cache, Throttler), Socket.IO, Winston, Prometheus | Core REST API, WebSockets, background job worker, RBAC authorization, file processing |
| `@talkie/frontend` | `apps/frontend` | React 18, Vite 6, TypeScript 5.9, Chakra UI v2, Emotion, Framer Motion, Socket.IO Client, React Router v5         | Real-time single-page web client (Discord-style UI)                                   |

---

## 2. Repository Layout & Directory Map

```text
talkie/
├── apps/
│   ├── api/                        # @talkie/api
│   │   ├── Dockerfile                  # Multi-stage Docker build (root context)
│   │   ├── docker-compose.monitoring.yml # Prometheus & Grafana stack
│   │   ├── templates/                  # Handlebars email templates (welcome, 2FA, reset password)
│   │   └── src/
│   │       ├── access-control/         # CASL permissions & server/channel guards
│   │       ├── audit/                  # Audit log entity (TypeORM/Postgres JSONB) & BullMQ worker
│   │       ├── auth/                   # JWT, Refresh cookie, Google OAuth, 2FA (TOTP)
│   │       ├── channels/               # Channel management, DMs, read receipts
│   │       ├── common/                 # Filters, interceptors, pipes, decorators, metrics, seed
│   │       ├── events/                 # Event-emitter domain events
│   │       ├── files/                  # Attachment uploads, validation & Sharp WebP compression
│   │       ├── friends/                # Friend requests, accepts, blocks
│   │       ├── invitations/            # Server invite codes and join flow
│   │       ├── logging/                # Winston structured logger
│   │       ├── mail/                   # BullMQ email queue & Nodemailer transport
│   │       ├── messages/               # Messages CRUD, threads, reactions, search, retention job
│   │       ├── notifications/          # Notification entities & real-time delivery
│   │       ├── presence/               # Redis presence tracking, status & heartbeats
│   │       ├── roles/                  # Server-level RBAC roles and permissions
│   │       ├── servers/                # Server CRUD, member rosters, settings
│   │       ├── types/                  # Shared TypeScript interfaces & types
│   │       ├── users/                  # User accounts, profiles, preferences
│   │       ├── app.module.ts           # Root module with global guards, filters, interceptors
│   │       └── main.ts                 # Bootstrap, cookie-parser, validation pipe, CORS
│   └── frontend/                       # @talkie/frontend
│       ├── Dockerfile                  # Multi-stage Docker build (root context)
│       ├── index.html                  # HTML entry point
│       ├── vite.config.ts              # Vite config, dev port 3001, chunk splitting
│       └── src/
│           ├── app/
│           │   ├── services/           # API clients (fetch wrapper with 401 token refresh)
│           │   ├── access-control.ts   # Client-side permission helpers
│           │   ├── authStorage.ts      # Access token & user storage in localStorage
│           │   └── datamodels.ts       # Frontend data interfaces
│           ├── hooks/                  # Custom hooks: useAuth, usePresence, usePermissions, useSocketEvent
│           ├── routes/                 # React Router v5 AppRouteProvider & route definitions
│           └── ui/
│               ├── components/         # Reusable UI widgets (chat, sidebar, modals, etc.)
│               ├── layouts/            # Page layouts
│               ├── theme/              # Chakra UI theme customizations and colors
│               └── views/              # Page views (Chat, Login, Register, Settings, Admin, etc.)
├── nx.json                             # Nx workspace configuration & target defaults
├── package.json                        # Root workspace scripts and dependencies
├── package-lock.json                   # Root lockfile (single source of truth)
└── AGENTS.md                           # This operations guide
```

---

## 3. Essential Commands & Development Workflows

### 3.1 Dependency Management

> [!IMPORTANT]
> Always run package installs from the root. Never run `npm install` inside `apps/api` or `apps/frontend` directly without workspace flags, or you risk breaking `package-lock.json`.

```bash
# Install all dependencies across monorepo
npm install

# Add a package to api
npm install <pkg-name> --workspace=@talkie/api

# Add a package to frontend
npm install <pkg-name> --workspace=@talkie/frontend

# Add a dev dependency to root
npm install -D <pkg-name>
```

### 3.2 Running Development Servers

```bash
# Start both api and frontend simultaneously
npm run dev

# Start api only (NestJS hot reload on http://localhost:3000)
npm run dev:api

# Start BullMQ worker only (NestJS hot reload, entry: src/worker.ts)
npm run dev:worker

# Start frontend only (Vite dev server on http://localhost:3001)
npm run dev:frontend
```

### 3.3 Building Projects

```bash
# Build all workspaces with Nx task caching
npm run build

# Build api only (outputs dist/main.js AND dist/worker.js to apps/api/dist)
npm run build:api

# Build frontend only (typechecks and outputs to apps/frontend/dist)
npm run build:frontend
```

### 3.4 Running Production Builds

```bash
# Run compiled api (requires build:api first)
npm run start:api

# Run compiled BullMQ worker (requires build:api first)
npm run start:worker

# Preview built frontend (requires build:frontend first)
npm run start:frontend
```

### 3.5 Linting, Formatting & Testing

```bash
# Lint all projects (api lint auto-fixes)
npm run lint

# Format / check formatting of api sources
npm run format
npm run format:check

# Run tests across projects (Nx)
npm run test

# api unit tests (Jest) — plus watch & coverage variants
npm run test:unit
npm run test:watch
npm run test:cov

# api e2e tests
npm run test:e2e

# api live integration scripts (require a running api)
npm run test:auth
npm run test:messaging
npm run test:upload
```

### 3.6 Database Seeding

```bash
# Seed development database
npm run seed
```

### 3.7 Docker Builds

> [!WARNING]
> Both Dockerfiles require the monorepo root as the build context because they copy `package.json` and `package-lock.json` to properly invoke `npm ci --workspace=...`.

```bash
# Build api container
docker build -f apps/api/Dockerfile -t talkie-api .

# Build frontend container
docker build -f apps/frontend/Dockerfile -t talkie-frontend .
```

---

## 4. api Architecture & Core Conventions (`@talkie/api`)

### 4.1 Global Pipeline Execution Order

In `apps/api/src/app.module.ts`, guards, interceptors, and filters are registered in a specific global sequence:

1. **Guards**:
   - `ThrottlerGuard`: Global Redis-backed rate limiting.
   - `AuthJwtGuard`: **Globally enabled**. All routes require a valid JWT unless decorated with `@Public()`.
   - `ServerPermissionsGuard`: Server-scoped CASL ability checks.
   - `AppPermissionsGuard`: System-wide RBAC checks.
2. **Interceptors**:
   - `CorrelationIdInterceptor`: Injects / tracks request correlation IDs via `nestjs-cls`.
   - `CacheInterceptor`: Redis/in-memory caching.
   - `LoggingInterceptor`: Request timing and structured winston output.
   - `TransformInterceptor`: Enforces uniform JSON response envelope:
     ```json
     {
       "success": true,
       "message": "Operation successful",
       "results": { ... }
     }
     ```
3. **Filter**:
   - `GlobalExceptionFilter`: Standardizes all HTTP and domain exceptions into unified error envelopes.

### 4.2 Data Storage Strategy

- **PostgreSQL (via TypeORM)**: Primary persistence layer for Users, Servers, Channels, Messages, Roles, Invitations, Friends, and Audit Logs (using `jsonb`). `DB_SYNC=true` is used in development; migrations are recommended for production.
- **Redis (ioredis)**: Used for:
  - Presence tracking and online heartbeats.
  - BullMQ job queues (`mail` queue, `audit` queue).
  - Throttler rate-limit storage.
  - Cache manager.
- **Local File Storage**: Uploaded message attachments are stored in `apps/api/uploads/messages`, compressed to WebP via Sharp, and dangerous file extensions are rejected.

### 4.3 Real-Time Architecture (Socket.IO)

Two distinct namespaces are used:

- `/chat`: Channel and DM messaging, message updates/deletions, reactions, typing indicators, user presence heartbeats.
- `/notifications`: Direct user rooms for mention and DM alerts.

### 4.4 Scheduled Retention

- Messages module has a cron job executing daily at midnight that hard-deletes messages older than 7 days and recalculates channel `lastMessageId`.

---

## 5. Frontend Architecture & Conventions (`@talkie/frontend`)

### 5.1 Technology Version Notes

- **React Router**: Uses `react-router-dom` **v5.3.4** (uses `useHistory`, `useLocation`, `<Switch>`, `<Route>`). Do **not** use React Router v6 hooks like `useNavigate`.
- **Chakra UI**: Uses Chakra UI **v2.10.x** with `@emotion/react` and `framer-motion`.
- **Vite**: Configured to serve on port `3001`.

### 5.2 API Communication & Auth State

- Handled in `apps/frontend/src/app/services/api.service.ts`:
  - `API_URL` defaults to `http://localhost:3000` or `VITE_API_URL`.
  - Automatically attaches `Authorization: Bearer <access_token>` from `localStorage`.
  - Catches `401 Unauthorized` responses and silently requests `/auth/refresh` before retrying the original request.
  - Automatically unwraps the api's `{ results }` envelope.

---

## 6. Guidelines for Future AI Agents

When implementing features or bug fixes, keep the following rules in mind:

1. **Adding Public Endpoints**:
   Because `AuthJwtGuard` is global in the api, always add the `@Public()` decorator to any controller method that does not require authentication.
2. **Handling Response Envelopes**:
   The api's `TransformInterceptor` automatically wraps returned data in `{ success: true, results: data }`. Do not manually wrap responses in `{ results: ... }` in your controllers.
3. **Frontend Routing Compatibility**:
   Stick to `react-router-dom` v5 patterns. Use `const history = useHistory()` and `history.push(...)`.
4. **Environment Variables**:
   Reference `apps/api/.env.example` when adding or modifying api configurations. Never hardcode credentials or secrets.
5. **Linting & Verification Before Handover**:
   Always run:
   ```bash
   npm run build
   ```
   Ensure both api and frontend build without TypeScript or bundling errors.
