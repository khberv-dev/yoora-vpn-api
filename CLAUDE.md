# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A NestJS 12 + TypeORM + PostgreSQL API for a VPN. It has user accounts with JWT auth, and it provisions AmneziaWG (WireGuard fork) peers: `POST /v1/connection` (for the authenticated user) generates an x25519 key pair, assigns the user a tunnel IP, registers the peer on the host's `wg0` interface by shelling out to `awg`, and returns the client config pieces (private/public key, `10.0.0.N/32`, server public key).

Structure follows the sibling project `../learning-platform-api` (`common/`, `shared/config`, per-module `controllers/ dto/ entity/ services/ strategies/ utils/` subfolders), except feature modules live in `src/modules` rather than `src/core`, and imports are relative (no `@/` alias).

## Commands

```bash
npm install
npm run start:dev        # watch mode
npm run build            # nest build -> dist/src/main.js (rootDir is ".", so migrations/ builds too)
npm run start:prod       # node dist/src/main
npm run lint             # oxlint --type-aware
npm run format           # prettier (single quotes, trailing commas)
npm test                 # vitest, picks up **/*.spec.ts
npx vitest run path/to/file.spec.ts   # single test file
npx vitest run -t "test name"         # single test by name
npm run test:e2e         # vitest with **/*.e2e-spec.ts

npm run migration:generate -- migrations/SchemaChange   # builds first
npm run migration:run                                   # builds first
npm run db:clear         # typeorm schema:drop — destructive
```

There are currently no tests.

## Environment

`.env.example` is the source of truth: `PORT`, `API_VERSION` (required; routes are served under `/v{API_VERSION}`), `ENVIRONMENT` (`DEVELOPMENT` | `DEPLOYMENT`, anything else resolves to `DEPLOYMENT`), `JWT_ACCESS_SECRET`/`JWT_ACCESS_EXPIRE` (`1d`), `JWT_REFRESH_SECRET`/`JWT_REFRESH_EXPIRE` (`30d`), `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`.

- TypeORM `synchronize` is on only in `DEVELOPMENT`. Pending migrations in `migrations/` always run on startup (`migrationsRun`), before sync. Deployment schema changes must be captured in a migration.
- The DataSource (`src/shared/config/database.config.ts`, also used by the TypeORM CLI) loads entities from `dist/**/*.entity.js` and migrations from `dist/migrations/*.js`, so the app must be built (or running under `nest start`) before the DB is usable.
- `SnakeNamingStrategy` maps camelCase properties to snake_case columns (`createdAt` → `created_at`, relation `user` → `user_id`). Use camelCase in code; never name columns by hand unless overriding.
- The `awg` CLI and a configured `wg0` interface must exist on the host. Locally (macOS) `POST /connection` fails at the `awg` call.

## Architecture

**Global wiring (`app.module.ts`, `main.ts`).** `JwtAccessGuard` is a global `APP_GUARD`, so every route requires a valid access token unless marked `@Public()`. A global `ValidationPipe` uses `whitelist` + `forbidNonWhitelisted`, so unknown body fields are 400s. `ApiErrorLoggingFilter` logs every failed request in all environments, with body and headers **unredacted**. `LoggingInterceptor` logs all requests and responses, in `DEVELOPMENT` only. Every HTTP route carries the global prefix `/v{API_VERSION}` (`main.ts`, `setGlobalPrefix`); route paths elsewhere in this file omit it. The prefix does not apply to Socket.io: the chat namespace stays at `/chat`.

**Auth (`modules/auth`).** `POST auth/sign-up {name, username, email, password}` and `POST auth/sign-in {login, password}` return `{ user, accessToken, refreshToken }`. `login` is treated as an email if it contains `@`, otherwise as a username. `POST auth/refresh` takes the **refresh** token as the Bearer token and returns a new pair. Refresh is stateless: no token storage, rotation tracking, or revocation. The JWT payload is `{ sub: userId }`. Access and refresh tokens are signed with different secrets, so neither works in place of the other. Both Passport strategies (`jwt-access`, `jwt-refresh`) re-load the `User` on every request; `@CurrentUser()` injects that entity. Passwords are hashed with bcrypt at cost 15 (`shared/utils/hash.util.ts`), so sign-up and sign-in take noticeable time.

