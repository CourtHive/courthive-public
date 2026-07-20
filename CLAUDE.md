# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Mentat Orchestration (READ FIRST)

Before doing anything else, read `../Mentat/CLAUDE.md`, `../Mentat/TASKS.md`, `../Mentat/standards/coding-standards.md`, and every file in `../Mentat/in-flight/`. Mentat is the orchestration layer for the entire CourtHive ecosystem; its standards override per-repo conventions when they conflict. If you are about to start **building** (not just planning), you must claim a surface in `../Mentat/in-flight/` and run the air-traffic-control conflict check first. See the parent `../CLAUDE.md` "Mentat Orchestration" section for the full protocol.

## Project Overview

Public-facing web app for the CourtHive platform. Vanilla TypeScript — no framework — with a few Svelte components (scorecard). Consumes the **published** `courthive-components` and `@courthive/provider-config` packages plus `tods-competition-factory` for queries/types.

Originally a read-only tournament viewer, it has grown well beyond viewing. It now covers:

- **Viewing** published tournament data (draws, schedules, results, venues, registration profile) with live score updates via Socket.IO.
- **HiveID identity** — public self-service registration, sign-in, email verification, a `/me` profile with participations, and a claim flow that links a HiveID to existing tournament participants.
- **Rankings** — provider-agnostic rankings landing and per-provider ranking tables with a ladder chart.
- **Scoring launch** — a per-matchUp "Score this match" menu that launches the provider's configured scoring app (Epixodic by default, an embedded `/track` sandbox, or an external app).
- **Crowd scoring** — anonymous local-only interactive scoring on the published bracket and in the `/track` sandbox, with an optional relay path for signed-in users.

Private package (not published to npm). Deployed as a static web app to `courthive.net/pub/`.

## Commands

```bash
pnpm install              # Install dependencies (pnpm only)
pnpm start                # Vite dev server
pnpm build                # tsc + vite production build
pnpm check-types          # tsc --noEmit
pnpm lint                 # ESLint with auto-fix
pnpm format               # Prettier on src/
pnpm test                 # Vitest (TZ=UTC, watch mode)
pnpm preview              # Preview production build
```

## Architecture

### Entry Flow

`index.html` → `src/main.ts` → `rootBlock()` DOM scaffold → `setInitialState()` → `router()` (Navigo hash-based). `rootBlock.ts` also mounts the HiveID login modal via `buildHiveIDLogin` from `courthive-components`, persists the resulting session, and reconnects the HiveID socket on boot when a session survived a reload.

### Source Layout

```
src/
  assets/        CSS and static assets
  common/        Shared context, constants (routerConstants, elementConstants)
  components/    DOM components (rootBlock, controlBar, scoringLaunchMenu, tables, formatters)
  config/        App initialization and configuration
  functions/     Utility functions
  i18n/          Internationalization (i18next)
  pages/         Route-level page renderers
    courthive/   Default/splash page
    me/          HiveID: My CourtHive, magic-link consume, email-verification landing
    rankings/    Rankings landing + per-provider rankings page (+ static fallback data)
    tournament/  Single tournament view (framework + tabs: eventTab, infoTab)
    tournaments/ Tournament list table
    track/       Interactive scoring sandbox (local-only)
  router/        Navigo hash-based SPA router
  services/      API clients, live updates, HiveID, crowd scoring, theme, provider branding
  styles/        Global CSS
  svelte/        Svelte components (scorecard)
```

### Routing

Hash-based SPA routing via **Navigo** (`src/router/router.ts`). Route names/DOM ids are in `src/common/constants/routerConstants.ts`. Navigo listens for `popstate`; the router adds a `hashchange` listener so hand-edited hashes re-resolve. Routes:

- `/#/` — splash / default
- `/#/tournaments/:providerAbbr` — provider-scoped tournament list
- `/#/rankings` — provider-agnostic rankings landing
- `/#/rankings/:providerAbbr` — per-provider rankings table
- `/#/tournament/:tournamentId` — tournament view; also `/schedule`, `/events`, `/participants` tab suffixes, and `/event/:eventId`, `/event/:eventId/draw/:drawId`, `.../structure/:structureId` deep links
- `/#/me` — HiveID "My CourtHive" profile
- `/#/hiveid/magic/:code` — magic-link sign-in consume
- `/#/verify-email/:token` — email-verification landing
- `/#/track/:tournamentId/:matchUpId` — interactive scoring sandbox (local-only, no server writes)

