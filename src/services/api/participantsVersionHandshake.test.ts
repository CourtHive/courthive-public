import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// tournamentsApi imports baseApi, whose module top-level reads globalThis.location.host.
const post = vi.fn();
vi.mock('src/services/api/baseApi', () => ({ baseApi: { post: (...a: any[]) => post(...a) } }));

import { clearHeldParticipants, getHeldParticipantsVersion, reconcileParticipants } from './participantsVersionStore';
import { getEventData } from './tournamentsApi';

const TOURNAMENT_ID = 't-slam-1';
const EVENT_ID = 'e-singles';
const VERSION = 'p1-3-abc123def456';
const NEXT_VERSION = 'p1-4-zzz999yyy888';

/** Non-degenerate on purpose: >1 participant, so "re-attached the right set" is a real assertion. */
const PARTICIPANTS = [
  { participantId: 'p-1', participantName: 'Alfa' },
  { participantId: 'p-2', participantName: 'Bravo' },
  { participantId: 'p-3', participantName: 'Charlie' },
];

const eventDataResponse = (payload: any) => ({ data: { eventData: { drawsData: [] }, ...payload } });

/**
 * A faithful stand-in for CFS `POST /factory/eventdata`, mirroring `factory.controller.ts`: the cached
 * payload ALWAYS carries the full participant set plus its stamp, and participants are stripped on the
 * way out only when the request proves an exact match.
 *
 * A canned response would let these tests pass with the handshake deleted — the client would simply
 * never send a stamp and the fake would omit participants anyway. Modelling the server's condition is
 * what makes the saving assertions mean something.
 */
function fakeServer({ participants, participantsVersion }: { participants: any[]; participantsVersion: string }) {
  // Bytes as the SERVER emitted them. Measuring the returned response instead would measure the
  // payload after the client re-attached its held copy — which is the same size every time, and would
  // report a saving of exactly zero no matter how well the handshake worked.
  const emittedBytes: number[] = [];
  const post = (_url: string, body: any) => {
    const clientHoldsCurrentSet = !!body?.participantsVersion && body.participantsVersion === participantsVersion;
    const payload: any = { eventData: { drawsData: [] }, participantsVersion };
    if (!clientHoldsCurrentSet) payload.participants = participants;
    emittedBytes.push(JSON.stringify(payload).length);
    return Promise.resolve({ data: payload });
  };
  return { post, emittedBytes };
}

beforeEach(() => {
  post.mockReset();
  clearHeldParticipants();
});

afterEach(() => {
  clearHeldParticipants();
});

describe('participantsVersion handshake — the fixture is non-degenerate', () => {
  it('has more than one participant, so re-attachment cannot pass by accident', () => {
    expect(PARTICIPANTS.length).toBeGreaterThan(1);
    expect(VERSION).not.toEqual(NEXT_VERSION);
  });
});

describe('ADDITIVE — a caller holding no version behaves exactly as before', () => {
  it('posts the request body unchanged, with NO participantsVersion key', async () => {
    post.mockResolvedValue(eventDataResponse({ participants: PARTICIPANTS, participantsVersion: VERSION }));

    await getEventData({ tournamentId: TOURNAMENT_ID, eventId: EVENT_ID, hydrateParticipants: false });

    // Whole-object equality, not a spot check. A "nothing else changed" claim needs a total
    // assertion — checking only that participantsVersion is absent would miss any other drift.
    // `drawsProfile` is part of the expected shape now: the caller always asks for draw stubs, and a
    // server that does not understand it returns the full payload, which the renderer detects by the
    // presence of `structures`. Still additive with respect to the HANDSHAKE, which is what the
    // assertion below pins.
    expect(post).toHaveBeenCalledWith('/factory/eventdata', {
      tournamentId: TOURNAMENT_ID,
      hydrateParticipants: false,
      drawsProfile: 'STUBS',
      eventId: EVENT_ID,
    });
    expect(Object.keys(post.mock.calls[0][1])).not.toContain('participantsVersion');
  });

  it('returns participants exactly as the server sent them', async () => {
    post.mockResolvedValue(eventDataResponse({ participants: PARTICIPANTS, participantsVersion: VERSION }));

    const response: any = await getEventData({ tournamentId: TOURNAMENT_ID, eventId: EVENT_ID });

    expect(response.data.participants).toEqual(PARTICIPANTS);
  });
});