**Users (`modules/user`).** `User` (`users` table): `id` (uuid), `name`, `username`, `email`, `password` (`select: false`; `findForAuth` selects it explicitly), plus timestamps. Usernames and emails are trimmed and lowercased on write and on lookup, so both are unique case-insensitively. Duplicates return 409. `GET users/me` returns the current user.

**Chat (`modules/chat`).**
- **Tables:** `ChatRoom` (no name), `ChatMember` (room ↔ user, unique pair) and `ChatMessage` (`sender`, `type`: `text` | `photo` | `video`, `status`: `sent` | `read`, `text`, `file*` columns). All routes are under `chat/` and require membership. A non-member gets 404, not 403.
- **Rooms:** `POST chat/rooms {memberIds}` always adds the creator. Every ID must be an existing user, and there must be at least one other member. There is no dedupe of 1:1 rooms and no add/remove-member route. `GET chat/rooms` is paginated and ordered by `updatedAt`, which is bumped on every message.
- **Sending:** `POST chat/rooms/:id/messages` takes either JSON `{text}` or multipart with an optional `file` field plus `text` as a caption. The type comes from the mimetype: `image/*` → photo, `video/*` → video, anything else → 400. Files go through multer `diskStorage` into `uploads/chat/<uuid><ext>` (`storage/chat-file.storage.ts` creates the folder on import, and the folder is gitignored), with a 500 MB limit (413 when exceeded). The DB stores the relative path `chat/<file>`. If the handler throws after multer has written the file, the controller deletes it.
- **Reading:** `GET chat/rooms/:id/messages` is paginated, newest first. As a side effect, it marks the other users' `sent` messages **on the returned page** as `read`. `status` is per message, not per member: in a group, the first member to read a message marks it read for everyone.
- **Files:** they're never served statically. `GET chat/messages/:id/file` checks membership and then `res.sendFile`s the file, with Range support for video.
- **Pagination:** `PaginationQuery` (`common/dto`) takes `page` (default 1) and `limit` (default 20, max 100). The response is `{data, total, page, limit, totalPages}`.
- **Realtime:** Socket.io namespace `/chat` (`ChatGateway`). It authenticates with an access token from `handshake.auth.token` or an `Authorization: Bearer` header; the global HTTP guard doesn't cover it. On connect, a socket joins `user:<id>` and `room:<id>` for each of its rooms. All server→client events are emitted from the HTTP controller after the DB write:
  - `room`: a new room; the members' sockets are joined to it.
  - `message`: a new message, sent to everyone in the room, including the sender.
  - `read`: `{roomId, readerId, messageIds}`.

  There are no client→server events. Sending goes through REST.

**VPN provisioning (`modules/core`, `modules/crypt`, `modules/system`).**
- `modules/core` owns `POST /connection` (`ConnectionController` → `ConnectionService.connect`). `AppController` only serves the `GET /` health check, which is `@Public()`. `/connection` requires an access token, and the user is the JWT's user (`User.id` is used as the cache key).
- `CryptService.generateKeys()` creates x25519 keys with Node `crypto` and strips the DER headers to the raw 32-byte base64 keys that WireGuard expects.
- `ShellService` wraps `execFile` (no shell, 10s timeout). `WgProcessService` builds `awg set wg0 peer ...` commands on top of it.
- Peer state lives only in the in-memory cache (`@nestjs/cache-manager`, `ttl: 0`), under the keys `next`, `user:ip:<id>` and `user:key:<id>`. A restart loses all mappings while the peers stay on `wg0`, and IP allocation restarts at `10.0.0.2`. Nothing checks for running past `.254`.
- On reconnect, the user's previous peer key is removed before the new one is added; the IP is kept.
- The server public key is hardcoded in the controller.

## Conventions

- ESM project (`"type": "module"`, `module: nodenext`): relative imports **must** end in `.js`. Top-level `await` is used in `main.ts`.
- oxlint treats `no-floating-promises` as an error and warns on `no-misused-spread`. Copy DTO fields explicitly; don't spread class instances.
