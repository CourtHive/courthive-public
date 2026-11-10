# courthive-public

The public face of the [CourtHive](https://courthive.com) platform: published tournaments — draws,
schedules, results, venues — with live scores, plus the player's side of the platform: a HiveID account,
registration, availability, rankings, and scoring a match from the stands.

Built with vanilla TypeScript (no framework; a few Svelte components). Deployed as a static web app to
`courthive.net/pub/`. Everything it shows is a **CODES** record published from
[TMX](https://github.com/CourtHive/TMX) through the
[competition-factory-server](https://github.com/CourtHive/competition-factory-server), read with the same
[Competition Factory](https://github.com/CourtHive/competition-factory) engine that wrote it.

## What it does

- **Published tournaments** — draws (every structure, with a mobile bracket layout), the order of play
  with a Now strip, results, participants, venues and the registration profile. A tournament reveals
  itself as its organiser publishes it, and embargoed content stays hidden until its time.
- **Live scores** — results arrive as they are entered at the desk, and point-by-point scores stream from
  court-side trackers. A live score is shown as in-progress only until an official result exists.
- **HiveID** — self-service sign-up and sign-in (including magic links), email verification, and a
  _My CourtHive_ page listing the player's participations, with a claim flow that links the account to the
  player's existing tournament entries.
- **Registration** — enter a tournament's events, with consent and inline account creation; doubles
  partners are invited by email and confirm from the link.
- **Availability** — a per-day grid in which players say when they can play, gated on consent.
- **Rankings** — ranking lists per provider, with a ladder chart.
- **Team competition** — program and conference directories for dual-match seasons.
- **Scoring** — "Score this match" launches the provider's configured scoring app; spectators can also keep
  score locally on the bracket or in the `/track` sandbox, and signed-in users can relay it.

## Prerequisites

- Node.js >= 24
- pnpm
- A running [competition-factory-server](https://github.com/CourtHive/competition-factory-server) for live
  data. Account, registration, rankings and relay features call further CourtHive services; each base URL
  has a local-development override (`window.dev.*`).

## Getting Started

```bash
pnpm install
pnpm start        # Vite dev server (opens browser)
```

## Scripts

| Command            | Description                                 |
| ------------------ | ------------------------------------------- |
| `pnpm start`       | Vite dev server                             |
| `pnpm build`       | Production build (`tsc` + `vite build`)     |
| `pnpm preview`     | Preview production build locally            |
| `pnpm check-types` | TypeScript type check (`tsc --noEmit`)      |
| `pnpm lint`        | ESLint — non-mutating, fails on any warning |
| `pnpm lint:fix`    | ESLint with auto-fix (rewrites source)      |
| `pnpm format`      | Prettier on `src/`                          |
| `pnpm test`        | Vitest (UTC timezone)                       |
| `pnpm test:e2e`    | Playwright journeys (`e2e/`)                |

## Routes

Hash-based SPA routing via [Navigo](https://github.com/krasimir/navigo).

| Route                                                        | Page                                              |
| ------------------------------------------------------------ | ------------------------------------------------- |
| `/#/`                                                        | Splash                                            |
| `/#/tournaments/:providerAbbr`                               | A provider's tournaments                          |
| `/#/tournament/:tournamentId`                                | Tournament view                                   |
| `/#/tournament/:tournamentId/{events,schedule,participants}` | Tournament tab                                    |
| `/#/tournament/:tournamentId/event/:eventId[/draw/:drawId]`  | Event or draw (also `.../structure/:structureId`) |
| `/#/register/:tournamentId`                                  | Registration                                      |
| `/#/register/partner/:token`                                 | Doubles partner confirmation                      |
| `/#/me`                                                      | My CourtHive (HiveID profile)                     |
| `/#/me/availability/:providerAbbr`                           | Availability grid                                 |
| `/#/hiveid/magic/:code` · `/#/verify-email/:token`           | Magic-link sign-in · email verification           |
| `/#/rankings` · `/#/rankings/:providerAbbr`                  | Rankings landing · a provider's rankings          |
| `/#/rankings/list/:snapshotId`                               | A ranking list snapshot                           |
| `/#/programs` · `/#/program/:teamId`                         | Program directory · a program's season            |
| `/#/conferences` · `/#/conference/:slug`                     | Conference directory · a conference               |
| `/#/track/:tournamentId/:matchUpId`                          | Local scoring sandbox                             |

## Architecture

```text
src/
  common/        Shared context and constants
  components/    DOM components (tables, scorecard, scoring launch menu, formatters)
  config/        App initialization
  pages/         Route-level renderers (tournament, tournaments, me, register,
                 rankings, programs, conferences, track, splash)
  router/        Navigo hash-based SPA router
  services/      API clients, live updates, HiveID, crowd scoring, branding, theme
  svelte/        Svelte components (scorecard)
  i18n/          Internationalization
  assets/        CSS, icons
```

### Live Updates

The viewer is a read-only listener; it never sends tournament mutations. It joins per-tournament rooms on
the server's `/public` Socket.IO namespace, which delivers `publicUpdate` (matchUp patches and publish
changes) and `liveScore` events. A second connection to the score relay's `/live` namespace receives
point-by-point scores from court-side trackers; a signed-in user's crowd scores go to its `/crowd`
namespace.

Providers can brand the viewer: theme tokens and a stylesheet are applied per tournament, in light and dark
mode.

## Key Dependencies

| Package                                                                      | Purpose                                             |
| ---------------------------------------------------------------------------- | --------------------------------------------------- |
| [tods-competition-factory](https://github.com/CourtHive/competition-factory) | Tournament data queries and types                   |
| [courthive-components](https://github.com/CourtHive/courthive-components)    | Shared UI (HiveID login, scoring, charts, cards)    |
| `@courthive/provider-config`                                                 | Provider configuration types and scoring-app launch |
| [navigo](https://github.com/krasimir/navigo)                                 | Hash-based SPA router                               |
| [tabulator-tables](http://tabulator.info/)                                   | Data tables                                         |
| [socket.io-client](https://socket.io/)                                       | Real-time server communication                      |

## License

MIT — see [LICENSE](LICENSE). The viewer is an application, not a library, so it is not published to npm.
