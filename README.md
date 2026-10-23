# Talkie Monorepo

Unified monorepo for the **Talkie** platform powered by **Nx** and **npm workspaces**.

## Workspace Structure

```
talkie/
├── apps/
│   ├── backend/             # NestJS 11 REST API, Socket.io, TypeORM, Redis (@talkie/backend)
│   └── frontend/            # React 18, Vite, Chakra UI (@talkie/frontend)
├── packages/                # Shared internal libraries (optional future expansions)
├── nx.json                  # Nx workspace configuration & task caching
├── package.json             # Root workspace package and script orchestrator
└── README.md
```

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Development Servers
To run both backend and frontend simultaneously:
```bash
npm run dev
```

Or run individually:
```bash
# Backend (NestJS with hot reload)
npm run dev:backend

# Frontend (Vite dev server)
npm run dev:frontend
```

### 3. Build Projects
```bash
# Build all apps with Nx task caching
npm run build

# Build backend only
npm run build:backend

# Build frontend only
npm run build:frontend
```

### 4. Testing & Linting
```bash
npm run test
npm run lint
```

### 5. Docker Containers

> [!IMPORTANT]
> All Docker builds must be executed from the **monorepo root** directory.

* **Backend**: See [Backend Docker Instructions](apps/backend/README.md#7-running-with-docker-local-dev--production) for local development (hot-reload) and production container setup.
* **Frontend**:
  ```bash
  # Build frontend container
  docker build -f apps/frontend/Dockerfile -t talkie-frontend .
  ```
