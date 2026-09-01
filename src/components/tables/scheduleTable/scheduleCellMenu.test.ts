import { describe, expect, it, vi } from 'vitest';

// The module pulls in the router (Navigo + every page renderer) and
// courthive-components, neither of which loads in this repo's no-DOM vitest
// environment. Only the pure model is under test here; the navigation itself is
// covered by an e2e journey.
vi.mock('courthive-components', () => ({}));
vi.mock('src/router/router', () => ({ navigateToTournamentPath: () => undefined }));
vi.mock('src/components/scoringLaunchMenu', () => ({ openScoringLaunchMenu: () => Promise.resolve() }));
vi.mock('src/i18n/i18n', () => ({ t: (key: string) => key }));

import { buildScheduleCellMenuModel } from './scheduleCellMenu';

const MENS_SINGLES = "Men's Singles";

describe('buildScheduleCellMenuModel', () => {
  it('labels the cell with its event and round', () => {
    const model = buildScheduleCellMenuModel({ eventName: MENS_SINGLES, roundName: 'Quarterfinal' });
    expect(model.sectionLabel).toBe(`${MENS_SINGLES} · Quarterfinal`);
  });

  it('degrades to whichever half exists rather than emitting a stray separator', () => {
    expect(buildScheduleCellMenuModel({ eventName: MENS_SINGLES }).sectionLabel).toBe(MENS_SINGLES);
    expect(buildScheduleCellMenuModel({ roundName: 'Final' }).sectionLabel).toBe('Final');
    expect(buildScheduleCellMenuModel({}).sectionLabel).toBe('');
    expect(buildScheduleCellMenuModel({ eventName: '  ', roundName: '' }).sectionLabel).toBe('');
  });

  it('falls back to the round NUMBER when the payload carries no round name', () => {
    // Round names are policy-derived and can be renamed or localized; the
    // number is the stable thing. It is only ever a label here — nothing this
    // popover does is keyed on either.
    expect(buildScheduleCellMenuModel({ eventName: MENS_SINGLES, roundNumber: 3 }).sectionLabel).toBe(
      `${MENS_SINGLES} · R3`,
    );
    expect(buildScheduleCellMenuModel({ roundNumber: 1 }).sectionLabel).toBe('R1');
  });

  it('prefers the name when both are present, and ignores a nonsense round number', () => {
    expect(buildScheduleCellMenuModel({ roundName: 'Quarterfinal', roundNumber: 2 }).sectionLabel).toBe('Quarterfinal');
    expect(buildScheduleCellMenuModel({ eventName: MENS_SINGLES, roundNumber: 0 }).sectionLabel).toBe(MENS_SINGLES);
    expect(buildScheduleCellMenuModel({ eventName: MENS_SINGLES, roundNumber: 'x' }).sectionLabel).toBe(MENS_SINGLES);
  });

  it('can navigate only with BOTH an eventId and a drawId', () => {
    expect(buildScheduleCellMenuModel({ eventId: 'e1', drawId: 'd1' }).canNavigate).toBe(true);
    // A structureId without its draw has no addressable route.
    expect(buildScheduleCellMenuModel({ eventId: 'e1', structureId: 's1' }).canNavigate).toBe(false);
    expect(buildScheduleCellMenuModel({ drawId: 'd1' }).canNavigate).toBe(false);
    expect(buildScheduleCellMenuModel({}).canNavigate).toBe(false);
  });
});
