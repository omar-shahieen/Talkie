# Talkie api API

A production-oriented api built with NestJS and TypeScript.

It supports:

- Advanced authentication (JWT + refresh cookie + Google OAuth + 2FA)
- RBAC-based authorization at server and channel scope
- Server, channel, role, and membership management
- Full messaging domain (messages, replies, threads, reactions, search)
- Local file upload for messages with security filtering and image compression
- Realtime communication via Socket.IO (chat, notifications, presence, typing)
- Event-driven notifications
- Mail queue with worker processing
- Scheduled cleanup jobs (cron)

## 1. High-Level Architecture

- HTTP Layer: Nest controllers and services
- Realtime Layer: Socket.IO gateways with dedicated namespaces
- Internal Event Bus: event-emitter driven domain events
- Persistence:
  - PostgreSQL for core entities
  - Redis for presence/cache/queue runtime data

## 2. Core Modules

- AuthModule
  - Local auth, JWT, refresh flow, Google OAuth, 2FA
- AccessControlModule
  - Permission resolution with guards/decorators
- ServersModule
  - Server creation, discovery, invite-based join, leave/remove
- ChannelsModule
  - Server channels + DMs, visibility rules, read acknowledgements
- MessagesModule
  - Messaging APIs, reactions, threads/replies, search, uploads
- NotificationsModule
  - Mention/DM notifications and read-state management
- PresenceModule
  - Online state, heartbeat, status restoration
- MailModule
  - Queued email sending with worker and queue events
- AuditModule
  - Audit stream and persistence
- LoggingModule
  - Structured logging to stdout/stderr with CLS correlation tracing

## 3. Runtime Features

### 3.1 Authentication and Security

- JWT guard is globally enabled by default
- Public endpoints are explicitly marked via decorator
- Refresh token is stored as `jwt_refresh` cookie
- Google OAuth callback supports frontend redirection
- 2FA flow:
  - initiate
  - enable
  - disable
  - verify

### 3.2 Messaging and Attachments

- Create/update/delete messages
- Add/remove reactions
- Reply and thread navigation
- Search behavior:
  - Elasticsearch if `ELASTICSEARCH_NODE` is configured
  - PostgreSQL fallback query otherwise
- Upload endpoint behavior:
  - Stores files locally in `uploads/messages`
  - Blocks dangerous extensions (for example `exe`, `js`, `bat`, `ps1`)
  - Compresses images to WebP
  - Validates channel membership before accepting upload

### 3.3 Message Deletion and Retention

- User-initiated message deletion is hard delete
- Automated retention job:
  - Runs daily at midnight
  - Hard-deletes messages older than 7 days
  - Recomputes `lastMessageId` for impacted channels

### 3.4 Realtime (Socket.IO)

- `chat` namespace events:
  - `server:join` / `server:leave`
  - `channel:join` / `channel:leave`
  - `dm:join` / `dm:leave`
  - `typing:start` / `typing:stop`
  - `presence:set` / `presence:heartbeat`
  - Broadcasts message, reaction, typing, and presence updates
- `notifications` namespace:
  - User-room based push delivery
  - `notification:recieved`
  - `notification:cleared`

## 4. REST API Documentation (Swagger / OpenAPI)

Interactive REST API documentation and OpenAPI schemas are provided via Swagger.

### 4.1 How to Access Swagger Docs

1. **Start the api development server**:
   ```bash
   # From apps/api directory:
   npm run start:dev

   # Or from the repository root:
   npm run dev:api
   ```
