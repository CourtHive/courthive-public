# courthive-public e2e (Playwright)

Hermetic end-to-end tests for the public tournament viewer. The app is a pure
read-only API consumer, so these tests **never touch a real server**: every
`/factory/*` and `/provider/*` request is intercepted with `page.route` and
fulfilled from fixtures generated in-process by `tods-competition-factory`'s
`mocksEngine`. No CFS, Redis, or Postgres required.

## Running

```bash
pnpm exec playwright install chromium   # one-time: fetch the browser binary
pnpm test:e2e                           # headless run (Playwright manages vite)
pnpm test:e2e:ui                        # interactive UI mode
pnpm test:e2e:headed                    # headed run
```

Playwright launches the Vite dev server itself (`webServer` in
`playwright.config.ts`) on `127.0.0.1:5174`. In local runs an already-running
dev server on that port is reused; under `CI=1` a fresh one is always spawned.

## CI

`.github/workflows/ci.yml` runs on every PR and on push to `master`, in two
parallel jobs:

- **verify** — `pnpm lint`, `pnpm check-types`, `pnpm test --run`
- **e2e** — installs Chromium (`playwright install --with-deps chromium`) then
  `pnpm test:e2e` with `CI=1` (Playwright spawns its own vite). The HTML report +
  `test-results/` are uploaded as the `playwright-report` artifact.

Both jobs first strip the `link:` overrides from `pnpm-workspace.yaml` (and the
lockfile) so the runner installs the **published** factory / courthive-components
/ provider-config instead of dangling sibling symlinks. One consequence: the e2e
fixtures exercise the published `tods-competition-factory` on CI, vs the locally
linked copy in dev — keep fixture usage to stable query/mocks APIs.

## Layout

```text
e2e/
  playwright.config.ts   config + managed webServer (cwd pinned to repo root)
  helpers/
    fixtures.ts          mocksEngine → tournamentInfo / eventData payloads
    routes.ts            installApiMocks(page, fixture) — all mocks scoped to
                         the API origin so they can't shadow Vite modules
    selectors.ts         stable DOM id selectors mirroring the app constants
  journeys/
    01-splash.spec.ts          root route renders the splash page
    02-tournament-info.spec.ts title/logo/tabs hydrate from tournamentinfo
    03-events-tab.spec.ts      event selector + draw render from eventdata
    04-schedule-tab.spec.ts    Schedule tab wiring + scheduledmatchUps fetch
```

## Gotchas (learned the hard way)

- **Scope every mock to the API origin** (`http://localhost:8383`). A host-
  agnostic glob like `**/i18n/locales/**` also matches Vite's dev module URL
  (`/src/i18n/locales/en.json`); returning JSON for a module request crashes
  app boot.
- **`webServer.cwd` must be the repo root.** Playwright defaults it to the
  config's directory (`e2e/`), where vite finds no `index.html` /
  `vite.config.ts` and the readiness poll never resolves.
- **Vitest excludes `e2e/`** via `test.include` in `vite.config.ts` — the
  `*.spec.ts` files import `@playwright/test`, which throws under vitest.
