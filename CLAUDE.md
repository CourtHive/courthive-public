# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Mentat Orchestration (READ FIRST)

Before doing anything else, read `../Mentat/CLAUDE.md`, `../Mentat/TASKS.md`, `../Mentat/standards/coding-standards.md`, and every file in `../Mentat/in-flight/`. Mentat is the orchestration layer for the entire CourtHive ecosystem; its standards override per-repo conventions when they conflict. If you are about to start **building** (not just planning), you must claim a surface in `../Mentat/in-flight/` and run the air-traffic-control conflict check first. See the parent `../CLAUDE.md` "Mentat Orchestration" section for the full protocol.

## Project Overview

Public-facing tournament viewer for the CourtHive platform. Vanilla TypeScript — no framework. Displays published tournament data (draws, schedules, results) and supports live score updates via Socket.IO. Includes an interactive scoring practice mode (`/track` route) built on `courthive-components`' `InteractiveScoringShell`.

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

`index.html` → `src/main.ts` → `rootBlock()` DOM scaffold → `setInitialState()` → `router()` (Navigo hash-based).

### Source Layout

```
src/
  assets/        CSS and static assets
  common/        Shared context, constants
  components/    DOM components (rootBlock, controlBar, tables, scorecard, formatters)
  config/        App initialization and configuration
  functions/     Utility functions
  i18n/          Internationalization
  pages/         Route-level page renderers
    courthive/   Default/splash page
    tournament/  Single tournament view (draws, schedule, results)
    tournaments/ Tournament list
    track/       Interactive scoring practice (Phase 2)
  router/        Navigo hash-based SPA router
  services/      API clients, live updates, theme, crowd tracker
  styles/        Global CSS
  svelte/        Svelte components (scorecard)
```

### Routing

Hash-based SPA routing via **Navigo**. Routes:

- `/#/` — splash / default
- `/#/tournaments` — tournament list
- `/#/:tournamentId` — tournament view (draws, schedule, results)
- `/#/:tournamentId/:eventId` — event-scoped view
- `/#/:tournamentId/:eventId/:drawId` — draw-scoped view
- `/#/track/:tournamentId/:matchUpId` — interactive scoring practice

### Live Updates

`src/services/liveUpdates.ts` connects to the competition-factory-server via Socket.IO. Joins tournament-specific rooms. Receives `liveScore` events for real-time score display. `liveBoltScores.ts` handles INTENNSE bolt scoring events.

### Key Dependencies

| Package | Purpose |
|---|---|
| `tods-competition-factory` | Tournament data queries and type definitions |
| `courthive-components` | Shared UI components (schedule grid, scoring shell) |
| `navigo` | Hash-based SPA router |
| `tabulator-tables` | Data grid/table component |
| `socket.io-client` | Real-time server communication |

## Key Conventions

- **Package manager**: pnpm only
- **No framework**: Vanilla TypeScript — direct DOM manipulation
- **Absolute imports**: tsconfig `paths` maps `src/*` → `./src/*`
- **`noImplicitAny`**: false in tsconfig
- **`strict`**: true in tsconfig (but `strictNullChecks: false`)
- **Imports**: Sort longest-first per ecosystem standards
- **Lint discipline**: Zero warnings — fix all before deploy

## Ecosystem Standards

This repo follows CourtHive ecosystem coding standards documented in the Mentat orchestration repo at `../Mentat/standards/coding-standards.md`.