`updateRouteUrl()` uses `history.pushState` to sync the URL without re-triggering handlers.

### Live Updates

`src/services/liveUpdates.ts` connects to the server's **`/public`** Socket.IO namespace (localhost `:8383`, else `https://courthive.net`, overridable via `window.dev.baseURL`). It emits `joinTournament` / `leaveTournament` for per-tournament rooms and is a read-only listener — the public viewer never sends mutations. Events consumed:

- `publicUpdate` — with `type: 'matchUpUpdate'` (patch matchUps in place), `type: 'publishChange'` (re-check publish state; navigate away on full unpublish, else refresh the active tab), or unknown (full re-fetch).
- `liveScore` — a compact `PublicLivePayload` (see `publicLiveTypes.ts`) from the server's public-live projector, produced on every bolt-history upsert.

`src/services/liveBoltScores.ts` is the in-memory store for `liveScore` payloads (one entry per `matchUpId`). It re-broadcasts each payload as a **`liveBoltScoreUpdated`** DOM `CustomEvent` on `window` so views can subscribe without coupling to the socket.

### HiveID Identity, Registration & Claim

Public-side identity is separate from the admin `tmxToken`. `src/services/hiveidSession.ts` stores the session under the `hiveidSession` localStorage key (shape emitted by `buildHiveIDLogin`'s `hiveid:authenticated` event). `src/services/hiveidApi.ts` is the CFS surface (base URL resolved like `liveUpdates`) and wraps the `/auth/hiveid/*` endpoints:

- `GET /auth/hiveid/me` — refresh cached canonical person fields (picks up merge-driven rewrites).
- `POST /auth/hiveid/resend-verification`, `POST /auth/verify-email` — email verification (`renderVerifyEmail.ts`).
- `GET /auth/hiveid/me/participations` — participations list shown on `/me`.
- `GET /auth/hiveid/me/claimable/:tournamentId` then `POST /auth/hiveid/me/claim` — the tournament-scoped claim flow, which fires the `addPersonOtherId` factory mutation to link a HiveID to an existing participant.

Registration itself no longer touches CFS: submit + existing-check go directly to the courthive-declarations service via `src/services/declarationsApi.ts` (see below). The former `/me/registrations` CFS intake was retired.

`src/services/hiveidSocket.ts` opens an authenticated connection to the CFS **`/hiveid`** namespace and dispatches **`personUpdate`** events discriminated by `kind` (`merged` / `roster` / `schedule` / `result`). `renderMyCourtHive.ts` (`/#/me`) subscribes via `onPersonUpdate`; on a `merged` event it refetches `/me` so canonical-person merges reflect immediately (with re-entrance guarding and self-cleanup when the container is detached).

Public registration UI: the tournament Info tab shows a CTA (`registrationButton.ts`) gated by the pure-logic `registrationEligibility.ts` (`hidden` / `sign-in-required` / `not-yet-open` / `closed` / `already-registered` / `open`). The actionable "Register" state navigates to the canonical `/#/register/:tournamentId` page (`renderProposalRegistration.ts`), which owns event selection, consent, inline account creation, and the declarations submit. The Info-tab existing-registration check reads the person's snapshot from the declarations service, scoped by the tournament's owning provider (`parentOrganisation.organisationId`).

### Rankings

`src/pages/rankings/renderRankingsLanding.ts` (`/#/rankings`) lists available ranking bundles so callers don't have to deep-link a provider abbreviation; today the service returns a single BOBOCA bundle. `renderRankingsPage.ts` (`/#/rankings/:providerAbbr`) renders the per-provider table and a ladder chart (`buildLadderChart` from `courthive-components`). Both fetch `/api/rankings/bundle` through the CFS rankings proxy (courthive.net → CFS → loopback rankings service); `renderRankingsPage` falls back to the baked-in static `data/boboca-rankings.json` when the proxy is unreachable (local dev / last resort). Points-per-round mapping and rung labels are BASIC-policy defaults defined in the page.

### Scoring Launch

`src/components/scoringLaunchMenu.ts` renders a floating "Score this match" popover (anchored at the click, `--chc-*` themed) wired into `pages/tournament/tabs/eventTab/renderEvent.ts`. `src/services/scoringLaunch.ts` fetches the provider's effective `integrations.scoringLaunch` config from the CFS public endpoint (cached per tournament, `DEFAULT_SCORING_LAUNCH` fallback). `scoringLaunchResolve.ts` is the pure href resolver: `EMBEDDED` → in-app `#/track/...`, `EPIXODIC` (default) → the Epixodic SPA (`VITE_EPIXODIC_URL` or sibling `/epixodic/`), `EXTERNAL` → the provider's `urlTemplate` (falling back to Epixodic if malformed). `launchScoring` navigates in-app for EMBEDDED and opens a new tab otherwise.

### Crowd Scoring (Track sandbox + inline bracket)

`/#/track/:tournamentId/:matchUpId` (`pages/track/renderTrackPage.ts`) builds an interactive scoring shell from `courthive-components`. `src/services/crowdTracker.ts` persists sessions to a local IndexedDB store (`courthive-public-crowd-tracker`) keyed by `tournamentId:matchUpId` — Phase 2 is anonymous and local-only; nothing leaves the device. `src/services/inlineCrowdScoring.ts` adds the same local scoring inline on the published bracket (mirrors TMX's inline-scoring wrappers but routes callbacks to `crowdTracker` instead of the mutation pipeline). `src/services/crowdRelay.ts` is a `/crowd` Socket.IO client (separate from `/public`) that relays crowd scores to the score-relay service for signed-in users (`submitCrowdScore` / `acked` / `rejected` / `endSession`).

### Venues & Provider Branding

`pages/tournament/tabs/infoTab/renderVenues.ts` renders venue cards (`buildVenueCard` / `mapVenueToCardData` from `courthive-components`) with website links. `src/services/providerBranding.ts` applies a `ProviderBranding` payload (from the CFS branding endpoint, keyed by tournamentId) — theme tokens become inline custom properties on `documentElement` and `stylesheetUrl` becomes a `<link id="chp-provider-theme">`; idempotent on tournament switch, resets to bundled defaults on `undefined`.

### Key Dependencies

| Package | Purpose |
|---|---|
| `tods-competition-factory` | Tournament data queries and type definitions |
| `courthive-components` | Shared UI (HiveID login, scoring shell, inline scoring, ladder chart, venue cards, menu) |
| `@courthive/provider-config` | Provider config types + scoring-launch resolution (`DEFAULT_SCORING_LAUNCH`, `resolveScoringLaunchUrl`) |
| `navigo` | Hash-based SPA router |
| `tabulator-tables` | Data grid/table component |
| `socket.io-client` | Real-time server communication (`/public`, `/hiveid`, `/crowd`) |
| `svelte` | Scorecard components |
| `i18next` | Internationalization |

## Key Conventions

- **Package manager**: pnpm only
- **No framework**: Vanilla TypeScript — direct DOM manipulation (plus a few Svelte components)
- **Consumes published packages**: `courthive-components` and `@courthive/provider-config` come from the registry — changes there must be published and the dep bumped before they reach this repo
- **Absolute imports**: tsconfig `paths` maps `src/*` → `./src/*`
- **`noImplicitAny`**: false in tsconfig
- **`strict`**: true in tsconfig (but `strictNullChecks: false`)
- **Imports**: Sort longest-first per ecosystem standards
- **Theming**: colors driven from `--chc-*` / `--sp-*` tokens for both light and dark — no hardcoded light-mode fallbacks
- **Lint discipline**: Zero warnings — fix all before deploy

## Ecosystem Standards

This repo follows CourtHive ecosystem coding standards documented in the Mentat orchestration repo at `../Mentat/standards/coding-standards.md`.
