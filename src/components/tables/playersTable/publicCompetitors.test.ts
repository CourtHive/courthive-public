import { isPublicCompetitor, publicCompetitors } from './publicCompetitors';
import { describe, expect, it } from 'vitest';

/**
 * The Players tab filtered on participantType alone, so every INDIVIDUAL reached it — including
 * officials, coaches and physios, who are INDIVIDUAL participants exactly as players are. GROUPs
 * reached it too, and a GROUP has no `person`, so it rendered as a person named after the group.
 */

const competitor = { participantId: 'p1', participantType: 'INDIVIDUAL', participantRole: 'COMPETITOR' };
const roleless = { participantId: 'p2', participantType: 'INDIVIDUAL' };
const official = { participantId: 's1', participantType: 'INDIVIDUAL', participantRole: 'OFFICIAL' };
const coach = { participantId: 's2', participantType: 'INDIVIDUAL', participantRole: 'COACH' };
const group = { participantId: 'g1', participantType: 'GROUP', participantRole: 'COACH', participantName: 'Transport Van A' };
const pair = { participantId: 'd1', participantType: 'PAIR', participantRole: 'COMPETITOR' };

describe('isPublicCompetitor', () => {
  it('admits a competitor', () => {
    expect(isPublicCompetitor(competitor)).toBe(true);
  });

  it('admits an individual carrying NO role', () => {
    // The load-bearing case. "Is COMPETITOR" would reject this and quietly empty the tab for
    // tournaments recorded before the role was universally written — which reads as a tournament with
    // no entries rather than as a bug.
    expect(isPublicCompetitor(roleless)).toBe(true);
  });

  it('rejects personnel', () => {
    expect(isPublicCompetitor(official)).toBe(false);
    expect(isPublicCompetitor(coach)).toBe(false);
  });

  it('rejects a GROUP, which has no person and rendered as one', () => {
    expect(isPublicCompetitor(group)).toBe(false);
  });

  it('rejects a PAIR — this table lists individuals', () => {
    expect(isPublicCompetitor(pair)).toBe(false);
  });

  it('rejects nothing at all without throwing', () => {
    expect(isPublicCompetitor(undefined)).toBe(false);
    expect(isPublicCompetitor({})).toBe(false);
  });
});

describe('publicCompetitors', () => {
  it('keeps competitors and role-less individuals, drops the rest', () => {
    const input = [competitor, official, group, roleless, coach, pair];
    expect(publicCompetitors(input).map((p) => p.participantId)).toEqual(['p1', 'p2']);
  });

  it('tolerates an absent list', () => {
    expect(publicCompetitors(undefined)).toEqual([]);
  });
});
