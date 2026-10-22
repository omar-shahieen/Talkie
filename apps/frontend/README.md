<p align="center">
  <h1 align="center">🎙️ Talkie — Frontend</h1>
  <p align="center">A Discord-inspired real-time chat client built with React, TypeScript, Chakra UI, and Socket.IO.</p>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=black" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white" />
  <img src="https://img.shields.io/badge/Chakra_UI-319795?style=for-the-badge&logo=chakraui&logoColor=white" />
  <img src="https://img.shields.io/badge/Socket.IO-010101?style=for-the-badge&logo=socket.io&logoColor=white" />
</p>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Tech Stack](#-tech-stack)
- [Architecture](#-architecture)
- [Features](#-features)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Routing](#-routing)
- [Services Layer](#-services-layer)
- [Real-Time Integration](#-real-time-integration)
- [Theming](#-theming)
- [Build Optimization](#-build-optimization)
- [Scripts](#-scripts)

---

## 🌟 Overview

The Talkie frontend is a single-page application (SPA) that provides a full Discord-like chat experience. It communicates with the Talkie backend via REST APIs for data operations and Socket.IO WebSockets for real-time features like messaging, typing indicators, and presence updates.

**Key highlights:**
- 💬 Real-time chat with channels, DMs, threads, reactions, and file attachments
- 🔐 Full auth flow: login, signup, Google OAuth, 2FA with TOTP, password reset
- 🟢 Multi-device presence system with online/idle/DND/offline states
- 🔔 Live notification center with mention and DM alerts
- 🛡️ Role-based UI: admin panel only visible to admin users
- 🌓 Dark/Light theme with semantic color tokens
- ⚡ Optimized Vite builds with manual chunk splitting

---

## 🔧 Tech Stack

### Core

| Technology | Version | Role | Details |
|------------|---------|------|---------|
| **[React](https://reactjs.org/)** | 17.x | UI library | Component-based architecture with hooks for state management and side effects. Declarative rendering with efficient virtual DOM diffing. |
| **[TypeScript](https://www.typescriptlang.org/)** | 4.x | Language | Static typing shared with the backend. Prevents common JavaScript bugs, enhances IDE autocompletion, and makes large-scale refactoring safe. |
| **[Vite](https://vitejs.dev/)** | 2.x | Build tool & dev server | Native ES module development server with sub-second Hot Module Replacement (HMR). Production builds use Rollup with tree-shaking and manual chunk splitting for optimal bundle sizes. |

### UI & Styling

| Technology | Version | Role | Details |
|------------|---------|------|---------|
| **[Chakra UI](https://chakra-ui.com/)** | 1.x | Component library | Accessible, composable React components with built-in dark/light mode support. Provides a theming system with semantic tokens, responsive style props, and a rich set of pre-built components (Modal, Drawer, Toast, etc.). |
| **[Emotion](https://emotion.sh/)** | 11.x | CSS-in-JS engine | Runtime styling engine powering Chakra UI. Supports dynamic, prop-based styles with automatic vendor prefixing and server-side rendering compatibility. Includes both `@emotion/react` (core) and `@emotion/styled` (styled API). |
| **[Framer Motion](https://www.framer.com/motion/)** | 4.x | Animation library | Declarative animations for React components. Powers smooth page transitions, modal enter/exit animations, hover effects, and micro-interactions. Required by Chakra UI for its `AnimatePresence` features. |
| **[@fontsource/sora](https://fontsource.org/fonts/sora)** | 4.x | Typography | Self-hosted Sora font — a modern geometric sans-serif typeface. Eliminates FOUT (Flash of Unstyled Text) by bundling the font locally instead of loading from Google Fonts CDN. |

### Communication

| Technology | Version | Role | Details |
|------------|---------|------|---------|
| **[Socket.IO Client](https://socket.io/)** | 4.x | WebSocket client | Manages real-time connections to the backend's `/chat` and `/notifications` namespaces. Handles automatic reconnection, JWT-authenticated handshakes, and room-based event subscriptions. |
| **[Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)** | Native | HTTP client | Custom `requestJson<T>()` wrapper with automatic JWT header injection, 401 → silent refresh → retry logic, structured error handling, and response envelope unwrapping. |

### Routing & State

| Technology | Version | Role | Details |
|------------|---------|------|---------|
| **[React Router](https://reactrouter.com/)** | 5.x | Client-side routing | Declarative route definitions with protected route patterns. Auth-aware redirects, nested layouts (main chat layout, settings layout), and dynamic parameters for server/channel navigation. |
| **[localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)** | Native | Auth persistence | Stores `access_token` and serialized `user` object for session restoration across page reloads. Token refresh is triggered automatically on 401 responses. |

---

## 🏗️ Architecture

### Layer Diagram

```
┌─────────────────────────────────────────────────────────┐
│                      Views (Pages)                       │
│  LoginView │ IndexView │ SettingsView │ AdminView │ ...  │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────────┐
│                    UI Components                         │
│  ChatContainer │ LeftSidebar │ TopBar │ ThreadPanel │ ...│
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────────┐
│                   Custom Hooks                           │
│    useAuth │ usePresence │ usePermissions │ useSocket     │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────────┐
│                  Service Layer                           │
│  api.service │ auth-api │ message │ channel │ server     │
│  friends │ notification │ roles │ user │ invitation      │
└──────────────────────┬──────────────────────────────────┘
                       │
            ┌──────────┴──────────┐
            │                     │
      ┌─────┴─────┐      ┌───────┴───────┐
      │  REST API  │      │  Socket.IO    │
      │  (fetch)   │      │  (real-time)  │
      └─────┬─────┘      └───────┬───────┘
            │                     │
            └──────────┬──────────┘
                       │
              ┌────────┴────────┐
              │  Backend API    │
              │  (port 3000)    │
              └─────────────────┘
```

### Data Flow

| Flow | Path |
|------|------|
| **User action** | Component → Service → `requestJson()` → Backend REST API |
| **Real-time receive** | Backend Socket.IO → `supabase.ts` adapter → Component state update |
| **Auth flow** | `auth-api.service` → `authStorage` → `useAuth()` hook → Components |
| **Token refresh** | 401 response → `api.service` auto-refresh → retry original request |

---

## ✨ Features

### Chat Interface
- **Server sidebar** — List of joined servers with unread indicators
- **Channel list** — Categorized channels with read/unread states
- **Message area** — Scrollable messages with author info, timestamps, reactions
- **Thread panel** — Slide-out panel for threaded conversations
- **Typing indicators** — Real-time "user is typing…" display
- **File attachments** — Upload images/files with the message input
- **Message actions** — Edit, delete, "Delete for Everyone" (24h window), react

### Authentication
- **Login/Signup** — Form-based with validation
- **Google OAuth** — One-click redirect flow with callback handler
- **2FA Setup** — QR code display, TOTP verification, enable/disable toggle
- **Password Reset** — Email-based token flow
- **Auto-refresh** — Silent token rotation on 401 responses

### Settings & Admin
- **Profile settings** — Username, display name, avatar, password change
- **2FA management** — Setup, enable, disable from settings
- **Admin panel** — Role management, user management (admin-only)

### Presence & Notifications
- **Status management** — Set online/idle/DND/offline
- **Heartbeat** — 30-second keepalive to maintain presence
- **Notification center** — Real-time mention and DM notifications
- **Unread tracking** — Bold indicators for channels with new messages

---

## 📁 Project Structure

```
frontend/
├── index.html                    # HTML entry point
├── vite.config.ts                # Vite configuration with chunk splitting
├── tsconfig.json                 # TypeScript configuration
├── package.json                  # Dependencies and scripts
│
└── src/
    ├── main.tsx                  # React DOM render entry
    ├── App.tsx                   # ChakraProvider + theme + routing root
    ├── App.css                   # Global CSS overrides
    ├── index.css                 # Base styles
    │
    ├── app/                      # Core application logic
    │   ├── supabase.ts           # Backend API adapter
    │   │                         #   - WebSocket connection management
    │   │                         #   - QueryBuilder for REST API calls
    │   │                         #   - Real-time message subscription
    │   │                         #   - Auth methods (user, signOut, refresh)
    │   ├── authStorage.ts        # Token read/write/clear from localStorage
    │   ├── datamodels.ts         # Shared TypeScript type definitions
    │   ├── access-control.ts     # Permission check utilities
    │   │
    │   └── services/             # API service modules
    │       ├── api.service.ts    # Core HTTP client
    │       │                     #   - requestJson<T>() with auto-refresh
    │       │                     #   - API URL builder
    │       │                     #   - Response envelope unwrapping
    │       │                     #   - Error formatting
    │       ├── auth-api.service.ts    # Login, signup, OAuth, 2FA, passwords
    │       ├── message.service.ts     # CRUD, reactions, threads, search, upload
    │       ├── channel.service.ts     # Channel CRUD, visibility, read ack
    │       ├── server.service.ts      # Server CRUD, discovery, join/leave
    │       ├── friends.service.ts     # Friend requests management
    │       ├── notification.service.ts # Notifications list and read
    │       ├── roles.service.ts       # Role CRUD
    │       ├── user.service.ts        # Current user profile
    │       └── invitation.service.ts  # Invite link operations
    │
    ├── hooks/                    # Custom React hooks
    │   ├── useAuth.tsx           # Authentication state (fetches profile, caches user)
    │   ├── usePresence.tsx       # Presence management (status, heartbeat)
    │   ├── usePermissions.tsx    # Permission resolution for current context
    │   └── useSocketEvent.ts     # Generic Socket.IO event listener
    │
    ├── routes/                   # Routing configuration
    │   ├── AppRouteProvider.tsx  # All route definitions with auth guards
    │   └── defaultRoute.ts      # Smart redirect (to first server/channel)
    │
    └── ui/                       # UI layer
        ├── components/           # Reusable UI components
        │   ├── AppChatContainer.tsx       # Main chat message area
        │   ├── AppChatInput.tsx           # Message input with file upload
        │   ├── AppLeftSidebar.tsx         # Server + channel sidebar
        │   ├── AppMainSidebar.tsx         # Server icon rail
        │   ├── AppMainTopbar.tsx          # Channel header + actions
        │   ├── AppRightSidebar.tsx        # Member list sidebar
        │   ├── AppMemberList.tsx          # Online/offline member groups
        │   ├── AppThreadPanel.tsx         # Thread conversation panel
        │   ├── AppNotificationCenter.tsx  # Notification dropdown
        │   ├── AppCategoryList.tsx        # Channel categories
        │   ├── AppCategoryChannelList.tsx # Channels within a category
        │   └── ...
        │
        ├── views/                # Page-level components
        │   ├── LoginView.tsx             # Login + Signup + OAuth
        │   ├── IndexView.tsx             # Main chat view
        │   ├── SettingsView.tsx          # User settings page
        │   ├── AdminManagementView.tsx   # Admin panel (role-gated)
        │   ├── OAuthCallbackView.tsx     # Google OAuth callback handler
        │   ├── ResetPasswordView.tsx     # Password reset form
        │   └── NotFoundView.tsx          # 404 page
        │
        ├── layouts/              # Layout wrappers
        │   ├── MainLayout.tsx            # Three-column chat layout
        │   └── SettingsLayout.tsx        # Settings page layout
        │
        └── theme/                # Design tokens
            └── colors.tsx                # Semantic color definitions
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 16+
- Talkie Backend running at `http://localhost:3000`

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Start development server
npm run dev
# → Opens at http://localhost:3001

# 3. (Optional) Custom backend URL
echo "VITE_API_URL=http://your-backend:3000" > .env
```

---

## 🛣️ Routing

| Path | Component | Auth Required | Description |
|------|-----------|---------------|-------------|
| `/` | `RootEntry` | ✅ | Redirects to first server/channel or login |
| `/login` | `LoginView` | ❌ | Login and signup forms |
| `/oauth` | `OAuthCallbackView` | ❌ | Google OAuth callback handler |
| `/reset-password/` | `ResetPasswordView` | ❌ | Password reset form |
| `/servers/:serverId/channels/:channelId` | `IndexView` | ✅ | Main chat interface |
| `/settings/` | `SettingsView` | ✅ | User profile and account settings |
| `/settings/admin` | `AdminManagementView` | ✅ + Admin | Admin panel (role-gated) |
| `*` | `NotFoundView` | ❌ | 404 page |

### Route Protection
- Unauthenticated users → redirected to `/login`
- Authenticated users at `/` → smart redirect to their first server's first channel
- Non-admin users at `/settings/admin` → redirected to `/settings/`

---

## 🔌 Services Layer

### API Client (`api.service.ts`)

The core HTTP client wraps the native Fetch API with:

```typescript
const data = await requestJson<ResponseType>('/endpoint', {
  method: 'POST',
  body: { key: 'value' },
});
```

**Built-in behaviors:**
- **Auto token injection** — Reads `access_token` from localStorage, sets `Authorization: Bearer` header
- **Silent refresh on 401** — Attempts one token refresh, then retries the original request
- **Response unwrapping** — Strips `{ success, results }` envelope, returns `results` directly
- **Structured errors** — Throws `ApiError` with status code, message, and validation details
- **FormData support** — Detects `FormData` body and omits `Content-Type` header

### Backend Adapter (`supabase.ts`)

A compatibility layer that adapts the original Supabase-based API calls to the custom NestJS backend:

- `supabase.auth.user()` — Returns cached user from localStorage
- `supabase.auth.signOut()` — Calls `/auth/logout` and clears local state
- `supabase.auth.refresh()` — Calls `/auth/refresh` and updates stored token
- `supabase.from('table').select().eq('column', value).then(callback)` — Translates to REST API calls
- **Real-time subscriptions** — Connects to Socket.IO `/chat` namespace and maps events to Supabase-compatible `{eventType, new, old}` payloads

---

## ⚡ Real-Time Integration

### Socket.IO Connections

Two persistent WebSocket connections are managed in `supabase.ts`:

| Socket | Namespace | Purpose |
|--------|-----------|---------|
| `chatSocket` | `/chat` | Messages, typing, presence, channel updates |
| `notificationsSocket` | `/notifications` | Mention and DM notifications |

### Connection Lifecycle

```
User logs in → Token stored in localStorage
    │
    ▼
getChatSocket() called → Creates Socket.IO connection with JWT auth
    │
    ▼
socket.emit('server:join', serverId)    ← Join server room
socket.emit('channel:join', payload)    ← Join channel room
    │
    ▼
socket.on('message:created', handler)   ← Listen for new messages
socket.on('presence:update', handler)   ← Listen for presence changes
socket.on('typing:start', handler)      ← Listen for typing indicators
    │
    ▼
Heartbeat interval (30s) → socket.emit('presence:heartbeat')
```

### Events Consumed

| Event | Handler |
|-------|---------|
| `message:created` | Adds new message to chat |
| `message:updated` | Updates edited message |
| `message:deleted` | Removes deleted message |
| `message:deletedForEveryone` | Removes message for all users |
| `reaction:added` | Updates reaction count |
| `reaction:removed` | Updates reaction count |
| `typing:start` / `typing:stop` | Shows/hides typing indicator |
| `presence:update` | Updates user online status |
| `presence:restored` | Restores status on reconnect |
| `channel:updated` | Updates unread indicators |
| `notification:recieved` | Shows new notification |

---

## 🎨 Theming

### Semantic Token System

The app uses Chakra UI's semantic token system for automatic dark/light mode support:

```typescript
semanticTokens: {
  colors: {
    "bg-primary":   { light: "#ffffff", dark: "#1a1a1a" },
    "bg-secondary": { light: "#f5f5f5", dark: "#2a2a2a" },
    "text-primary": { light: "#000000", dark: "#ffffff" },
    "border-color": { light: "#e0e0e0", dark: "#333333" },
  },
}
```

### Typography

The app uses **Sora** as its primary font family — a clean geometric sans-serif loaded via `@fontsource/sora` for optimal performance (no external CDN dependency).

---

## 📦 Build Optimization

Vite is configured with manual chunk splitting to optimize production bundle sizes:

| Chunk | Contents | Rationale |
|-------|----------|-----------|
| `chakra-ui` | @chakra-ui/* + @emotion/* | Largest dependency, cached independently |
| `router` | react-router-dom | Routing logic separated from UI |
| `socket` | socket.io-client | WebSocket client loaded lazily |
| `supabase` | @supabase/* | Backend adapter layer |
| `motion` | framer-motion | Animation library |
| `fonts` | @fontsource/* | Font files |
| `vendor` | Everything else from node_modules | Catch-all vendor chunk |

This strategy ensures that updates to application code don't invalidate cached vendor bundles.

---

## 📜 Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite dev server with HMR (port 3001) |
| `npm run build` | Type-check with `tsc` then build production bundle |
| `npm run serve` | Preview production build locally |

---

## 📄 License

UNLICENSED
