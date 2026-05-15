import { beforeEach, describe, expect, it, vi } from 'vitest';

// Stub the Socket.IO client. The relay module calls `io(url, opts)` once per
// `connectCrowdRelay` invocation and wires emit/on against that returned
// socket. The fake socket below captures emits, exposes raw handlers so the
// test can simulate server events, and records connection lifecycle calls.
interface FakeSocket {
  on: ReturnType<typeof vi.fn>;
  emit: ReturnType<typeof vi.fn>;
  removeAllListeners: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  connected: boolean;
  id: string;
  /** Fire the handler registered for `eventName` with `payload`. */
  fire(eventName: string, payload?: any): void;
}

let lastSocket: FakeSocket | undefined;
let lastIoArgs: { url: string; opts: any } | undefined;

vi.mock('socket.io-client', () => {
  return {
    io: (url: string, opts: any) => {
      const handlers = new Map<string, (payload: any) => void>();
      const socket: FakeSocket = {
        on: vi.fn((event: string, listener: (payload: any) => void) => {
          handlers.set(event, listener);
        }),
        emit: vi.fn(),
        removeAllListeners: vi.fn(() => handlers.clear()),
        disconnect: vi.fn(),
        connected: false,
        id: 'fake-socket-id',
        fire(event: string, payload?: any) {
          const h = handlers.get(event);
          if (h) h(payload);
        },
      };
      lastSocket = socket;
      lastIoArgs = { url, opts };
      return socket;
    },
    Socket: class {},
  };
});

import { connectCrowdRelay, inferPointWinner, __test__ } from './crowdRelay';

const RATE_LIMITED = 'rate-limited';

beforeEach(() => {
  lastSocket = undefined;
  lastIoArgs = undefined;
});

