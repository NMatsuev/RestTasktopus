# Task Manager

A task manager built as a **Single Page Application** (React) on top of a **REST API** (Node.js + Express + MongoDB). Tasks support full CRUD with an optional file attachment; access is controlled by roles, and the whole project runs in Docker.

- [Version history](#version-history)
- [Quick start (Docker)](#quick-start-docker)
- [Configuration: what to change and where](#configuration-what-to-change-and-where)
- [Running without Docker](#running-without-docker)
- [Roles and permissions](#roles-and-permissions)
- [API reference](#api-reference)
- [Tests, lint and CI](#tests-lint-and-ci)
- [Troubleshooting](#troubleshooting)
- [Known limitations](#known-limitations)

---

## Version history

### v1.0 — SPA + REST API (CRUD)

- React SPA (Vite): every operation goes through `fetch`, the page never reloads.
- REST API on Node.js/Express with MongoDB (Mongoose).
- Full CRUD for tasks with correct HTTP methods and status codes: `GET` (200 / 404), `POST` (201), `PUT` (200 / 404), `DELETE` (200 / 404).
- Data exchange as JSON and as `multipart/form-data` (one attachment per task: PNG, JPEG, GIF, WEBP or PDF, up to 5 MB).
- Server-side validation of all incoming data (field types and lengths, allowed statuses, ISO dates, file type and size, ObjectId format) with a uniform error body `{ "error": "...", "details": [...] }`.
- Search by title and filter by status (query parameters `?search=` and `?status=`).
- Informative error messages in the UI (banner with per-field details).
- Everything in Docker: `docker-compose.yml` with three containers — `mongo`, `server`, `client` (nginx serving the built SPA and proxying `/api` and `/uploads`).

### v1.1 — UI fixes

- The status badge no longer wraps onto a second line when an attachment has a long file name (fixed table layout, file name truncated with an ellipsis, full name in a tooltip).
- Overdue tasks (due date in the past, status not "done") are highlighted and marked "Просрочено".
- After a successful save the form is fully reset, including the native file input.

### v2.0 — Access control, security, logging, CI

- **Authentication with temporary keys:** short-lived JWT access token (15 min) plus a long-lived, revocable refresh token (30 days). Refresh tokens are random strings stored only as SHA-256 hashes, rotated on every use, and reuse of an already-used token revokes all sessions of that user.
- **Role-based access control (RBAC):** three roles — `viewer`, `manager`, `admin`. Self-registration always creates a `viewer`; only an admin can change roles. The first admin is created from environment variables on startup.
- **HTTP semantics:** one central error handler returns `400`, `401`, `403`, `404`, `409`, `423`, `429`, `500` according to their meaning, always as JSON.
- **Brute-force protection:** per-IP rate limit on auth routes plus per-account lockout after N failed logins; identical error message for "wrong password" and "unknown email"; passwords stored as bcrypt hashes.
- **Active session control:** a user sees their active sessions (browser, IP, start, expiry), can revoke one or log out everywhere; an admin can force-terminate all sessions of any user.
- **Password recovery by email:** one-time reset link with a TTL; the response never reveals whether the email exists; a successful reset revokes all sessions.
- **Structured logging:** JSON logs (pino) with a per-request `requestId` (also returned as the `X-Request-Id` header); passwords, tokens and the `Authorization` header are redacted.
- **Client:** login, registration, forgot/reset password screens; the UI adapts to the role (a viewer has no create/edit/delete controls); "Sessions" tab; admin-only "Users" tab (change role, unlock, end sessions).
- **Quality:** Jest + Supertest tests for the server, ESLint for server and client, **GitHub Actions** pipeline (lint + tests + client build + Docker image build).

### v2.1 — Refresh token in an httpOnly cookie

- The refresh token moved from the JSON body / `localStorage` to an `HttpOnly` cookie (`refresh_token`, `SameSite=Lax`, `Path=/api/auth`, optional `Secure`). JavaScript can no longer read it, which removes the "steal the token via XSS" scenario.
- `POST /api/auth/refresh` and `POST /api/auth/logout` read the cookie; they no longer accept a body. The access token stays in memory only.
- CORS is configured with `credentials: true`, so `CLIENT_ORIGIN` must be an exact origin, never `*`.
- This version assumes a **browser-only client**.

---

## Tech stack

| Part | Technology |
|---|---|
| Client | React 18, Vite, plain CSS |
| Server | Node.js 20, Express 4, express-validator, multer |
| Auth | jsonwebtoken, bcryptjs, cookie-parser, express-rate-limit |
| Database | MongoDB 7 via Mongoose |
| Email | nodemailer (SMTP) |
| Logging | pino, pino-http |
| Tests / lint | Jest, Supertest, ESLint |
| Delivery | Docker, Docker Compose, nginx, GitHub Actions |

## Project structure

```
task-manager/
├── docker-compose.yml          # mongo + server + client, main config for Docker runs
├── .github/workflows/ci.yml    # CI pipeline
├── server/
│   ├── Dockerfile
│   ├── .env.example            # config template for running WITHOUT Docker
│   ├── src/
│   │   ├── app.js              # Express app (no listen — used by tests)
│   │   ├── index.js            # DB connection, admin bootstrap, listen
│   │   ├── config/env.js       # all settings read from environment variables
│   │   ├── models/             # Task, User, RefreshToken, PasswordResetToken
│   │   ├── middleware/         # auth (JWT + roles), rateLimit, requestLogger,
│   │   │                       # upload (multer), validators, errorHandler
│   │   ├── routes/             # auth.js, users.js (admin), tasks.js
│   │   └── utils/              # tokens, sessions, mailer, logger, bootstrapAdmin
│   └── tests/                  # Jest + Supertest
└── client/
    ├── Dockerfile              # Vite build -> nginx
    ├── nginx.conf              # serves the SPA, proxies /api and /uploads to the server
    ├── vite.config.js          # dev server + dev proxy
    └── src/                    # App, http.js (fetch wrapper), auth/, admin/, tasks/, components/
```

---

## Quick start (Docker)

Requirements: Docker and Docker Compose.

```bash
cd task-manager
docker compose up --build
```

| What | URL |
|---|---|
| Web app | http://localhost:3000 |
| REST API | http://localhost:5000/api |
| Health check | http://localhost:5000/api/health |

**First login.** On the first start the server creates an administrator from `ADMIN_EMAIL` / `ADMIN_PASSWORD` in `docker-compose.yml` (default `admin@example.com` / `ChangeMe123!`). Log in with it, open the **Users** tab and promote other accounts to `manager` if needed. Accounts created through the registration form are `viewer`s.

Useful commands:

```bash
docker compose logs -f server      # server logs (JSON)
docker compose down                # stop, keep data
docker compose down -v             # stop and DELETE the database and uploaded files
docker compose up -d --build       # rebuild and restart after code changes
```

Data lives in two Docker volumes: `mongo-data` (database) and `uploads-data` (attachments).

---

## Configuration: what to change and where

### Which file is used

| Run mode | Config file |
|---|---|
| Docker (`docker compose up`) | `docker-compose.yml` → `services.server.environment`. **`server/.env` is NOT used** (it is excluded by `server/.dockerignore`). |
| Without Docker (`npm run dev`) | `server/.env` (copy it from `server/.env.example`). |

After editing `docker-compose.yml`, apply the change with `docker compose up -d --force-recreate server`.

### Environment variables

| Variable | Default | What it does / when to change |
|---|---|---|
| `JWT_ACCESS_SECRET` | dev-only placeholder | Secret used to sign access tokens. **Always replace it** with a long random string: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. With `NODE_ENV=production` the server refuses to start without it. |
| `ACCESS_TOKEN_TTL_MINUTES` | `15` | Lifetime of the access token. |
| `REFRESH_TOKEN_TTL_DAYS` | `30` | Lifetime of a session / refresh cookie. |
| `CLIENT_ORIGIN` | `http://localhost:3000` | Public URL of the client. Used for CORS **and** as the base of password-reset links. Must be an exact origin (`scheme://host:port`), never `*`. For a local run without Docker use `http://localhost:5173`. |
| `COOKIE_SECURE` | `false` | Set to `true` when the site is served over HTTPS. Keep `false` on plain `http://localhost`, otherwise the browser rejects the cookie and login "works" but the session is lost. |
| `MONGO_URI` | `mongodb://mongo:27017/taskmanager` | Database connection string. The host `mongo` exists only inside the Docker network; for a local run use `mongodb://localhost:27017/taskmanager`. |
| `PORT` | `5000` | Port of the API inside the container / process. |
| `LOG_LEVEL` | `info` (compose), `debug` (`.env.example`) | `trace` / `debug` / `info` / `warn` / `error`. |
| `LOGIN_MAX_ATTEMPTS` | `5` | Wrong passwords in a row before the account is locked. |
| `LOGIN_LOCK_MINUTES` | `15` | How long a locked account stays locked. |
| `LOGIN_RATE_WINDOW_MINUTES` | `15` | Window of the per-IP rate limit on auth routes. |
| `LOGIN_RATE_MAX_REQUESTS` | `20` | Max requests per IP in that window (login, register, forgot/reset password). |
| `RESET_TOKEN_TTL_MINUTES` | `60` | Lifetime of a password-reset link. |
| `SMTP_HOST` | empty | SMTP server. **Empty = no emails are sent; the reset link is written to the server log instead** (see [Troubleshooting](#troubleshooting)). |
| `SMTP_PORT` / `SMTP_SECURE` | `587` / `false` | Port; `true` for implicit TLS (usually port 465). |
| `SMTP_USER` / `SMTP_PASS` | empty | SMTP credentials. |
| `SMTP_FROM` | `Task Manager <no-reply@task-manager.local>` | Sender address of reset emails. |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | `admin@example.com` / `ChangeMe123!` | Credentials of the first administrator. **Important:** this runs only while the database contains **no admin at all**. Changing these values later has no effect (see below). |

### Changing the first admin after the first start

The bootstrap is skipped silently when an admin already exists, so editing `ADMIN_EMAIL` / `ADMIN_PASSWORD` afterwards does nothing. To apply new values either:

```bash
# remove existing admins only, keep everything else
docker compose exec mongo mongosh taskmanager --eval 'db.users.deleteMany({role:"admin"})'
docker compose up -d --force-recreate server
```

or wipe everything with `docker compose down -v && docker compose up --build`.

### Other places worth knowing

| File | What can be changed there |
|---|---|
| `docker-compose.yml` → `ports` | Host ports (`"3000:80"` for the client, `"5000:5000"` for the API). If you change the client port, update `CLIENT_ORIGIN` too. |
| `client/nginx.conf` | Proxy targets (`http://server:5000`). Change only if the service name or API port changes. |
| `client/vite.config.js` | Dev-server port (`5173`) and proxy target (env `VITE_PROXY_TARGET`, default `http://localhost:5000`). |
| `server/src/middleware/upload.js` | `MAX_FILE_SIZE` and `ALLOWED_MIME_TYPES`. If you change the size, also update the message in `middleware/errorHandler.js` and the label in `client/src/components/TaskForm.jsx`. |
| `server/src/middleware/validators.js` | `PASSWORD_MIN_LENGTH` (8), title/description length limits. |
| `server/src/routes/auth.js` | `BCRYPT_COST` (12). |
| `server/src/models/User.js` | `USER_ROLES`. |
| `server/src/models/Task.js` | `TASK_STATUSES` (labels in the client live in `TaskForm.jsx`, `TaskList.jsx`, `TasksPage.jsx`). |
| `server/src/app.js` | `trust proxy` is set to `1` (one proxy — nginx — in front of the API) so that the rate limiter and the session list see the real client IP. Adjust if you change the proxy chain. |
| `.github/workflows/ci.yml` | Branches that trigger CI, Node version. |

---

## Running without Docker

1. Start MongoDB on `localhost:27017`, for example:
   ```bash
   docker run -d --name tm-mongo -p 27017:27017 mongo:7
   ```
2. Server:
   ```bash
   cd server
   cp .env.example .env
   # edit .env: MONGO_URI=mongodb://localhost:27017/taskmanager
   #            CLIENT_ORIGIN=http://localhost:5173
   npm install
   npm run dev
   ```
3. Client (second terminal):
   ```bash
   cd client
   npm install
   npm run dev        # http://localhost:5173, /api and /uploads are proxied to localhost:5000
   ```

---

## Roles and permissions

| Role | Tasks | Users and sessions of others |
|---|---|---|
| `viewer` | read only | — |
| `manager` | create, read, update, delete | — |
| `admin` | create, read, update, delete | list users, change roles, unlock accounts, end sessions |

Rules: registration always gives `viewer`; an admin cannot change their own role. A role change takes effect when the user's access token is renewed (at most 15 minutes), because the role is stored inside the token.

---

## API reference

All responses are JSON. Protected routes need `Authorization: Bearer <accessToken>`. Task `POST`/`PUT` bodies are `multipart/form-data` (fields `title`, `description`, `status`, `dueDate`, optional file field `attachment`, and `removeAttachment=true` on update); everything else is JSON. Error body: `{ "error": "...", "details": [{ "field", "message" }] }` (`details` only for validation errors).

### Auth — `/api/auth`

| Method | Path | Purpose | Success | Errors |
|---|---|---|---|---|
| POST | `/register` | Create a `viewer` account (password ≥ 8 chars) | 201 | 400, 409, 429 |
| POST | `/login` | Returns `accessToken`; sets the `refresh_token` cookie | 200 | 400, 401, 423, 429 |
| POST | `/refresh` | New access token; rotates the cookie | 200 | 401 |
| POST | `/logout` | Ends the current session, clears the cookie | 200 | — |
| POST | `/logout-all` | Ends all own sessions (token required) | 200 | 401 |
| GET | `/sessions` | List own active sessions (token required) | 200 | 401 |
| DELETE | `/sessions/:id` | Revoke one own session (token required) | 200 | 401, 404 |
| POST | `/forgot-password` | Send reset link (same answer whether or not the email exists) | 200 | 400, 429 |
| POST | `/reset-password` | Set a new password using `email` + `token` + `newPassword` | 200 | 400, 429 |
| GET | `/me` | Current user (token required) | 200 | 401 |

### Users — `/api/users` (admin only)

| Method | Path | Purpose | Success | Errors |
|---|---|---|---|---|
| GET | `/` | List users | 200 | 401, 403 |
| PATCH | `/:id/role` | Change role (`{ "role": "manager" }`) | 200 | 400, 403, 404 |
| POST | `/:id/unlock` | Remove an account lock | 200 | 404 |
| POST | `/:id/revoke-sessions` | End all sessions of a user | 200 | 404 |

### Tasks — `/api/tasks`

| Method | Path | Who | Success | Errors |
|---|---|---|---|---|
| GET | `/` (`?status=`, `?search=`) | any role | 200 | 401 |
| GET | `/:id` | any role | 200 | 400, 401, 404 |
| POST | `/` | manager, admin | 201 | 400, 401, 403 |
| PUT | `/:id` | manager, admin | 200 | 400, 401, 403, 404 |
| DELETE | `/:id` | manager, admin | 200 | 400, 401, 403, 404 |

### Status codes used

| Code | Meaning in this API |
|---|---|
| 200 / 201 | OK / resource created |
| 400 | Invalid input (validation, bad id, bad file) |
| 401 | Not authenticated: missing, expired or invalid token, wrong credentials |
| 403 | Authenticated, but the role does not allow it |
| 404 | Resource not found (also returned for another user's session id) |
| 409 | Conflict, e.g. email already registered |
| 423 | Account temporarily locked after too many failed logins |
| 429 | Too many requests from this IP |
| 500 | Unexpected server error (details only in the log) |

### Example with curl

The refresh token is a cookie, so keep a cookie jar between calls (`-c` / `-b`):

```bash
# log in: accessToken in the body, refresh token saved to cookie.txt
curl -c cookie.txt -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"ChangeMe123!"}'

# create a task with an attachment
curl -X POST http://localhost:5000/api/tasks \
  -H "Authorization: Bearer <accessToken>" \
  -F "title=Write report" -F "status=todo" -F "dueDate=2026-12-01" \
  -F "attachment=@./file.pdf"

# renew the access token (sends and rotates the cookie)
curl -b cookie.txt -c cookie.txt -X POST http://localhost:5000/api/auth/refresh
```

---

## Tests, lint and CI

### Server tests

The tests need a MongoDB instance and **delete all data in the database they use**. They therefore use their own variable `TEST_MONGO_URI` (default `mongodb://127.0.0.1:27017/taskmanager_test`) and refuse to run if the database name does not contain `test` or `ci`. They never use `MONGO_URI`.

```bash
docker run -d --rm --name tm-test-mongo -p 27017:27017 mongo:7
cd server
npm install
npm test           # Jest + Supertest
npm run lint       # ESLint
docker stop tm-test-mongo
```

### Client

```bash
cd client
npm install
npm run lint
npm run build      # production build, checks that everything compiles
```

### CI (GitHub Actions)

The pipeline is `.github/workflows/ci.yml`. It runs on every push and pull request to `main`, `master` or `develop`, and can be started manually (Actions → CI → Run workflow). Jobs:

1. **server** — ESLint, then Jest tests against a MongoDB service container.
2. **client** — ESLint, then the production build.
3. **docker-build** — builds both Docker images (only if 1 and 2 passed).

To enable it, push the project to a GitHub repository (the file must be at exactly `.github/workflows/ci.yml`; `.github` is a hidden folder) and open the **Actions** tab. No secrets are needed — the workflow uses dummy values. To block merging when CI fails, add a branch protection rule requiring the three jobs.

---

## Troubleshooting

**I changed `ADMIN_EMAIL` / `ADMIN_PASSWORD` but cannot log in.**
Either you edited `server/.env` while running in Docker (Docker reads `docker-compose.yml`), or an admin already exists in the database, so the bootstrap is skipped. Try the old credentials first, or follow [Changing the first admin](#changing-the-first-admin-after-the-first-start).

**Login succeeds, but I am logged out after a page refresh (or `/api/auth/refresh` returns 401).**
The cookie is not being stored. Check that: `CLIENT_ORIGIN` equals the exact address in the browser bar (`localhost` and `127.0.0.1` are different origins); `COOKIE_SECURE=true` is used only over HTTPS; `CLIENT_ORIGIN` is not `*`.

**423 "account temporarily locked".**
Wait `LOGIN_LOCK_MINUTES`, or unlock the account as an admin in **Users → Unlock**. A successful password reset also clears the lock.

**429 "too many attempts".**
The per-IP limit was hit. Wait for the window (`LOGIN_RATE_WINDOW_MINUTES`) or restart the server (counters are kept in memory).

**No password-reset email arrives.**
With an empty `SMTP_HOST` nothing is sent; the link is written to the log:
```bash
docker compose logs server | grep resetLink
```
Open that link (it points to `CLIENT_ORIGIN/reset-password?...`). For real emails set the `SMTP_*` variables.

**`MongoServerSelectionError` / cannot connect to MongoDB when running locally.**
`MONGO_URI` still contains the host `mongo` from the template; use `mongodb://localhost:27017/taskmanager`.

**I changed `docker-compose.yml`, nothing happened.**
Recreate the container: `docker compose up -d --force-recreate server` (or `--build` if code changed).

**Where did my uploaded files and tasks go?**
`docker compose down -v` deletes the `mongo-data` and `uploads-data` volumes. Use plain `docker compose down` to keep data.

---

## Known limitations

- Rate-limit counters are stored in server memory: they reset on restart and are not shared between several server instances.
- An access token cannot be revoked before it expires (up to 15 minutes); the same delay applies to role changes.
- Account lockout can be abused to lock someone else out by repeatedly failing to log in as them; a CAPTCHA or progressive delays would be the next step.
- All tasks are visible to every authenticated user; `createdBy` is stored but not used for permissions yet.
- Uploaded files are served from `/uploads/<random-name>` without authentication (names are random and unguessable, but the route itself is public).
- The SPA always tries one silent refresh on page load, because it cannot see whether the httpOnly cookie exists.
- The `COOKIE_SECURE=false` default in `docker-compose.yml` is for local HTTP only; a real deployment needs HTTPS, `COOKIE_SECURE=true`, its own `JWT_ACCESS_SECRET`, and real SMTP settings.
