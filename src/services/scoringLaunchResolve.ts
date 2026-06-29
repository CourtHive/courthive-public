import { resolveScoringLaunchUrl, type ScoringLaunchConfig } from '@courthive/provider-config';

/**
 * Pure resolution of a provider's scoring-launch config into a concrete href.
 * Kept free of DOM/API imports so it is unit-testable under the node vitest
 * environment. The fetch/navigate glue lives in `scoringLaunch.ts`.
 */

// Where the Epixodic SPA is served. On prod/dev it is a sibling path on the
// same host (`/epixodic/`); override for local dev where Epixodic runs on its
// own port (e.g. VITE_EPIXODIC_URL=http://localhost:5174/).
export const EPIXODIC_BASE: string = import.meta.env?.VITE_EPIXODIC_URL || '/epixodic/';

export interface ScoringLaunchContextInput {
  tournamentId: string;
  matchUpId: string;
  eventId?: string;
  drawId?: string;
}

function epixodicHref(matchUpId: string): string {
  const base = EPIXODIC_BASE.endsWith('/') ? EPIXODIC_BASE : `${EPIXODIC_BASE}/`;
  return `${base}#/match/${encodeURIComponent(matchUpId)}/scoring`;
}

/**
 * Resolve the launch href for a matchUp under a given config. Returns both the
 * href and whether it stays inside the public SPA (`internal`) — EMBEDDED is an
 * in-app hash route; EPIXODIC/EXTERNAL open a separate app. A malformed EXTERNAL
 * config (no urlTemplate) falls back to EPIXODIC.
 */
export function resolveScoringLaunchHref(
  config: ScoringLaunchConfig,
  ctx: ScoringLaunchContextInput,
): { href: string; internal: boolean } {
  if (config.app === 'EMBEDDED') {
    return { href: `#/track/${ctx.tournamentId}/${ctx.matchUpId}`, internal: true };
  }
  if (config.app === 'EXTERNAL' && config.urlTemplate) {
    return { href: resolveScoringLaunchUrl(config.urlTemplate, ctx), internal: false };
  }
  return { href: epixodicHref(ctx.matchUpId), internal: false };
}
