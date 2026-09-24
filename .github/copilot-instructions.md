# GitHub Copilot Instructions — laa-civil-manage

## 1. Before Starting Any Feature

1. **Ask for the Jira ticket ID** (`CM-XXX`) if not provided.
2. **Clarify any ambiguous requirements** before writing code.
3. **Confirm a clean baseline**: `mise test_unit` and `mise lint_check && mise format_check`.
4. **Find the nearest analogous existing feature** (e.g. `src/routes/applications.router.ts` +
   `src/controllers/applications.controller.ts`) and follow the same pattern.

## 2. Workflow — Macro-Cycle TDD (Test-First, Plan, Execute)

We strictly follow a Test-Driven Development (TDD) philosophy adapted for AI Agent workflows. For any new feature or non-trivial change, do NOT write implementation and test code simultaneously in a single turn. Follow this two-phase contract workflow:

### Phase 1: The Contract (Red Phase / Planning)

1. Acknowledge the requirement, list affected files, and outline the feature design.
2. Write the **tests first** (unit tests and/or Playwright specs). Provide the complete test blocks and assertions that define the required behavior.
3. **STOP GENERATING.** You must end your response exactly here. Ask the user explicitly: _"Does this test coverage and plan look correct?"_ Do not write a single line of implementation code until the user says "Yes".

### Phase 2: Implementation & Validation (Green Phase)

1. Once the user approves Phase 1 (or provides corrections), write the minimal production code needed to satisfy the tests.
2. **Execute Validation Commands:** Run the required terminal checks to verify tests pass and formatting is correct.
3. **Refactor & Self-Correct:** If tests or formatting checks fail, automatically fix the errors and re-run checks until green.
4. **Surgical changes only:** When modifying existing files, output only the updated methods or code blocks rather than rewriting entire files, unless requested.

### Execution Guardrails

- **Never run Git commands (commit, push, stash) unless explicitly requested.** Provide the code or run the build checks, but leave version control to the user.
- **No change should reduce test coverage.** Add tests alongside any new/changed code so overall coverage doesn't regress (see §6).
- **NEVER install a new dependency** without checking with the user first — recommend it instead.
- **Keep business/data logic out of controllers.** Controllers handle request/response only; data fetching and shaping lives in `models/` and `utils/`.
- **Views are GOV.UK Design System Nunjucks templates** — reuse existing macros/components in `src/views/` rather than hand-rolling HTML.
- **Register any new page in `src/constants.ts`'s `pages` array** so the accessibility (axe) scan in `tests/playwright/template.spec.ts` runs against it.
- **When finished**, run all checks below and update any related docs.

### Checks before completing any task

```bash
mise lint_check       # ESLint (eslint-config-love + Prettier)
mise format_check     # Prettier formatting check
mise test_unit        # Unit tests
mise test_playwright  # Playwright e2e (requires mise/docker for Redis + build)
```

### When editing existing files

- Make surgical changes only. Do not refactor unrelated code.
- Do not change test assertions without understanding why they were written that way.
- Fix linting failures — do not suppress rules unless unavoidable and justified.

If these instructions do not cover a specific case, stop and ask.

## 3. Architecture Rules

This is an **Express 5 + TypeScript + Nunjucks** server-rendered app, run on **Bun**.

- **`src/routes/`** — Express routers. Wire URL paths to controller functions only.
- **`src/controllers/`** — request/response handling: parse input, call `models/`/`utils/`, render a
  view or redirect. No direct external API calls here.
- **`src/models/`** — data-access functions (calls to the API/backing services) and their TS types.
- **`src/validation/`** — Zod schemas / validation functions for form input, one file per feature area.
- **`src/middleware/`** — Express middleware (auth, session handling, per-journey helpers).
- **`src/utils/`** — pure helper/mapper functions (e.g. `utils/mappers/`).
- **`src/views/`** — Nunjucks templates, mirroring the route/controller feature structure.
- **`src/types/`** — shared/ambient TypeScript types (e.g. Express request augmentations).
- **`src/constants.ts`** — shared constants, including the `pages` array used by the a11y test suite.

### Adding a new endpoint

1. **Phase 1 (Contract):** Write a failing unit test for the new model/controller behaviour first (TDD). Add/extend a Playwright test under `tests/playwright/`. Pause for user approval.
2. **Phase 2 (Implementation):**

