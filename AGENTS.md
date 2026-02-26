# AGENTS.md

Guidance for agentic coding tools working in `glm-reports-backend`.
Use this file as the repository default unless a user task overrides it.

## Project Snapshot
- Runtime: Node.js + TypeScript + Express + Mongoose.
- Package manager: npm (`package-lock.json` is committed).
- Main source tree: `src/`.
- Tests: Vitest under `tests/`.
- Build output: `dist/` (emitted by `tsc`).
- TS config highlights: `strict: true`, `module: "CommonJS"`, `target: "ES2020"`.

## Priority Instruction Files
- Checked `.cursorrules`: not present.
- Checked `.cursor/rules/`: not present.
- Checked `.github/copilot-instructions.md`: not present.
- If any of these files appear later, treat them as higher priority than this document.

## Install, Build, Run
- Install dependencies: `npm ci`
- Start dev server (ts-node-dev): `npm run dev`
- Build TypeScript: `npm run build`
- Start built server: `npm run start`
- Required env vars for normal startup: `PORT`, `MONGO_URI`, `JWT_SECRET`.
- `NODE_ENV` influences auth cookie behavior (`secure`, `sameSite`).

## Build / Lint / Test Commands

### Build
- Canonical build gate: `npm run build`
- What it does: runs `tsc` and fails on type errors.

### Lint
- No dedicated lint script exists in `package.json`.
- No repo ESLint/Prettier config is committed.
- Treat `npm run build` as the minimum static quality gate.
- Do not introduce lint/format tooling unless explicitly requested.

### Test
- Project script (metrics + controllers): `npm run test:metrics`
- Run all tests directly: `npx vitest run`
- Run one folder: `npx vitest run tests/controllers`
- Run one file: `npx vitest run tests/metrics/processFingerprint.test.ts`
- Run one test case: `npx vitest run tests/metrics/processFingerprint.test.ts -t "changes hash when relevant field changes"`
- Watch mode: `npx vitest`

## Useful Operational Scripts
- Backfill stale metrics docs: `npm run metrics:backfill`
- Drain stale queue once: `npm run metrics:run`
- Scheduler/cron worker execution: `npm run metrics:worker`
- Rebuild metric artifacts: `npm run metrics:rebuild`
- Remove orphan materialized docs: `npm run metrics:cleanup-orphans`
- Cleanup deprecated legacy field (dry-run default): `npm run metrics:cleanup-legacy-automatico`
- Worker tuning env vars: `METRICS_WORKER_BATCH_SIZE`, `METRICS_WORKER_MAX_RETRIES`, `METRICS_WORKER_RETRY_LIMIT`, `METRICS_WORKER_STUCK_MINUTES`, `METRICS_WORKER_STUCK_LIMIT`, `METRICS_WORKER_LOCK_TTL_MS`.

## Code Style and Editing Rules

### General
- Keep changes tightly scoped to the requested task.
- Preserve local style in touched files (quote style and spacing are mixed).
- Prefer straightforward, readable logic over broad abstractions.
- Use guard clauses and early returns for invalid inputs.
- Keep API response contracts stable unless a contract change is requested.

### Imports
- Use ES module syntax (`import ... from ...`).
- Group external imports before local imports.
- Use relative imports within `src/` (current repo convention).
- Avoid path aliases unless requested.
- Prefer `import type` where it prevents runtime imports.

### Formatting
- Do not mass-reformat files.
- Match semicolon/quote style in the file you are editing.
- Keep lines readable and only wrap when it improves clarity.
- Avoid adding comments unless the behavior is non-obvious.
- Keep one logical action per line in controllers/services where practical.

### TypeScript and Types
- Maintain strict-TS compatibility (`strict: true`).
- Reuse existing contracts in `*.types.ts` and `*.contract.ts`.
- Avoid new `any`; prefer `unknown` + narrowing.
- Validate nullable DB values before dereferencing.
- Keep null/undefined handling explicit in controller responses.

### Naming Conventions
- Use `camelCase` for variables and functions.
- Use `PascalCase` for interfaces, types, classes.
- Use `UPPER_SNAKE_CASE` for global constants.
- Follow filename role conventions:
- `*.controller.ts`: HTTP handlers
- `*.routes.ts`: Express route wiring
- `*.model.ts`: Mongoose schemas/models
- `*.service.ts`: domain/business logic
- `*.worker.ts`: background processing
- `*.types.ts` / `*.contract.ts`: shared contracts

### Error Handling
- Wrap async controller logic with `try/catch`.
- Return meaningful HTTP statuses (`400/401/403/404/409/410/500`).
- Log errors with concise context before returning `500`.
- Keep non-critical side effects non-blocking when write-path success matters.
- Existing non-blocking pattern: `void asyncFn().catch(...)`.

### Express and Routing
- Validate `ObjectId` params before Mongoose queries.
- Keep auth and role middleware close to route declarations.
- Preserve compatibility headers/fields already in responses.
- Keep metrics routes mounted before generic `/:id` process routes.

### Mongoose / Data Access
- Prefer atomic transitions (`findOneAndUpdate`) for queue/state changes.
- Use `.lean()` for read-only list/detail paths where document methods are not needed.
- Keep schema indexes aligned with frequent query patterns.
- Respect existing hooks and side effects in schemas.

### Date Handling
- This codebase normalizes many dates to UTC noon (`12:00:00Z`).
- Preserve UTC-noon normalization in model hooks and controller helpers.
- Avoid introducing local-time assumptions in persisted date fields.

## Metrics Domain Invariants
- Process mutations should invalidate materialized metrics (`status: "stale"`).
- Materialized queue lifecycle: `stale -> calculating -> fresh | error`.
- Retry/requeue operations must remain bounded and explicit.
- `legacy=true` runtime mode is retired and should stay retired.
- `automatico.cumplimientoDemorraje` is deprecated compatibility data; do not extend it.

## Repo-Specific Gotchas
- In `src/app.ts`, keep `/api/process/metrics/*` handlers ahead of generic process `/:id` routes.
- In process mutation flows, invalidate metrics after successful writes.
- Prefer best-effort invalidation when business writes must not fail due to metrics.
- Keep metrics payload keys stable: `contractVersion`, `ruleSetVersion`, status flags, and compatibility header usage.
- For process lists, prefer selective projections over loading entire documents.
- Do not reintroduce retired runtime branches that currently return `410`.

## Testing Expectations for Changes
- Run targeted tests first for touched behavior.
- For metrics/controller changes, run at least: `npm run test:metrics`.
- Run `npm run build` before handoff for substantial TS edits.
- If tests were not run, explicitly state that in handoff notes.

## Agent Completion Checklist
- Re-check for `.cursorrules`, `.cursor/rules/`, `.github/copilot-instructions.md`.
- Ensure behavior changes include tests or explain why tests were not added.
- Preserve backward compatibility unless the task explicitly changes contracts.
- Report command/test results briefly and note residual risks.