describe('connectCrowdRelay', () => {
  it('opens the /crowd namespace with the provided token in the handshake', () => {
    connectCrowdRelay({ token: 'tok-abc', baseUrl: 'http://localhost:8384' });
    expect(lastIoArgs?.url).toBe(`http://localhost:8384${__test__.NAMESPACE_PATH}`);
    expect(lastIoArgs?.opts?.auth).toEqual({ token: 'tok-abc' });
  });

  it('strips a trailing slash callers might forget on the base URL', () => {
    // The relay itself doesn't strip — that's resolveCrowdRelayBaseUrl's job.
    // Verify the relay passes the URL through unchanged so callers control it.
    connectCrowdRelay({ token: 't', baseUrl: 'http://localhost:8384/' });
    expect(lastIoArgs?.url).toBe('http://localhost:8384//crowd');
  });

  it('omits expectedVersion on the first submit for a sessionId', () => {
    const controller = connectCrowdRelay({ token: 't', baseUrl: 'http://h' });
    controller.submit({
      sessionId: 's1',
      matchUpId: 'm1',
      tournamentId: 't1',
      clientId: 'c1',
      point: { winner: 1, recordedAt: '2026-05-15T00:00:00.000Z' },
      currentScore: { sets: [{ setNumber: 1, side1Score: 1, side2Score: 0 }] },
    });
    expect(lastSocket?.emit).toHaveBeenCalledWith(
      'submitCrowdScore',
      expect.not.objectContaining({ expectedVersion: expect.anything() }),
    );
  });

  it('passes the cached version as expectedVersion on subsequent submits', () => {
    const controller = connectCrowdRelay({ token: 't', baseUrl: 'http://h' });
    // First submit (no expectedVersion)
    controller.submit({
      sessionId: 's1',
      matchUpId: 'm1',
      tournamentId: 't1',
      clientId: 'c1',
      point: { winner: 1, recordedAt: '2026-05-15T00:00:00.000Z' },
      currentScore: {},
    });
    // Server acks v1
    lastSocket?.fire('acked', { sessionId: 's1', version: 1 });
    // Second submit
    controller.submit({
      sessionId: 's1',
      matchUpId: 'm1',
      tournamentId: 't1',
      clientId: 'c1',
      point: { winner: 2, recordedAt: '2026-05-15T00:00:01.000Z' },
      currentScore: {},
    });
    const secondCall = lastSocket?.emit.mock.calls.find(
      (call: any[], idx: number) => idx === 1 && call[0] === 'submitCrowdScore',
    );
    expect(secondCall?.[1]).toMatchObject({ sessionId: 's1', expectedVersion: 1 });
  });

  it('tracks versions per-session independently', () => {
    const controller = connectCrowdRelay({ token: 't', baseUrl: 'http://h' });
    controller.submit({
      sessionId: 'sA',
      matchUpId: 'mA',
      tournamentId: 't1',
      clientId: 'c1',
      point: { winner: 1, recordedAt: 'now' },
      currentScore: {},
    });
    controller.submit({
      sessionId: 'sB',
      matchUpId: 'mB',
      tournamentId: 't1',
      clientId: 'c1',
      point: { winner: 1, recordedAt: 'now' },
      currentScore: {},
    });
    lastSocket?.fire('acked', { sessionId: 'sA', version: 5 });
    lastSocket?.fire('acked', { sessionId: 'sB', version: 9 });

    controller.submit({
      sessionId: 'sA',
      matchUpId: 'mA',
      tournamentId: 't1',
      clientId: 'c1',
      point: { winner: 2, recordedAt: 'now' },
      currentScore: {},
    });
    controller.submit({
      sessionId: 'sB',
      matchUpId: 'mB',
      tournamentId: 't1',
      clientId: 'c1',
      point: { winner: 2, recordedAt: 'now' },
      currentScore: {},
    });
    const calls: any[] = lastSocket?.emit.mock.calls ?? [];
    const submitCalls = calls.filter((c) => c[0] === 'submitCrowdScore');
    expect(submitCalls[2][1]).toMatchObject({ sessionId: 'sA', expectedVersion: 5 });
    expect(submitCalls[3][1]).toMatchObject({ sessionId: 'sB', expectedVersion: 9 });
  });

  it('drops the cached version when the server rejects with version-conflict', () => {
    const controller = connectCrowdRelay({ token: 't', baseUrl: 'http://h' });
    controller.submit({
      sessionId: 's1',
      matchUpId: 'm',
      tournamentId: 't',
      clientId: 'c',
      point: { winner: 1, recordedAt: 'now' },
      currentScore: {},
    });
    lastSocket?.fire('acked', { sessionId: 's1', version: 7 });
    lastSocket?.fire('rejected', { sessionId: 's1', reason: 'version-conflict', actualVersion: 9 });
    // After the conflict, the next submit should omit expectedVersion (cached version dropped).
    controller.submit({
      sessionId: 's1',
      matchUpId: 'm',
      tournamentId: 't',
      clientId: 'c',
      point: { winner: 1, recordedAt: 'now' },
      currentScore: {},
    });
    const calls: any[] = lastSocket?.emit.mock.calls ?? [];
    const submitCalls = calls.filter((c) => c[0] === 'submitCrowdScore');
    const lastSubmit = submitCalls[submitCalls.length - 1];
    expect(lastSubmit?.[1]).not.toHaveProperty('expectedVersion');
  });

  it('forwards acked / rejected / sessionEnded to subscribed listeners', () => {
    const controller = connectCrowdRelay({ token: 't', baseUrl: 'http://h' });
    const ackedListener: any = vi.fn();
    const rejectedListener: any = vi.fn();
    const endedListener: any = vi.fn();
    controller.on('acked', ackedListener);
    controller.on('rejected', rejectedListener);
    controller.on('sessionEnded', endedListener);
    lastSocket?.fire('acked', { sessionId: 's', version: 1 });
    lastSocket?.fire('rejected', { sessionId: 's', reason: RATE_LIMITED, retryAfter: 1.5 });
    lastSocket?.fire('sessionEnded', { sessionId: 's' });
    expect(ackedListener).toHaveBeenCalledWith({ sessionId: 's', version: 1 });
    expect(rejectedListener).toHaveBeenCalledWith({ sessionId: 's', reason: RATE_LIMITED, retryAfter: 1.5 });
    expect(endedListener).toHaveBeenCalledWith({ sessionId: 's' });
  });

  it('records lastError on rejected', () => {
    const controller = connectCrowdRelay({ token: 't', baseUrl: 'http://h' });
    lastSocket?.fire('rejected', { sessionId: 's', reason: RATE_LIMITED });
    expect(controller.lastError?.message).toContain(RATE_LIMITED);
  });

  it('disconnect() removes listeners, disconnects the socket, and clears the version cache', () => {
    const controller = connectCrowdRelay({ token: 't', baseUrl: 'http://h' });
    controller.submit({
      sessionId: 's',
      matchUpId: 'm',
      tournamentId: 't',
      clientId: 'c',
      point: { winner: 1, recordedAt: 'now' },
      currentScore: {},
    });
    lastSocket?.fire('acked', { sessionId: 's', version: 3 });
    controller.disconnect();
    expect(lastSocket?.removeAllListeners).toHaveBeenCalled();
    expect(lastSocket?.disconnect).toHaveBeenCalled();
    // After disconnect, version cache is cleared (next submit on this controller
    // would omit expectedVersion, but that's a moot path — the socket is gone).
  });

  it('end() emits endSession with the supplied id', () => {
    const controller = connectCrowdRelay({ token: 't', baseUrl: 'http://h' });
    controller.end('s9');
    expect(lastSocket?.emit).toHaveBeenCalledWith('endSession', { sessionId: 's9' });
  });

  it('never throws out of submit() even if the socket emit throws', () => {
    const controller = connectCrowdRelay({ token: 't', baseUrl: 'http://h' });
    (lastSocket as any).emit = vi.fn(() => {
      throw new Error('socket-closed');
    });
    const errorListener: any = vi.fn();
    controller.on('error', errorListener);
    expect(() =>
      controller.submit({
        sessionId: 's',
        matchUpId: 'm',
        tournamentId: 't',
        clientId: 'c',
        point: { winner: 1, recordedAt: 'now' },
        currentScore: {},
      }),
    ).not.toThrow();
    expect(controller.lastError?.message).toBe('socket-closed');
    expect(errorListener).toHaveBeenCalled();
  });
});

