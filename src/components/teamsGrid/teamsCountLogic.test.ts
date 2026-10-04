import { describe, expect, it } from 'vitest';
import { computeTeamCounts, indexIndividualsByTeamName } from './teamsCountLogic';

const individual = (
  id: string,
  teamName: string,
  role?: string,
): any => ({
  participantId: id,
  participantType: 'INDIVIDUAL',
  participantRole: role,
  person: {
    biographicalInformation: {
      teamAttributes: [{ teamName }],
    },
  },
});

describe('indexIndividualsByTeamName', () => {
  it('groups INDIVIDUAL participants by their teamAttributes teamName', () => {
    const participants = [
      individual('p1', 'Altitude'),
      individual('p2', 'Altitude'),
      individual('p3', 'Freeze'),
    ];
    const index = indexIndividualsByTeamName(participants);
    expect(index.get('Altitude')).toHaveLength(2);
    expect(index.get('Freeze')).toHaveLength(1);
  });

  it('ignores participants without a teamAttributes teamName', () => {
    const participants = [
      individual('p1', 'Altitude'),
      { participantId: 'p2', participantType: 'INDIVIDUAL', person: {} },
    ];
    expect(indexIndividualsByTeamName(participants).get('Altitude')).toHaveLength(1);
  });

  it('ignores non-INDIVIDUAL participants (TEAM rows themselves)', () => {
    const participants = [
      individual('p1', 'Altitude'),
      {
        participantId: 't-altitude',
        participantType: 'TEAM',
        participantName: 'Altitude',
        person: { biographicalInformation: { teamAttributes: [{ teamName: 'Altitude' }] } },
      },
    ];
    const index = indexIndividualsByTeamName(participants);
    expect(index.get('Altitude')).toHaveLength(1);
    expect(index.get('Altitude')?.[0].participantId).toBe('p1');
  });
});

describe('computeTeamCounts', () => {
  const team = (id: string, name: string, rosterIds: string[]): any => ({
    participantId: id,
    participantType: 'TEAM',
    participantName: name,
    individualParticipantIds: rosterIds,
  });

  it('reports the roster count from individualParticipantIds and ignores duplicates already on the roster', () => {
    const t = team('t1', 'Altitude', ['p1', 'p2', 'p3']);
    const index = indexIndividualsByTeamName([
      individual('p1', 'Altitude'),
      individual('p2', 'Altitude'),
      // p3 is on the roster ID list but not in the index — still counted via roster ID set
      individual('p4', 'Altitude'), // not on roster — rosterExtra
    ]);
    expect(computeTeamCounts(t, index)).toEqual({ players: 4, coaches: 0, staff: 0 });
  });

  it('classifies COACH role into coaches and other non-COMPETITOR roles into staff', () => {
    const t = team('t1', 'Altitude', ['p1']);
    const index = indexIndividualsByTeamName([
      individual('p1', 'Altitude'),
      individual('p2', 'Altitude', 'COACH'),
      individual('p3', 'Altitude', 'COACH'),
      individual('p4', 'Altitude', 'MEDICAL'),
      individual('p5', 'Altitude', 'CAPTAIN'),
    ]);
    expect(computeTeamCounts(t, index)).toEqual({ players: 1, coaches: 2, staff: 2 });
  });

  it('treats missing / undefined participantRole as COMPETITOR', () => {
    const t = team('t1', 'Altitude', []);
    const index = indexIndividualsByTeamName([
      individual('p1', 'Altitude'),
      individual('p2', 'Altitude', undefined),
    ]);
    expect(computeTeamCounts(t, index)).toEqual({ players: 2, coaches: 0, staff: 0 });
  });

  it('returns all-zero counts when the team has no roster and no team-name matches', () => {
    const t = team('t1', 'Altitude', []);
    const index = indexIndividualsByTeamName([individual('p1', 'Freeze')]);
    expect(computeTeamCounts(t, index)).toEqual({ players: 0, coaches: 0, staff: 0 });
  });
});
