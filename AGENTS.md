# AGENTS.md

Guidance for agentic coding tools working in `glm-reports-backend`.
This file is derived from the current repository (`package.json`, `tsconfig.json`, `src/`, `tests/`).

## Project Snapshot
- Stack: Node.js + TypeScript + Express + Mongoose.
- Runtime entrypoint: `src/index.ts` -> `startServer()` in `src/app.ts`.
- Build output: `dist/`.
- Auth supports both cookie token (`access_token`) and Bearer token.
- Cloud Run assumptions are active (`PORT`, bind `0.0.0.0`, `/health`).

## Setup And Environment
1. Install dependencies: `npm install`
2. Required environment variables:
   - `MONGO_URI`
   - `JWT_SECRET`
   - `PORT`
3. Common optional env vars:
   - `NODE_ENV` (affects cookie flags such as `secure` and `sameSite`)
   - `METRICS_WORKER_LOCK_TTL_MS` (metrics worker overlap lock TTL)
4. Never commit secrets (`.env`, tokens, service credentials).

## Build, Lint, Test, And Run Commands

### Authoritative npm scripts
- Dev server (hot reload): `npm run dev`
- Build TypeScript: `npm run build`
- Start built server: `npm start`
- Seed admin user: `npm run seed`
- Metrics tests subset: `npm run test:metrics`
- Metrics backfill: `npm run metrics:backfill`
- Metrics stale queue runner: `npm run metrics:run`
- Metrics worker single batch: `npm run metrics:worker`
- Metrics orphan cleanup: `npm run metrics:cleanup-orphans`
- Metrics legacy cleanup: `npm run metrics:cleanup-legacy-automatico`

### Direct commands commonly used
- Type-check only: `npx tsc --noEmit`
- Run DB utility script: `npx ts-node src/config/pruebaBD.ts`
- Docker build: `docker build -f .dockerfile -t glm-reports-backend .`

### Linting status
- No lint script is configured in `package.json`.
- No ESLint config found (`.eslintrc*` or `eslint.config.*`).
- No Prettier config found (`.prettierrc*` or `prettier.config.*`).
- Do not introduce lint/format tooling unless explicitly requested.

### Test status
- Test framework: Vitest (`vitest` dependency present).
- Existing tests are currently under `tests/metrics` and `tests/controllers`.
- Default repo test script only covers metrics-related suites.

### Single-test commands (important)
- Run all tests discovered by Vitest: `npx vitest run`
- Run repository test subset script: `npm run test:metrics`
- Run a single test file:
  - `npx vitest run tests/metrics/processMetrics.compute.test.ts`
- Run multiple specific files:
  - `npx vitest run tests/metrics/processFingerprint.test.ts tests/controllers/processMetrics.controller.test.ts`
- Run a single test by name:
  - `npx vitest run tests/metrics/processMetrics.compute.test.ts -t "builds summary and preserves provided ruleSetVersion"`
- Watch mode while developing tests:
  - `npx vitest`

## Source Layout
- `src/controllers`: Express handlers and business logic.
- `src/routes`: route registration by domain.
- `src/models`: Mongoose schemas/models and hooks.
- `src/middlewares`: auth, role checks, error handling, password flow.
- `src/metrics`: KPI contracts, compute/materialization services, worker logic.
- `src/utils`: date helpers, SLA matrix/calculators, constants.
- `src/config`: DB connection and operational scripts.
- `tests/`: Vitest suites (currently metrics and metrics controller coverage).

## Code Style Guidelines

### General editing behavior
- Keep diffs minimal and task-focused.
- Avoid opportunistic refactors unless needed to deliver the requested change.
- Preserve API contracts and response shapes unless asked to change them.
- Preserve Cloud Run behavior and operational paths.

### Imports
- Use one import statement per module path.
- Group imports in this order:
  1. External packages (`express`, `mongoose`, `vitest`, etc.).
  2. Internal modules (`../models/...`, `../metrics/...`, `../utils/...`).
- Follow existing export patterns in each layer:
  - routes usually `export default router`
  - controllers/services usually named exports

### Formatting and structure
- TypeScript must compile with strict mode (`"strict": true`).
- Preserve style of touched files (quotes and spacing are mixed across repository).
- Keep semicolon/trailing-comma usage consistent with local file style.
- Do not reformat untouched code only for style preferences.
- Prefer readable blocks for non-trivial logic over compressed one-liners.

### Types
- Prefer explicit interfaces/types for request payloads and domain objects.
- Reuse shared auth types (`AuthRequest`, `JwtUserPayload`) where applicable.
- Avoid `any`; if unavoidable, keep usage local and narrow.
- Guard nullable/optional values before dereferencing.
- Keep Mongoose model typings aligned with existing patterns.

### Naming and language
- `camelCase` for variables/functions.
- `PascalCase` for types/interfaces/classes/models.
- Use descriptive handler/service names (`getProcesses`, `updateStage`, etc.).
- Preserve established domain terminology in Spanish (`preembarque`, `aduana`, `demorraje`, etc.).

### Express handlers and API responses
- Prefer async handlers with `try/catch`.
- Return early for auth/validation failures.
- Keep stable JSON patterns (commonly `{ message: "..." }`).
- Use appropriate status codes:
  - `400` validation or malformed request
  - `401` unauthenticated
  - `403` forbidden
  - `404` missing resource
  - `409` conflict/duplicate
  - `410` retired contract paths
  - `500` unexpected server error

### Error handling and logging
- Log errors with context before returning `500`.
- Never log secrets, raw tokens, or credentials.
- Use centralized middleware (`errorHandler`) where suitable.
- Keep failure messages helpful but non-sensitive.

### Domain-specific invariants
- Preserve UTC-noon normalization when persisting date-only values.
- Keep SLA/KPI calculation logic deterministic and side-effect free.
- Preserve `currentStage` progression semantics (advance-only unless explicitly requested).
- Recompute process `estado` after mutations that affect lifecycle state.

### Database and schema changes
- Favor backward-compatible schema changes unless a migration is explicitly requested.
- Do not rename/remove enum stage values without verifying downstream impact.
- Keep model hooks idempotent and predictable.

## Security And Auth Expectations
- Keep cookie-token and Bearer-token flows functional.
- Preserve cookie flags and environment-aware behavior.
- Keep role checks aligned with middleware (`requireRole("admin" | "viewer")`).

## Metrics Architecture Notes
- Materialized KPIs are stored in `process_metrics` (`src/models/processMetrics.model.ts`).
- `Process` remains the transactional/form data source.
- `automatico.cumplimientoDemorraje` is deprecated and compatibility-only.
- New KPI logic should materialize to `process_metrics`, not new fields under `automatico`.
- Runtime rules are versioned by `sla_rule_sets` and can be activated/deactivated at runtime.

## Cursor And Copilot Rule Files
- `.cursorrules`: not found.
- `.cursor/rules/`: not found.
- `.github/copilot-instructions.md`: not found.
- No additional Cursor/Copilot overlay rules are currently active in this repo.

## Agent Workflow Checklist
1. Read relevant route/controller/model/middleware/service files before editing.
2. Implement minimal changes that match existing conventions.
3. Run `npm run build` after code changes.
4. Run targeted tests (at least the affected Vitest file or suite) when behavior changes.
5. If runtime behavior changed, smoke-test `/health` and impacted endpoints.
6. In PR notes, document what you ran (`build`, specific test commands) and results.