describe('the handshake — second request proves what it holds', () => {
  it('sends the stamp held from the first response', async () => {
    post.mockResolvedValue(eventDataResponse({ participants: PARTICIPANTS, participantsVersion: VERSION }));
    await getEventData({ tournamentId: TOURNAMENT_ID, eventId: EVENT_ID });

    post.mockResolvedValue(eventDataResponse({ participantsVersion: VERSION }));
    await getEventData({ tournamentId: TOURNAMENT_ID, eventId: 'e-doubles' });

    expect(post.mock.calls[1][1]).toEqual({
      tournamentId: TOURNAMENT_ID,
      participantsVersion: VERSION,
      drawsProfile: 'STUBS',
      eventId: 'e-doubles',
    });
  });

  it('re-attaches the held participants when the server omits them', async () => {
    post.mockImplementation(fakeServer({ participants: PARTICIPANTS, participantsVersion: VERSION }).post);

    await getEventData({ tournamentId: TOURNAMENT_ID, eventId: EVENT_ID });
    const response: any = await getEventData({ tournamentId: TOURNAMENT_ID, eventId: 'e-doubles' });

    // The server really did omit them...
    expect(post.mock.calls[1][1].participantsVersion).toEqual(VERSION);
    // ...and the caller cannot tell the difference. This is the whole safety claim.
    expect(response.data.participants).toEqual(PARTICIPANTS);
  });

  it('the stamp is tournament-scoped — one hold serves every event, off strictly smaller responses', async () => {
    const server = fakeServer({ participants: PARTICIPANTS, participantsVersion: VERSION });
    post.mockImplementation(server.post);

    await getEventData({ tournamentId: TOURNAMENT_ID, eventId: EVENT_ID });
    for (const eventId of ['e-2', 'e-3', 'e-4']) {
      const warm: any = await getEventData({ tournamentId: TOURNAMENT_ID, eventId });
      // Rendered identically to the cold fetch...
      expect(warm.data.participants).toEqual(PARTICIPANTS);
    }

    // ...off strictly smaller responses. A measurement at the wire, not an assertion of intent.
    const [coldBytes, ...warmBytes] = server.emittedBytes;
    expect(server.emittedBytes).toHaveLength(4);
    for (const bytes of warmBytes) expect(bytes).toBeLessThan(coldBytes);
  });

  it('holds nothing for a DIFFERENT tournament', async () => {
    post.mockResolvedValue(eventDataResponse({ participants: PARTICIPANTS, participantsVersion: VERSION }));
    await getEventData({ tournamentId: TOURNAMENT_ID, eventId: EVENT_ID });

    await getEventData({ tournamentId: 't-other', eventId: EVENT_ID });

    expect(Object.keys(post.mock.calls[1][1])).not.toContain('participantsVersion');
  });
});

describe('FAIL-SAFE — every direction other than an exact match sends participants', () => {
  it('replaces the hold when the server sends a NEWER set', async () => {
    post.mockResolvedValue(eventDataResponse({ participants: PARTICIPANTS, participantsVersion: VERSION }));
    await getEventData({ tournamentId: TOURNAMENT_ID, eventId: EVENT_ID });

    const updated = [...PARTICIPANTS, { participantId: 'p-4', participantName: 'Delta' }];
    post.mockResolvedValue(eventDataResponse({ participants: updated, participantsVersion: NEXT_VERSION }));
    const response: any = await getEventData({ tournamentId: TOURNAMENT_ID, eventId: EVENT_ID });

    expect(response.data.participants).toEqual(updated);
    expect(getHeldParticipantsVersion(TOURNAMENT_ID)).toEqual(NEXT_VERSION);
  });

  it('does NOT serve a stale copy if participants are omitted against a mismatched stamp', () => {
    reconcileParticipants({ participants: PARTICIPANTS, participantsVersion: VERSION, tournamentId: TOURNAMENT_ID });

    // Should be unreachable via the real server, which omits only on an exact match. Asserted so a
    // future server change degrades to a refetch rather than to a draw built from replaced people.
    const resolved = reconcileParticipants({ participantsVersion: NEXT_VERSION, tournamentId: TOURNAMENT_ID });

    expect(resolved).toBeUndefined();
    expect(getHeldParticipantsVersion(TOURNAMENT_ID)).toBeUndefined();
  });

  it('never holds a participant set that arrived without a stamp', () => {
    reconcileParticipants({ participants: PARTICIPANTS, tournamentId: TOURNAMENT_ID });

    expect(getHeldParticipantsVersion(TOURNAMENT_ID)).toBeUndefined();
  });

  it('survives an error response that carries no payload at all', async () => {
    post.mockResolvedValue(undefined);

    await expect(getEventData({ tournamentId: TOURNAMENT_ID, eventId: EVENT_ID })).resolves.toBeUndefined();
  });

  it('still validates its arguments', async () => {
    await expect(getEventData({ tournamentId: '', eventId: EVENT_ID })).rejects.toThrow('Missing tournamentId');
    await expect(getEventData({ tournamentId: TOURNAMENT_ID, eventId: '' })).rejects.toThrow('missing eventId');
  });
});

describe('the hold is bounded', () => {
  it('evicts the least-recently-refreshed tournament beyond the limit', () => {
    for (const tournamentId of ['t-1', 't-2', 't-3', 't-4']) {
      reconcileParticipants({ participants: PARTICIPANTS, participantsVersion: VERSION, tournamentId });
    }

    expect(getHeldParticipantsVersion('t-1')).toBeUndefined();
    for (const tournamentId of ['t-2', 't-3', 't-4']) {
      expect(getHeldParticipantsVersion(tournamentId)).toEqual(VERSION);
    }
  });
});