2. **Access the endpoints in your browser**:
   - **Swagger UI (Interactive)**: [http://localhost:3000/api/docs](http://localhost:3000/api/docs)
   - **OpenAPI JSON Spec**: [http://localhost:3000/api/docs-json](http://localhost:3000/api/docs-json)

_(If you have configured a custom `PORT` in your `.env`, replace `3000` with your configured port)._

### 4.2 What the Swagger Docs Provide

- **Interactive API Explorer**: Execute live HTTP requests directly against your running local instance.
- **DTO Schemas & Validation**: Inspect payload formats, required attributes, types, and constraints for all requests.
- **Authentication Support**: Use the **Authorize** button with your JWT token (`Bearer <access_token>`) to test authenticated endpoints.
- **Comprehensive Domain Coverage**: Full documentation for Auth, Users, Friends, Servers, Channels, Messages, Roles, Invitations, Notifications, and Access Control.

---

## 5. Environment Configuration & Backing Services

The api uses a pre-configured [.env.example](.env.example) template located in the api root directory. Before starting the server, create your local configuration:

```bash
cp .env.example .env
```

## 6. Local Setup (Without Docker)

Install dependencies from the monorepo root:

```bash
npm install
```

Run required backing infrastructure locally:

- PostgreSQL
- Redis

Start the application:

```bash
# development
npm run start:dev

# production build
npm run build
npm run start:prod
```

---

## 7. Running with Docker (Local Dev & Production)

> [!IMPORTANT]
> **Build Context**: Always run `docker build` from the **monorepo root** directory (`talkie/`), because the build context needs the root `package.json` and `package-lock.json` to validate workspace dependencies.

### 7.1 Database & Redis Connection Inside Docker

Inside any container, `localhost` refers to the container itself. To connect to PostgreSQL and Redis:

- **When DB & Redis run on your host computer or forwarded ports (e.g. Docker Desktop)**:
  Use `host.docker.internal` as the host:
  ```env
  DATABASE_URL=postgres://postgres:postgres@host.docker.internal:5432/talkie
  REDIS_URL=redis://:password@host.docker.internal:6379
  ```
- **When containers share a user-defined Docker network** (e.g. `talkie-net`):
  Use the container names directly:
  ```env
  DATABASE_URL=postgres://postgres:postgres@talkie-postgres:5432/talkie
  REDIS_URL=redis://:password@talkie-redis:6379
  ```

---

### 7.2 Local Development with Docker

Run a hot-reloading development container with local source code mounted into the container:

#### Step 1: Build the Development Stage Image

Run from the monorepo root:

```bash
docker build --target development -f apps/api/Dockerfile -t talkie-api:dev .
```

#### Step 2: Run the Development Container

**PowerShell (Windows):**

```powershell
docker run -it --rm `
  --name talkie-api-dev `
  -p 3000:3000 `
  --env-file apps/api/.env `
  -e NODE_ENV=development `
  -e DATABASE_URL=postgres://postgres:postgres@host.docker.internal:5432/talkie `
  -e REDIS_URL=redis://:password@host.docker.internal:6379 `
  -v ${PWD}/apps/api/src:/usr/src/app/apps/api/src `
  -v talkie_uploads:/usr/src/app/uploads `
  talkie-api:dev npm run start:dev
```

**Bash / Linux / macOS:**

```bash
docker run -it --rm \
  --name talkie-api-dev \
  -p 3000:3000 \
  --env-file apps/api/.env \
  -e NODE_ENV=development \
  -e DATABASE_URL=postgres://postgres:postgres@host.docker.internal:5432/talkie \
  -e REDIS_URL=redis://:password@host.docker.internal:6379 \
  -v $(pwd)/apps/api/src:/usr/src/app/apps/api/src \
  -v talkie_uploads:/usr/src/app/uploads \
  talkie-api:dev npm run start:dev
```

---

### 7.3 Production Container Deployment

The production image is multi-stage, compiles TypeScript to `dist/`, prunes development dependencies, and runs under the unprivileged `node` user with single-line structured JSON logs streaming to `stdout`.

#### Step 1: Build the Production Image

Run from the monorepo root:

```bash
docker build -f apps/api/Dockerfile -t talkie-api:latest .
```

#### Step 2: Run the Production Container

**Option A: Connecting to host-bound services (`host.docker.internal`)**

**PowerShell (Windows):**

```powershell
docker rm -f talkie-api 2>$null

docker run -d `
  --name talkie-api `
  -p 3000:3000 `
  --env-file apps/api/.env `
  -e NODE_ENV=production `
  -e DATABASE_URL=postgres://postgres:postgres@host.docker.internal:5432/talkie `
  -e REDIS_URL=redis://:password@host.docker.internal:6379 `
  -v talkie_uploads:/usr/src/app/uploads `
  --log-opt max-size=20m `
  --log-opt max-file=3 `
  --restart unless-stopped `
  talkie-api:latest
```

**Bash / Linux / macOS:**

```bash
docker rm -f talkie-api 2>/dev/null

docker run -d \
  --name talkie-api \
  -p 3000:3000 \
  --env-file apps/api/.env \
  -e NODE_ENV=production \
  -e DATABASE_URL=postgres://postgres:postgres@host.docker.internal:5432/talkie \
  -e REDIS_URL=redis://:password@host.docker.internal:6379 \
  -v talkie_uploads:/usr/src/app/uploads \
  --log-opt max-size=20m \
  --log-opt max-file=3 \
  --restart unless-stopped \
  talkie-api:latest
```

**Option B: On a Shared Docker Network (`talkie-net`)**

```bash
# 1. Create network (if not already existing)
docker network create talkie-net

# 2. Connect your database and redis containers
docker network connect talkie-net talkie-postgres
docker network connect talkie-net talkie-redis

# 3. Start api using internal container DNS names
docker run -d \
  --name talkie-api \
  --network talkie-net \
  -p 3000:3000 \
  --env-file apps/api/.env \
  -e NODE_ENV=production \
  -e DATABASE_URL=postgres://postgres:postgres@talkie-postgres:5432/talkie \
  -e REDIS_URL=redis://:password@talkie-redis:6379 \
  -v talkie_uploads:/usr/src/app/uploads \
  --log-opt max-size=20m \
  --log-opt max-file=3 \
  --restart unless-stopped \
  talkie-api:latest
```

#### Step 3: Useful Docker Operations

```bash
# View live logs
docker logs -f talkie-api

# Check container resource usage
docker stats talkie-api

# Stop and restart container
docker stop talkie-api
docker start talkie-api
```

---

## 8. Useful Scripts

```bash
npm run build
npm run lint
npm run test
npm run test:e2e
npm run seed
```

## 9. Uploads and Static Files

- Uploaded files are stored under `uploads/messages`
- In Docker, persistent storage is maintained via the `talkie_uploads` named volume mounted to `/usr/src/app/uploads`
- Static serving is exposed under `/uploads/*`

## 10. Contributor Notes

- A large part of the system is event-driven (messages, notifications, realtime updates)
- Follow the existing module pattern: Controller -> Service -> Repository
- Permission-related changes should be validated with AccessControlModule behavior
- Message lifecycle changes should account for:
  - notification side effects
  - websocket broadcasts
  - search sync
  - retention job behavior

## 11. License

UNLICENSED