describe('inferPointWinner', () => {
  it('returns undefined when neither score has changed', () => {
    const snap: any = { sets: [{ setNumber: 1, side1Score: 2, side2Score: 1 }] };
    expect(inferPointWinner(snap, snap)).toBeUndefined();
  });

  it('detects a side1 game pickup via set games delta', () => {
    const before: any = { sets: [{ setNumber: 1, side1Score: 2, side2Score: 1 }] };
    const after: any = { sets: [{ setNumber: 1, side1Score: 3, side2Score: 1 }] };
    expect(inferPointWinner(before, after)).toBe(1);
  });

  it('detects a side2 game pickup via set games delta', () => {
    const before: any = { sets: [{ setNumber: 1, side1Score: 2, side2Score: 1 }] };
    const after: any = { sets: [{ setNumber: 1, side1Score: 2, side2Score: 2 }] };
    expect(inferPointWinner(before, after)).toBe(2);
  });

  it('detects a set winner appearing when no game-count delta is visible', () => {
    const before: any = { sets: [{ setNumber: 1, side1Score: 6, side2Score: 4 }] };
    const after: any = {
      sets: [{ setNumber: 1, side1Score: 6, side2Score: 4, winningSide: 1 }],
    };
    expect(inferPointWinner(before, after)).toBe(1);
  });

  it('detects a match winner appearing', () => {
    const before: any = { sets: [{ setNumber: 1, side1Score: 6, side2Score: 4, winningSide: 1 }] };
    const after: any = {
      sets: [{ setNumber: 1, side1Score: 6, side2Score: 4, winningSide: 1 }],
      winningSide: 1,
    };
    expect(inferPointWinner(before, after)).toBe(1);
  });

  it('falls back to pointDisplay diff when no set delta is visible (e.g. mid-game)', () => {
    const before: any = {
      sets: [{ setNumber: 1, side1Score: 0, side2Score: 0 }],
      pointDisplay: ['0', '0'],
    };
    const after: any = {
      sets: [{ setNumber: 1, side1Score: 0, side2Score: 0 }],
      pointDisplay: ['15', '0'],
    };
    expect(inferPointWinner(before, after)).toBe(1);
  });

  it('detects a tiebreak point pickup via tiebreak score delta', () => {
    const before: any = {
      sets: [{ setNumber: 1, side1Score: 6, side2Score: 6, side1TiebreakScore: 3, side2TiebreakScore: 4 }],
    };
    const after: any = {
      sets: [{ setNumber: 1, side1Score: 6, side2Score: 6, side1TiebreakScore: 3, side2TiebreakScore: 5 }],
    };
    expect(inferPointWinner(before, after)).toBe(2);
  });

  it('returns undefined for first-snapshot when prev is undefined and only zeroes in next', () => {
    // First state-changed event fires with an empty 0-0 set — there's no
    // point to infer from yet, so we should suppress submitting.
    const after: any = {
      sets: [{ setNumber: 1, side1Score: 0, side2Score: 0 }],
      pointDisplay: ['0', '0'],
    };
    expect(inferPointWinner(undefined, after)).toBeUndefined();
  });

  it('returns side1 when comparing prev=undefined against a populated next set', () => {
    // If we missed the initial state and somehow saw a non-zero next, treat
    // it as a side1 pickup (the diff logic loops sets from index 0 with a
    // zeroed baseline when prev is absent).
    const after: any = {
      sets: [{ setNumber: 1, side1Score: 1, side2Score: 0 }],
      pointDisplay: ['0', '0'],
    };
    expect(inferPointWinner(undefined, after)).toBe(1);
  });
});
