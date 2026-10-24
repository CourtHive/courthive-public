import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Handler = (payload?: any) => void;
const sockets: { url: string; opts: any; handlers: Map<string, Handler>; emit: any; disconnect: any }[] = [];

// URL resolution has its own tests (crowdShare.test.ts) and reads `location`, which node does not have.
vi.mock('./crowdShare', () => ({
  resolveCrowdRelayBaseUrl: () => 'http://relay.test',
  resolveCrowdRelaySocketPath: () => '/socket.io/',
}));

vi.mock('socket.io-client', () => ({
  io: (url: string, opts: any) => {
    const handlers = new Map<string, Handler>();
    const socket = {
      url,
      opts,
      handlers,
      on: vi.fn((event: string, handler: Handler) => handlers.set(event, handler)),
      emit: vi.fn(),
      removeAllListeners: vi.fn(),
      disconnect: vi.fn(),
    };
    sockets.push(socket);
    return socket;
  },
}));

import {
  __resetLiveRelayScoresForTests,
  applyLiveRelayFrame,
  connectLiveRelay,
  disconnectLiveRelay,
  getLiveRelayScore,
  LIVE_RELAY_SCORE_EVENT,
  withLiveRelayScores,
} from './liveRelayScores';

const SETS = [{ setNumber: 1, side1Score: 3, side2Score: 2 }];

beforeEach(() => {
  sockets.length = 0;
  __resetLiveRelayScoresForTests('tour-1');
});

afterEach(() => {
  disconnectLiveRelay();
});

describe('applyLiveRelayFrame', () => {
  it("stores a frame's sanitized score for its matchUp", () => {
    expect(applyLiveRelayFrame({ matchUpId: 'm1', tournamentId: 'tour-1', score: { sets: SETS } })).toBe(true);
    expect(getLiveRelayScore('m1')).toEqual({ sets: SETS });
  });

  it("ignores another tournament's frame, and frames with nothing to show", () => {
    expect(applyLiveRelayFrame({ matchUpId: 'm1', tournamentId: 'tour-2', score: { sets: SETS } })).toBe(false);
    expect(applyLiveRelayFrame({ matchUpId: 'm1', tournamentId: 'tour-1', score: { sets: [] } })).toBe(false);
    expect(applyLiveRelayFrame({ tournamentId: 'tour-1', score: { sets: SETS } })).toBe(false);
    expect(getLiveRelayScore('m1')).toBeUndefined();
  });

  it('announces the update on window so a view can re-render', () => {
    const originalWindow = (globalThis as any).window;
    const dispatchEvent = vi.fn();
    (globalThis as any).window = { dispatchEvent };
    try {
      applyLiveRelayFrame({ matchUpId: 'm1', tournamentId: 'tour-1', score: { sets: SETS } });
      expect(dispatchEvent).toHaveBeenCalledTimes(1);
      const event = dispatchEvent.mock.calls[0][0];
      expect(event.type).toBe(LIVE_RELAY_SCORE_EVENT);
      expect(event.detail).toEqual({ matchUpId: 'm1' });
    } finally {
      (globalThis as any).window = originalWindow;
    }
  });
});

describe('withLiveRelayScores', () => {
  it('overlays live scores, except on matchUps the visitor is scoring themselves', () => {
    applyLiveRelayFrame({ matchUpId: 'm1', tournamentId: 'tour-1', score: { sets: SETS } });
    applyLiveRelayFrame({ matchUpId: 'm2', tournamentId: 'tour-1', score: { sets: SETS } });
    const own = { matchUpId: 'm2' };
    const [m1, m2, m3]: any[] = withLiveRelayScores([{ matchUpId: 'm1' }, own, { matchUpId: 'm3' }], new Set(['m2']));
    expect(m1.matchUpStatus).toBe('IN_PROGRESS');
    expect(m2).toBe(own);
    expect(m3.liveTracked).toBeUndefined();
  });
});

describe('connectLiveRelay', () => {
  it('opens /live and subscribes to the tournament on every connect', () => {
    connectLiveRelay('tour-9');
    expect(sockets).toHaveLength(1);
    expect(sockets[0].url).toBe('http://relay.test/live');
    expect(sockets[0].opts.path).toBe('/socket.io/');
    sockets[0].handlers.get('connect')!();
    sockets[0].handlers.get('connect')!(); // a reconnect re-subscribes: the relay replays current scores
    expect(sockets[0].emit).toHaveBeenCalledTimes(2);
    expect(sockets[0].emit).toHaveBeenCalledWith('subscribe:tournament', 'tour-9');
  });

  it('feeds score frames into the store', () => {
    connectLiveRelay('tour-9');
    sockets[0].handlers.get('score')!({ matchUpId: 'm7', tournamentId: 'tour-9', score: { sets: SETS } });
    expect(getLiveRelayScore('m7')).toEqual({ sets: SETS });
  });

  it('is a no-op for the tournament already connected, and replaces the socket for a new one', () => {
    connectLiveRelay('tour-9');
    connectLiveRelay('tour-9');
    expect(sockets).toHaveLength(1);
    connectLiveRelay('tour-10');
    expect(sockets).toHaveLength(2);
    expect(sockets[0].disconnect).toHaveBeenCalled();
  });

  it('forgets every score on disconnect', () => {
    connectLiveRelay('tour-9');
    sockets[0].handlers.get('score')!({ matchUpId: 'm7', tournamentId: 'tour-9', score: { sets: SETS } });
    disconnectLiveRelay();
    expect(getLiveRelayScore('m7')).toBeUndefined();
  });
});
