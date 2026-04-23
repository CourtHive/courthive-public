# courthive-public

Public-facing tournament viewer for the [CourtHive](https://courthive.com) platform. Displays published tournament data — draws, schedules, results — with real-time score updates via Socket.IO.

Built with vanilla TypeScript (no framework). Deployed as a static web app to `courthive.net/pub/`.

## Prerequisites

- Node.js >= 20
- pnpm >= 8
- A running [competition-factory-server](https://github.com/CourtHive/competition-factory-server) instance for live data

## Getting Started

```bash
pnpm install
pnpm start        # Vite dev server (opens browser)
```

## Scripts

| Command            | Description                             |
| ------------------ | --------------------------------------- |
| `pnpm start`       | Vite dev server                         |
| `pnpm build`       | Production build (`tsc` + `vite build`) |
| `pnpm preview`     | Preview production build locally        |
| `pnpm check-types` | TypeScript type check (`tsc --noEmit`)  |
| `pnpm lint`        | ESLint with auto-fix                    |
| `pnpm format`      | Prettier on `src/`                      |
| `pnpm test`        | Vitest (UTC timezone)                   |

## Routes

Hash-based SPA routing via [Navigo](https://github.com/krasimir/navigo).

| Route                               | Page                                       |
| ----------------------------------- | ------------------------------------------ |
| `/#/`                               | Splash / default                           |
| `/#/tournaments`                    | Tournament list                            |
| `/#/:tournamentId`                  | Tournament view (draws, schedule, results) |
| `/#/:tournamentId/:eventId`         | Event-scoped view                          |
| `/#/:tournamentId/:eventId/:drawId` | Draw-scoped view                           |

## Architecture

```text
src/
  components/    DOM components (tables, scorecard, formatters)
  config/        App initialization
  pages/         Route-level renderers
    courthive/   Splash page
    tournament/  Single tournament view
    tournaments/ Tournament list
    track/       Interactive scoring practice
  router/        Navigo hash-based SPA router
  services/      API clients, live updates, theme
  svelte/        Svelte components (scorecard)
  i18n/          Internationalization
  assets/        CSS, icons
```

### Live Updates

Connects to the competition-factory-server via Socket.IO, joining tournament-specific rooms. Receives `liveScore` events for real-time score display and `liveBoltScores` for INTENNSE bolt scoring.

## Key Dependencies

| Package                                                                      | Purpose                           |
| ---------------------------------------------------------------------------- | --------------------------------- |
| [tods-competition-factory](https://github.com/CourtHive/competition-factory) | Tournament data queries and types |
| [courthive-components](https://github.com/CourtHive/courthive-components)    | Shared UI components              |
| [navigo](https://github.com/krasimir/navigo)                                 | Hash-based SPA router             |
| [tabulator-tables](http://tabulator.info/)                                   | Data tables                       |
| [socket.io-client](https://socket.io/)                                       | Real-time server communication    |

## License

Private — not published to npm.
