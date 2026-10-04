import { describe, expect, it } from 'vitest';

import { computeScheduleSearch, shouldShowActiveStrip, todayIso } from './scheduleGridState';

const TODAY = '2026-09-01';

describe('todayIso', () => {
  it('formats the LOCAL calendar day, zero-padded', () => {
    // Local components, deliberately: constructed from local parts so the
    // assertion means the same thing under any TZ the suite runs in.
    expect(todayIso(new Date(2026, 8, 1, 23, 30))).toBe(TODAY);
    expect(todayIso(new Date(2026, 11, 25, 0, 5))).toBe('2026-12-25');
  });
});

describe('shouldShowActiveStrip', () => {
  it('shows the strip on today', () => {
    expect(shouldShowActiveStrip({ scheduledDate: TODAY, today: TODAY })).toBe(true);
  });

  it('hides the strip on any other date — past or future', () => {
    expect(shouldShowActiveStrip({ scheduledDate: '2026-08-31', today: TODAY })).toBe(false);
    expect(shouldShowActiveStrip({ scheduledDate: '2026-09-02', today: TODAY })).toBe(false);
  });

  it('hides the strip when there is no date at all', () => {
    expect(shouldShowActiveStrip({ scheduledDate: undefined, today: TODAY })).toBe(false);
    expect(shouldShowActiveStrip({ scheduledDate: '', today: TODAY })).toBe(false);
  });
});

describe('computeScheduleSearch', () => {
  const matchUps = [
    { matchUpId: 'a', sides: [{ participant: { participantName: 'Ada Lovelace' } }, {}] },
    { matchUpId: 'b', sides: [{ participant: { participantName: 'Alan Turing' } }, {}] },
    { matchUpId: 'c', sides: [{}, {}] },
  ];

  it('is inactive with no search, and matches nothing', () => {
    const outcome = computeScheduleSearch({ matchUps, search: '' });
    expect(outcome.active).toBe(false);
    expect(outcome.matchCount).toBe(0);
    expect(outcome.matchedIds.size).toBe(0);
  });

  it('collects the ids that match', () => {
    const outcome = computeScheduleSearch({ matchUps, search: 'ada' });
    expect(outcome.active).toBe(true);
    expect(outcome.matchCount).toBe(1);
    expect([...outcome.matchedIds]).toEqual(['a']);
  });

  it('reports an active search with zero hits — the caller shows the notice', () => {
    const outcome = computeScheduleSearch({ matchUps, search: 'grace' });
    expect(outcome.active).toBe(true);
    expect(outcome.matchCount).toBe(0);
  });

  it('survives an empty or undefined matchUp list', () => {
    expect(computeScheduleSearch({ matchUps: [], search: 'ada' }).matchCount).toBe(0);
    expect(computeScheduleSearch({ matchUps: undefined as any, search: 'ada' }).matchCount).toBe(0);
  });
});
