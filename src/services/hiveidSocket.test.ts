/**
 * Unit tests for the personUpdate dispatcher in hiveidSocket.ts.
 *
 * The Socket.IO transport itself is exercised by the live PR-H tests
 * against a real CFS instance. Here we just verify the discriminated
 * union routes correctly to listeners, exception isolation works, and
 * unsubscription stops further calls.
 */
import { describe, expect, it } from 'vitest';
import {
  handlePersonUpdate,
  onPersonUpdate,
  type PersonUpdateEvent,
} from './hiveidSocket';

describe('hiveidSocket personUpdate dispatcher', () => {
  it('fans an event out to every registered listener', () => {
    const received: PersonUpdateEvent[][] = [[], []];
    const unsubA = onPersonUpdate((e) => received[0].push(e));
    const unsubB = onPersonUpdate((e) => received[1].push(e));
    try {
      const event: PersonUpdateEvent = {
        kind: 'merged',
        prevPersonId: 'p-old',
        survivorPersonId: 'p-new',
        occurredAt: '2026-05-31T18:00:00Z',
      };
      handlePersonUpdate(event);
      expect(received[0]).toEqual([event]);
      expect(received[1]).toEqual([event]);
    } finally {
      unsubA();
      unsubB();
    }
  });

  it('isolates exceptions — a throwing listener does not break others', () => {
    const received: PersonUpdateEvent[] = [];
    const unsubA = onPersonUpdate(() => {
      throw new Error('first listener boom');
    });
    const unsubB = onPersonUpdate((e) => received.push(e));
    try {
      handlePersonUpdate({
        kind: 'merged',
        prevPersonId: 'p-old',
        survivorPersonId: 'p-new',
        occurredAt: 'now',
      });
      expect(received).toHaveLength(1);
      expect(received[0].kind).toBe('merged');
    } finally {
      unsubA();
      unsubB();
    }
  });

  it('unsubscribe stops further deliveries to that listener', () => {
    const received: PersonUpdateEvent[] = [];
    const unsub = onPersonUpdate((e) => received.push(e));
    handlePersonUpdate({ kind: 'merged', prevPersonId: 'a', survivorPersonId: 'b', occurredAt: '1' });
    unsub();
    handlePersonUpdate({ kind: 'merged', prevPersonId: 'a', survivorPersonId: 'b', occurredAt: '2' });
    expect(received).toHaveLength(1);
    expect(received[0].occurredAt).toBe('1');
  });

  it('discriminated union covers all four kinds today', () => {
    const received: PersonUpdateEvent[] = [];
    const unsub = onPersonUpdate((e) => received.push(e));
    try {
      handlePersonUpdate({
        kind: 'merged',
        prevPersonId: 'a',
        survivorPersonId: 'b',
        occurredAt: '1',
      });
      handlePersonUpdate({ kind: 'roster', tournamentId: 't', action: 'added', occurredAt: '2' });
      handlePersonUpdate({ kind: 'schedule', tournamentId: 't', matchUpId: 'm', occurredAt: '3' });
      handlePersonUpdate({
        kind: 'result',
        tournamentId: 't',
        matchUpId: 'm',
        winningSide: 1,
        matchUpStatus: 'COMPLETED',
        occurredAt: '4',
      });
      expect(received.map((e) => e.kind)).toEqual(['merged', 'roster', 'schedule', 'result']);
    } finally {
      unsub();
    }
  });
});
