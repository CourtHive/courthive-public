import { describe, expect, it } from 'vitest';

import { buildTournamentPath } from './tournamentPath';

describe('buildTournamentPath', () => {
  it('builds the bare tournament path', () => {
    expect(buildTournamentPath({ tournamentId: 't1' })).toBe('/tournament/t1');
  });

  it('maps tab names to their route segments', () => {
    expect(buildTournamentPath({ tournamentId: 't1', tab: 'Schedule' })).toBe('/tournament/t1/schedule');
    expect(buildTournamentPath({ tournamentId: 't1', tab: 'Events' })).toBe('/tournament/t1/events');
    expect(buildTournamentPath({ tournamentId: 't1', tab: 'Players' })).toBe('/tournament/t1/participants');
  });

  it('ignores an unknown tab and falls through to the entity chain', () => {
    expect(buildTournamentPath({ tournamentId: 't1', tab: 'Stats', eventId: 'e1' })).toBe('/tournament/t1/event/e1');
  });

  it('lets a tab win over the entity chain', () => {
    expect(buildTournamentPath({ tournamentId: 't1', tab: 'Schedule', eventId: 'e1', drawId: 'd1' })).toBe(
      '/tournament/t1/schedule',
    );
  });

  it('builds the full event → draw → structure chain', () => {
    expect(buildTournamentPath({ tournamentId: 't1', eventId: 'e1', drawId: 'd1', structureId: 's1' })).toBe(
      '/tournament/t1/event/e1/draw/d1/structure/s1',
    );
  });

  it('stops at the first missing segment', () => {
    // A structure with no drawId has no matchable route — emitting
    // `/tournament/t1/event/e1/structure/s1` would 404 into notFound.
    expect(buildTournamentPath({ tournamentId: 't1', eventId: 'e1', structureId: 's1' })).toBe(
      '/tournament/t1/event/e1',
    );
    expect(buildTournamentPath({ tournamentId: 't1', drawId: 'd1', structureId: 's1' })).toBe('/tournament/t1');
  });
});
