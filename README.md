# Firebase Studio

A browser-based Firebase development environment built with Next.js: connect
Firebase projects, browse and edit Firestore, and write and run JavaScript
against your data.

**Code. Execute. Manage.**

| Module | What it does |
| --- | --- |
| Connections | Add projects with a **Web config** (browser, Security Rules enforced) or an **Admin service account** (server, full access). Test connectivity. |
| Database explorer | Browse collections and subcollections, query (filters, order, limit, pagination), search, create/edit/delete documents in a type-preserving JSON editor, import/export JSON. |
| Playground | Monaco editor with two execution engines, console/table/error/result output, timeouts, templates. |
| Scripts & history | Save and reopen scripts; every run is recorded with status, duration and (truncated, redacted) output. |

## Quick start

```bash
npm install
cp .env.example .env.local   # then fill in the three required values
npm run dev
```

Open http://localhost:3000 and sign in with `STUDIO_PASSWORD`.

Required in `.env.local`:

| Variable | Purpose |
| --- | --- |
| `STUDIO_PASSWORD` | Password of the Studio owner account. |
| `STUDIO_SESSION_SECRET` | 32+ random characters used to sign session cookies. |
| `STUDIO_ENCRYPTION_KEY` | Base64 32-byte key that encrypts service-account JSON at rest. |

See `.env.example` for optional settings (separate Firestore project for Studio
data, disabling server execution, env allow-list for scripts, concurrency).

Node.js 22 or newer is recommended: the server execution worker uses the Node
permission model (`--permission`).

## How it works

```
Browser ─ Next.js UI (Monaco, explorer)
   │
   ├─ Web config connection ──► sandboxed iframe (opaque origin) ─► Web Worker ─► Firebase Web SDK ─► Firestore (rules apply)
   │                            (scripts)                              ▲
   │                            explorer: Web SDK in the page ─────────┘
   │
   └─ Studio API (Next.js route handlers: auth, validation, ownership)
         ├─ Admin connection, explorer ─► Firebase Admin SDK (fixed CRUD only)
         └─ Admin connection, scripts ──► separate Node.js worker process ─► Firebase Admin SDK
```

### Execution engines

**Browser (Web config connections).** Scripts run inside
`<iframe sandbox="allow-scripts">` (opaque origin: no access to Studio's cookies,
storage or DOM), in a Web Worker so the timeout can terminate even a
`while (true) {}`. The Firebase compat SDK is loaded from the official CDN at the
same version as the installed `firebase` package. Globals: `db`, `auth`,
`firebase`, `app`, `console`. Sign in to the project (anonymous or email/password)
from the *Project auth* panel to test your Security Rules as a user.

**Server (Admin connections).** Each run spawns a fresh Node.js process
(`workers/execution-worker`) — user code never runs inside the Next.js process
and `eval`/`vm` is not used as a sandbox. The worker gets:

- the decrypted key for exactly one connection, over the IPC channel (never argv/env);
- an empty environment (plus only names in `EXECUTION_ENV_ALLOWLIST`);
- Node permission model: read-only access to its own files and `node_modules`,
  no file writes, no child processes, no worker threads, no native addons;
- a 256 MB heap limit and a hard wall-clock timeout (SIGKILL).

Globals: `db`, `admin` (`admin.firestore.FieldValue`, `admin.auth()`, …),
`console`, `process.env` (allow-listed only), `Buffer`.

> The worker still has network access and runs on the Studio host. Only give
> Studio accounts to trusted operators. For production, run the worker in an
> ephemeral container (e.g. Cloud Run jobs) with resource limits and egress
> restrictions — the worker's JSON job protocol is designed for that move.

### Firestore types

The explorer, import/export and API use tagged JSON so types survive a
round-trip:

```json
{
  "createdAt": { "$timestamp": "2024-05-01T10:00:00.123456789Z" },
  "location": { "$geopoint": { "latitude": 51.5, "longitude": -0.1 } },
  "owner": { "$ref": "users/alice" },
  "avatar": { "$bytes": "aGVsbG8=" },
  "embedding": { "$vector": [0.1, 0.2] }
}
```

Timestamps keep nanosecond precision. A real map whose only key looks like a tag
is escaped as `{ "$map": { ... } }`.

### Security model

- Every page and API requires a signed, HttpOnly, `SameSite=Strict` session
  cookie; mutating API calls also reject foreign `Origin` headers.
- Service-account JSON is validated, encrypted with AES-256-GCM (bound to its
  owner and connection id) and never returned to the browser or the editor.
- Every API checks resource ownership (`userId`); other users' records return 404.
- Execution history redacts private keys and stores at most 32 KB of output
  (can be turned off in Settings). Credentials are never logged.
- Connection changes, document writes and server executions are written to an
  audit log.

## Studio's own data

By default Studio stores connections, scripts, history and audit logs in
`.studio-data/db.json` (git-ignored) — fine for local, single-instance use.

To use a dedicated Firestore project instead, set
`STUDIO_FIREBASE_SERVICE_ACCOUNT` and deploy the rules and indexes in this
repository to **that** project (never to a project you connect to):

```bash
firebase deploy --only firestore --project <studio-project-id>
```

## Project layout

```
src/app/(studio)/        dashboard, connections, database, playground, scripts, history, settings
src/app/api/             connections, database, execution/{client,server}, scripts, history, settings, audit, auth
src/components/          editor/, database/, connections/, layout/, ui/
src/lib/firebase/        admin.js, client.js, connection-manager.js
src/lib/execution/       client-runner.js, server-runner.js, output-formatter.js, templates.js
src/lib/firestore/       codec.js (typed JSON), admin-query.js, preview.js
src/lib/security/        session.js, encryption.js, permissions.js
src/lib/studio-db/       file and Firestore backends for Studio's own data
public/sandbox/          browser sandbox (runner.html, runner.js, worker.js, serializer.js)
workers/execution-worker Node.js execution worker
```

## Not in this version

- Multi-user sign-up (single owner account; data is already keyed by `userId`).
- Queued/asynchronous server jobs and remote (containerised) workers.
- Firestore emulator connections, Storage and Realtime Database.
- Query history and scheduled backups.
