import { resolveScoringLaunchHref, type ScoringLaunchContextInput } from 'src/services/scoringLaunchResolve';
import { DEFAULT_SCORING_LAUNCH, type ScoringLaunchConfig } from '@courthive/provider-config';
import { getScoringLaunchByTournament } from 'src/services/api/tournamentsApi';

/**
 * Resolves which scoring app courthive-public launches for a per-matchUp
 * "Score this match" action. The owning provider declares this via
 * `integrations.scoringLaunch` (EPIXODIC default, EMBEDDED in-page /track,
 * or EXTERNAL — e.g. IONSport — via a urlTemplate). The CFS public endpoint
 * resolves the effective config; we cache it per tournament so repeat clicks
 * are instant and always fall back to EPIXODIC when anything is unavailable.
 *
 * Pure href resolution lives in `scoringLaunchResolve.ts` (DOM/API-free).
 */

const configCache = new Map<string, ScoringLaunchConfig>();

export async function fetchScoringLaunch(tournamentId: string): Promise<ScoringLaunchConfig> {
  if (!tournamentId) return DEFAULT_SCORING_LAUNCH;
  const cached = configCache.get(tournamentId);
  if (cached) return cached;
  try {
    const response = await getScoringLaunchByTournament({ tournamentId });
    const config = (response?.data?.scoringLaunch as ScoringLaunchConfig) ?? DEFAULT_SCORING_LAUNCH;
    configCache.set(tournamentId, config);
    return config;
  } catch {
    return DEFAULT_SCORING_LAUNCH;
  }
}

/** Warm the cache early (e.g. on event render) so the menu opens instantly. */
export function prefetchScoringLaunch(tournamentId: string): void {
  void fetchScoringLaunch(tournamentId);
}

/** Navigate to a resolved launch target — in-app for EMBEDDED, new tab otherwise. */
export function launchScoring(config: ScoringLaunchConfig, ctx: ScoringLaunchContextInput): void {
  const { href, internal } = resolveScoringLaunchHref(config, ctx);
  if (internal) {
    globalThis.location.hash = href;
  } else {
    globalThis.open(href, '_blank', 'noopener');
  }
}
