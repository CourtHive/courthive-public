import { resolveScoringLaunchHref, type ScoringLaunchContextInput } from 'src/services/scoringLaunchResolve';
import { DEFAULT_SCORING_LAUNCH, type ScoringLaunchConfig } from '@courthive/provider-config';
import { getScoringLaunchByTournament } from 'src/services/api/tournamentsApi';
import { readHiveIDSession } from 'src/services/hiveidSession';
import { mintScorerToken } from 'src/services/hiveidApi';

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

/**
 * A launch that resolves to Epixodic hands off a HiveID identity via the URL.
 * EMBEDDED stays in-app; EXTERNAL with a urlTemplate goes to the provider's own
 * app and never carries our token. Only the Epixodic path uses a scorer token.
 */
function usesScorerToken(config: ScoringLaunchConfig): boolean {
  return config.app !== 'EMBEDDED' && !(config.app === 'EXTERNAL' && !!config.urlTemplate);
}

/**
 * Obtain the short-lived, scope-narrowed scorer token to hand to Epixodic.
 * Returns undefined — launch anonymously — when there is no session, the target
 * doesn't use a token, or minting fails. We NEVER put the full session JWT in a
 * URL; only the CFS-minted `aud: 'score'` token, which grants nothing but crowd
 * attribution at the relay.
 */
async function resolveScorerToken(config: ScoringLaunchConfig, ctx: ScoringLaunchContextInput): Promise<string | undefined> {
  if (!usesScorerToken(config)) return undefined;
  if (!readHiveIDSession()?.token) return undefined;
  try {
    const minted = await mintScorerToken({ tournamentId: ctx.tournamentId, matchUpId: ctx.matchUpId });
    return minted?.token ?? undefined;
  } catch {
    return undefined;
  }
}

/** Navigate to a resolved launch target — in-app for EMBEDDED, new tab otherwise. */
export async function launchScoring(config: ScoringLaunchConfig, ctx: ScoringLaunchContextInput): Promise<void> {
  // EMBEDDED stays inside this SPA — resolve + navigate synchronously, no token.
  const embedded = resolveScoringLaunchHref(config, ctx);
  if (embedded.internal) {
    globalThis.location.hash = embedded.href;
    return;
  }

  // External targets open a new tab. Open it synchronously inside the click
  // gesture so popup blockers don't eat it, then navigate once we (maybe) have
  // a scoped scorer token. Null the opener to prevent reverse-tabnabbing.
  const win = globalThis.open('about:blank', '_blank');
  if (win) win.opener = null;

  const scorerToken = await resolveScorerToken(config, ctx);
  const { href } = resolveScoringLaunchHref(config, ctx, scorerToken);
  if (win) {
    win.location.href = href;
  } else {
    // Popup was blocked despite the synchronous open — best-effort retry.
    globalThis.open(href, '_blank', 'noopener');
  }
}
