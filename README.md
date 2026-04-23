# Discord Backend API

A production-oriented Discord-like backend built with NestJS and TypeScript.

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

## 1. Tech Stack

- NestJS 11
- TypeScript
- PostgreSQL + TypeORM (primary data store)
- MongoDB + Mongoose (audit data)
- Redis (presence and queue runtime)
- BullMQ (background jobs)
- Socket.IO (WebSocket)
- Elasticsearch (optional, for search)
- Multer + Sharp (upload and image processing)

## 2. High-Level Architecture

- HTTP Layer: Nest controllers and services
- Realtime Layer: Socket.IO gateways with dedicated namespaces
- Internal Event Bus: event-emitter driven domain events
- Persistence:
  - PostgreSQL for core entities
  - MongoDB for audit logs
  - Redis for presence/cache/queue runtime data

## 3. Core Modules

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
  - Audit stream and persistence in MongoDB
- LoggingModule
  - Structured logging and HTTP request logging

## 4. Runtime Features

### 4.1 Authentication and Security

- JWT guard is globally enabled by default
- Public endpoints are explicitly marked via decorator
- Refresh token is stored as `jwt_refresh` cookie
- Google OAuth callback supports frontend redirection
- 2FA flow:
  - initiate
  - enable
  - disable
  - verify

### 4.2 Messaging and Attachments

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

### 4.3 Message Deletion and Retention

- User-initiated message deletion is hard delete
- Automated retention job:
  - Runs daily at midnight
  - Hard-deletes messages older than 7 days
  - Recomputes `lastMessageId` for impacted channels

### 4.4 Realtime (Socket.IO)

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

## 5. REST API Summary

### 5.1 Auth

- POST `/auth/signup`
- POST `/auth/login`
- POST `/auth/refresh`
- POST `/auth/logout`
- GET `/auth/profile`
- GET `/auth/google`
- GET `/auth/google/callback`
- POST `/auth/tfa/initiate`
- POST `/auth/tfa/enable`
- POST `/auth/tfa/disable`
- POST `/auth/tfa/verify`

### 5.2 Servers

- POST `/servers`
- GET `/servers`
- GET `/servers/mine/:userId`
- GET `/servers/discovery/public`
- POST `/servers/join`
- DELETE `/servers/:id/leave/:userId`
- GET `/servers/:id`
- PATCH `/servers/:id`
- DELETE `/servers/:id?requesterId=...`

### 5.3 Channels

- POST `/channels`
- GET `/channels`
- GET `/channels/server/:serverId/visible/:userId`
- GET `/channels/:id`
- PATCH `/channels/:id`
- DELETE `/channels/:id`
- POST `/channels/:channelId/ack`

### 5.4 Messages

- POST `/messages/upload`
- POST `/messages`
- PATCH `/messages/:id`
- DELETE `/messages/:id`
- GET `/messages/channel/:channelId`
- GET `/messages/:id/replies`
- GET `/messages/:id/thread`
- POST `/messages/:id/reactions`
- DELETE `/messages/:id/reactions`
- GET `/messages/search/query`

### 5.5 Roles

- POST `/roles`
- GET `/roles`
- GET `/roles/:id`
- PATCH `/roles/:id`
- DELETE `/roles/:id`

### 5.6 Notifications

- GET `/notifications`
- PATCH `/notifications/:id/read`

### 5.7 Access Control

- GET `/access-control/resolve`

## 6. Environment Variables

### 6.1 Core

- `NODE_ENV`
- `PORT`
- `APP_NAME`

### 6.2 PostgreSQL

- `DB_HOST`
- `DB_PORT`
- `DB_USERNAME`
- `DB_PASSWORD`
- `DB_NAME`
- `DB_SYNC`

### 6.3 MongoDB

- `MONGO_URI`

### 6.4 Redis / Queue

- `REDIS_HOST`
- `REDIS_PORT`
- `REDIS_USERNAME`
- `REDIS_PASSWORD`

### 6.5 Auth

- `JWT_SECRET`
- `FRONTEND_OAUTH_REDIRECT_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_CALLBACK_URL`

### 6.6 Mail

- `MAIL_FROM`
- `DEV_MAIL_HOST`
- `DEV_MAIL_PORT`
- `DEV_MAIL_USER`
- `DEV_MAIL_PASS`
- `PROD_MAIL_HOST`
- `PROD_MAIL_PORT`
- `PROD_MAIL_USER`
- `PROD_MAIL_PASS`

### 6.7 Search

- `ELASTICSEARCH_NODE` (optional)

## 7. Local Setup

Install dependencies:

```bash
npm install
```

Run required infrastructure locally:

- PostgreSQL
- MongoDB
- Redis

Start the application:

```bash
# development
npm run start:dev

# production build
npm run build
npm run start:prod
```

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
