import { describe, it, expect } from 'vitest';
import { mapParticipantResults } from './mapParticipantResults';

describe('mapParticipantResults', () => {
  const participantMap = {
    p1: { participantName: 'Alice Smith', groupName: 'Group A' },
    p2: { participantName: 'Bob Jones', groupName: 'Group B' },
  };

  it('maps basic participant result with win/loss stats', () => {
    let result: any = mapParticipantResults({
      participantResult: {
        pointsWon: 48,
        pointsLost: 35,
        gamesWon: 12,
        gamesLost: 8,
        setsWon: 2,
        setsLost: 1,
        groupOrder: 1,
      },
      drawPosition: 3,
      participantId: 'p1',
      participantMap,
    });

    expect(result.participantName).toBe('Alice Smith');
    expect(result.groupName).toBe('Group A');
    expect(result.pointsResult).toBe('48/35');
    expect(result.gamesResult).toBe('12/8');
    expect(result.setsResult).toBe('2/1');
    expect(result.order).toBe(1);
    expect(result.drawPosition).toBe(3);
    expect(result.participantId).toBe('p1');
  });

  it('defaults to 0/0 when win/loss stats missing', () => {
    let result: any = mapParticipantResults({
      participantResult: {},
      drawPosition: 1,
      participantId: 'p2',
      participantMap,
    });

    expect(result.pointsResult).toBe('0/0');
    expect(result.gamesResult).toBe('0/0');
    expect(result.setsResult).toBe('0/0');
  });

  it('calculates average variation from rating variations', () => {
    let result: any = mapParticipantResults({
      participantResult: { ratingVariation: [10, 20, 30] },
      drawPosition: 1,
      participantId: 'p1',
      participantMap,
    });

    expect(result.averageVariation).toBe(20);
  });

  it('calculates average pressure from pressure scores', () => {
    let result: any = mapParticipantResults({
      participantResult: { pressureScores: [0.5, 0.7, 0.9] },
      drawPosition: 1,
      participantId: 'p1',
      participantMap,
    });

    expect(result.averagePressure).toBe(0.7);
  });

  it('defaults averages to 0 when arrays empty', () => {
    let result: any = mapParticipantResults({
      participantResult: { ratingVariation: [], pressureScores: [] },
      drawPosition: 1,
      participantId: 'p1',
      participantMap,
    });

    expect(result.averageVariation).toBe(0);
    expect(result.averagePressure).toBe(0);
  });

  it('uses provisionalOrder when groupOrder missing', () => {
    let result: any = mapParticipantResults({
      participantResult: { provisionalOrder: 3 },
      drawPosition: 1,
      participantId: 'p1',
      participantMap,
    });

    expect(result.order).toBe(3);
  });

  it('spreads participantResult properties', () => {
    let result: any = mapParticipantResults({
      participantResult: { matchUpsWon: 2, matchUpsLost: 1 },
      drawPosition: 1,
      participantId: 'p1',
      participantMap,
    });

    expect(result.matchUpsWon).toBe(2);
    expect(result.matchUpsLost).toBe(1);
  });
});