- Add/extend a model function + types in `src/models/[resource]Models.ts`.
- Add a controller in `src/controllers/[resource]Controller.ts` calling the model and rendering a view.
- Add a router in `src/routes/[resource]Router.ts` and mount it in the app's route setup.
- Add a Nunjucks view under `src/views/[resource]/`.
- Add Zod validation in `src/validation/[resource]Validation.ts` if the endpoint accepts form input.
- Add any new page path to `src/constants.ts`'s `pages` array.

## 4. Coding Conventions

- TypeScript throughout, `strict: true`. Prefer explicit types on exported functions.
- Use the `#*` import alias (e.g. `#src/models/applications.models.js`) instead of relative `../../..` paths.
- Formatting/linting is enforced by Prettier + ESLint (`eslint-config-love`) — do not hand-format;
  run `mise lint` and `mise format` (or let lefthook's pre-commit hook do it).
- Only import via the `#*` alias, not relative paths that escape the current directory tree (see
  `no-restricted-imports` in `eslint.config.js`).
- Use GOV.UK Design System components/macros for all UI; avoid custom CSS/HTML where a GOV.UK Frontend
  component exists.
- **Do not add code comments.** Write self-explanatory code (clear names, small functions) instead of
  explaining it with comments. Do not add JSDoc/TSDoc blocks, inline `//` comments, or `/** */` block
  comments to any new or edited code. Never remove or alter pre-existing comments in code you are not
  otherwise touching.

### Naming

| Thing                 | Convention                                              | Example                                                                       |
| --------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Files/folders         | `camelCase`, `[resource][Layer].ts`                     | `applicationsController.ts`, `applicationsRouter.ts`, `applicationsModels.ts` |
| Classes/interfaces    | `PascalCase`                                            | `ApplicationSummary`, `PriorAuthorityDraft`                                   |
| Functions/variables   | `camelCase`                                             | `getAllApplicationsPage`, `parsePage`                                         |
| Constants             | `UPPER_SNAKE_CASE`                                      | `TRY_TWICE`                                                                   |
| URL paths             | `kebab-case`                                            | `/prior-authority/expert/document-upload`                                     |
| Unit test files       | `[name].spec.ts`                                        | `commonMiddleware.spec.ts`                                                    |
| Playwright test files | `[journey].spec.ts` under `tests/playwright/[feature]/` | `tests/playwright/priorAuthority/expert/*.spec.ts`                            |

> Note: `src/controllers/applications.controller.ts`, `src/routes/applications.router.ts`, and
> `src/models/applications.models.ts` use a dot-suffix naming style — this is an **inconsistency to
> avoid**, not the standard. New code should follow the camelCase convention above (matching
> `src/controllers/priorAuthority/**`); don't rename the existing dot-suffix files as a drive-by change.

## 5. Testing Standards

- **TDD / red-green-refactor is expected**: write the test first (it must fail for the right reason),
  implement the minimum to pass, then refactor with tests green.
- **Unit tests** (`tests/unit/`, Bun's built-in test runner): mirror the `src/` folder structure
  one-for-one. Use `*.spec.ts`. Preload env fixtures via `tests/unit/testEnv.ts` (already wired in
  `bunfig.toml`).
- **Playwright tests** (`tests/playwright/`): mirror the user journey/feature folder structure (e.g.
  `priorAuthority/expert/`). Assert on GOV.UK page structure via accessible roles (`getByRole`), not
  CSS selectors, where practical.
- **New pages must be added to `src/constants.ts`'s `pages` array** — `tests/playwright/template.spec.ts`
  iterates this list to run layout and axe accessibility checks against every page.
- Run `mise test_unit` before every commit; `mise test_playwright` before opening a PR (also runs
  automatically pre-push via lefthook and in CI).

## 6. Code Coverage

- Coverage is measured by merging **unit test coverage and Playwright coverage** (via `nyc`/istanbul —
  see `scripts/coverageTools/` and the `coverage:*` scripts in `package.json`) into a combined report.
- Current enforced thresholds (`scripts/checkCoverage.ts`, run in CI by `.github/workflows/coverage-check.yml`):
  **89% lines, 91% functions**. The combined coverage check fails the build below these.
- **No change should reduce coverage.** Add unit and/or Playwright tests alongside any new/changed code
  — don't rely on unrelated tests to keep the numbers up.
- Raise the thresholds in `scripts/checkCoverage.ts` as coverage improves; the check itself warns in CI
  when actual coverage is comfortably (5+ points) above the threshold, suggesting it be raised.
- A coverage summary is posted as a PR comment by the coverage-check workflow so reviewers can see the
  impact of a change at a glance.

## 7. Exploration

Output exploration notes and plans as a markdown file outside the repo (e.g. session workspace), not
committed to the repo.
