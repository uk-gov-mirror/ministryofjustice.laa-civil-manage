# LAA Civil Manage

[![Ministry of Justice Repository Compliance Badge](https://github-community.service.justice.gov.uk/repository-standards/api/laa-civil-manage/badge?style=flat)](https://github-community.service.justice.gov.uk/repository-standards/laa-civil-manage)

LAA Civil Manage is an LAA Manage service built with **Express**, **TypeScript**, **GOV.UK Frontend**, and **Bun**.
It provides a frontend to allow users to add Prior Authority to existing applications for Civil Legal Aid. Backend code can be found in the [laa-civil-manage-api](https://github.com/ministryofjustice/laa-civil-manage-api) repository.
This repository is based on the LAA Express TypeScript template and includes:

- Express routes and controllers
- Nunjucks view templates
- GOV.UK Design System components
- CSRF protection, rate limiting, and session management
- Unit tests and Playwright accessibility/browser tests

## Table of Contents

- [Requirements](#requirements)
- [Getting Started](#getting-started)
- [Environment](#environment)
- [Scripts](#scripts)
- [Testing](#testing)
- [Security headers and CSP](#security-headers-and-csp)
- [Health checks and system alerts](#health-checks-and-system-alerts)
- [Docker](#docker)
- [Project structure](#project-structure)
- [License](#license)

## Requirements

- Bun `>=1.2.0`
- Node-compatible environment for Bun
- Redis (for sessions when running in Docker or using `SESSION_REDIS_URL`)

## Getting Started

### Install dependencies

```bash
mise install

mise run install
```

### Set up environment variables

Create your `.env` file from the template if provided:

```bash
cp .env.example .env
```

At minimum, configure:

```env
SESSION_SECRET=your-secret-value
SESSION_NAME=sessionId
```

Other useful environment variables:

```env
PORT=3000
NODE_ENV=development
DEPARTMENT_NAME=Legal Aid Agency
SERVICE_NAME=Manage Your Civil Application
SERVICE_PHASE=Alpha
ENABLE_HTTPS_ENFORCEMENT=false
AUTH_CLIENT_ID=your-client-id
AUTH_DIRECTORY_URL=https://login.microsoftonline.com/<tenant>
AUTH_CLIENT_SECRET=your-client-secret
AUTH_REDIRECT_URL=http://localhost:3000/auth/redirect
SESSION_REDIS_URL=redis://localhost:6379
RATE_LIMIT_MAX=100
RATE_WINDOW_MS=900000
SKIP_AUTH=true
```

### Development

Run the app in development mode with file watching:

```bash
mise dev
```

Open http://localhost:3000

### Production build

```bash
mise build
bun run start
```

## Scripts

Preferred commands are available through `mise`.

- `mise dev` - watch source files and run the server in development
- `mise build` - clean and bundle the app into `public/index.js`
- `bun run start` - run the built production bundle
- `mise lint` - run ESLint and fix issues
- `mise lint_check` - run ESLint in check-only mode
- `mise format` - format code with Prettier
- `mise format_check` - check formatting with Prettier
- `mise test` - run unit tests and Playwright tests
- `mise test_unit` - run unit tests
- `mise test_playwright` - run Playwright tests
- `bun run security:zap:ci` - run ZAP CI scan
- `bun run security:zap:local` - run local ZAP scan
- `bun run deploy` - run the repo deploy script

## Git hooks

This repository uses Lefthook to run Git hooks.

- `pre-commit`: `bunx lint-staged` (formats and lints staged JS/TS files)
- `pre-push`: `bun run test:unit` and `bun run test:playwright`

Install hooks after dependencies are installed:

```bash
bun run prepare
```

If `git` is not available (for example in minimal Docker build images), `prepare` will skip hook installation.

## Testing

### Unit tests

```bash
mise test_unit
```

### Playwright tests

```bash
mise test_playwright
```

### Accessibility and standards

This repo includes accessibility-focused Playwright tests under `tests/playwright` and security scanning scripts under `deploy/scripts/zap`.

## Security headers and CSP

This service uses [Helmet](https://helmetjs.github.io/) in `src/utils/setupHelmet.ts` to set secure HTTP response headers by default.

### What this means in practice

- A **Content Security Policy (CSP)** is sent on every response.
- Each response gets a random nonce (`res.locals.cspNonce`).
- Nunjucks templates add this nonce to approved inline scripts using `nonce="{{ cspNonce }}"`.
- The browser only executes scripts from this app (`'self'`) or scripts with that nonce.

This significantly reduces XSS risk because injected `<script>` tags will not have the valid nonce and are blocked by the browser.

### HTTPS enforcement toggle

Helmet can also enforce HTTPS behavior via:

- `upgrade-insecure-requests` in CSP.
- `strict-transport-security` (HSTS).

This service controls those directives with `ENABLE_HTTPS_ENFORCEMENT`:

- If unset, default is based on `NODE_ENV`:
  - `NODE_ENV=production` -> enabled.
  - Any other environment -> disabled.

Recommended values:

- Production: `ENABLE_HTTPS_ENFORCEMENT=true`.
- Internal HTTP E2E environments: `ENABLE_HTTPS_ENFORCEMENT=false`.
- Local development: `ENABLE_HTTPS_ENFORCEMENT=false`.

### Rules when adding scripts or styles

- Do not load JS/CSS from public CDNs (for example, UNPKG).
- Bundle dependencies through npm/Bun and serve them from `/public/js` or `/public/css`.
- If you must use an inline `<script>`, include `nonce="{{ cspNonce }}"`.
- Prefer external script files over inline scripts where possible.
- Avoid introducing new inline styles; existing GOV.UK/MOJ template compatibility currently requires `style-src 'unsafe-inline'`.

### Quick checklist for template changes

- Any `<script>` tag has a nonce unless it is loaded from local bundled files where nonce is still preferred for consistency.
- No `<script src="https://...">` third-party script URLs.
- Any new third-party frontend library is installed as a dependency and copied/bundled into `public` during build.

## Health checks and system alerts

- **`/health`**: Pings the Redis instance backing sessions (`SESSION_REDIS_URL`). Returns `503`/`DOWN` if Redis is
  unreachable — this is what we alert on (e.g. via Pingdom).
- **`/health/liveness`, `/health/readiness`**: Kubernetes probes. These are static `200`/`UP` checks that never touch
  Redis, so Kubernetes doesn't restart or evict pods over a Redis outage it can't fix.

Note that `/health` only checks Redis, not the [laa-civil-manage-api](https://github.com/ministryofjustice/laa-civil-manage-api)
backend that every `/applications` and `/prior-authority` route depends on. This is deliberate, not an oversight —
`laa-civil-manage-api` has its own dedicated Pingdom check, so if the backend fails, only that alert fires. Combining
both dependencies into one `/health` check would mean a single backend outage triggers alerts on both services at
once. If the backend API is down, Kubernetes keeps the pod running — and `/health` will still report `UP` — even
though most of the app is unusable. Kubernetes staying calm doesn't mean the app is fully functional; it just avoids
making a bad situation worse.

See `tests/unit/controllers/healthController.spec.ts` and `tests/unit/models/healthModels.spec.ts` for tests that
document this behaviour.

## Docker

### Build the image

```bash
docker build -t laa-civil-manage:latest .
```

### Run the container

```bash
docker run -d -p 8888:3000 --env-file .env laa-civil-manage:latest
```

Then visit http://localhost:8888

### Docker Compose

There is also a local `docker-compose.yaml` that starts the app with Redis.

```bash
docker compose up --build
```

By default, the app is mapped to `http://localhost:8888`.

## Project structure

- `src/` - application source code
  - `app.ts` - Express application setup
  - `index.ts` - application startup entrypoint
  - `controllers/` - route controllers
  - `middleware/` - middleware, session, auth, validation
  - `routes/` - Express router definitions
  - `views/` - Nunjucks templates
  - `models/` - data models
  - `utils/` - helpers and setup utilities
- `public/` - built and static assets
- `tests/` - unit and browser tests
- `deploy/` - deployment and ZAP security scripts
- `Dockerfile` - container build instructions
- `docker-compose.yaml` - local compose setup

## Notes

- `SESSION_SECRET` and `SESSION_NAME` are required by the app.
- Set `SKIP_AUTH=true` to disable auth for local development and testing.
- The app uses Bun as both the package manager and runtime.
- Production mode is enabled by setting `NODE_ENV=production`.

## License

This project is licensed under the [MIT License](./LICENSE).
