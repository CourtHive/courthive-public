import { resolveScoringLaunchHref } from './scoringLaunchResolve';
import { describe, it, expect } from 'vitest';

const ctx = { tournamentId: 't-1', matchUpId: 'm-1', eventId: 'e-1', drawId: 'd-1' };

describe('resolveScoringLaunchHref', () => {
  it('defaults to an external Epixodic deep-link for EPIXODIC', () => {
    const { href, internal } = resolveScoringLaunchHref({ app: 'EPIXODIC' }, ctx);
    expect(href).toBe('/epixodic/#/match/m-1/scoring');
    expect(internal).toBe(false);
  });

  it('returns an in-app /track hash route for EMBEDDED', () => {
    const { href, internal } = resolveScoringLaunchHref({ app: 'EMBEDDED' }, ctx);
    expect(href).toBe('#/track/t-1/m-1');
    expect(internal).toBe(true);
  });

  it('substitutes the EXTERNAL urlTemplate (IONSport)', () => {
    const config = { app: 'EXTERNAL' as const, urlTemplate: 'https://ionsport.app/t/${tournamentId}/m/${matchUpId}' };
    const { href, internal } = resolveScoringLaunchHref(config, ctx);
    expect(href).toBe('https://ionsport.app/t/t-1/m/m-1');
    expect(internal).toBe(false);
  });

  it('falls back to Epixodic when EXTERNAL has no urlTemplate', () => {
    const { href, internal } = resolveScoringLaunchHref({ app: 'EXTERNAL' }, ctx);
    expect(href).toBe('/epixodic/#/match/m-1/scoring');
    expect(internal).toBe(false);
  });

  it('uri-encodes the matchUpId in the Epixodic deep-link', () => {
    const { href } = resolveScoringLaunchHref({ app: 'EPIXODIC' }, { ...ctx, matchUpId: 'a/b' });
    expect(href).toBe('/epixodic/#/match/a%2Fb/scoring');
  });
});
