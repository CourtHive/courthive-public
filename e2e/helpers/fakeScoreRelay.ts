/**
 * A stand-in for the score-relay's `/live` namespace, so a journey can push live score frames into the app's real
 * socket.io client without a relay process (CI has none) and without reaching a real one (a dev box may run one).
 *
 * The app reaches the relay at `ws://localhost:8384/socket.io/` (websocket transport only) when served from
 * 127.0.0.1 — see `resolveCrowdRelayBaseUrl`. This answers the engine.io open and the `/live` namespace connect on
 * that socket, records the tournament the app subscribes to, and pushes `score` frames.
 *
 * ORDER MATTERS: install BEFORE the first `page.goto`. engine.io-client captures `globalThis.WebSocket` when its
 * module loads, and Playwright routes a websocket by patching that constructor; installed after the app has loaded,
 * the route never sees the app's socket.
 *
 * Wire format: engine.io v4 packets over the websocket (`0` open, `4` message); socket.io v5 packets inside a message
 * (`0` connect, `2` event), namespaced as `/live,`. So a `/live` event is `42/live,[...]`.
 */
import type { Page, WebSocketRoute } from '@playwright/test';

export interface FakeScoreRelay {
  /** The tournamentId the app last subscribed to — poll it: `expect.poll(() => relay.subscribedTo())`. */
  subscribedTo: () => string | undefined;
  /** Push a `score` frame, as the relay fans a tracker's (or a promoted crowd session's) frame out on `/live`. */
  sendScore: (frame: Record<string, unknown>) => void;
}

const LIVE_NSP = '/live';

export async function installFakeScoreRelay(page: Page): Promise<FakeScoreRelay> {
  let socket: WebSocketRoute | undefined;
  let subscribedTournamentId: string | undefined;

  await page.routeWebSocket(/:8384\/socket\.io\//, (ws) => {
    ws.send(
      `0${JSON.stringify({ sid: 'e2e-relay', upgrades: [], pingInterval: 25000, pingTimeout: 60000, maxPayload: 1e6 })}`,
    );
    ws.onMessage((message) => {
      const packet = String(message);
      if (packet.startsWith(`40${LIVE_NSP},`)) {
        ws.send(`40${LIVE_NSP},${JSON.stringify({ sid: 'e2e-live' })}`);
        socket = ws;
        return;
      }
      if (packet.startsWith(`42${LIVE_NSP},`)) {
        const [event, arg] = JSON.parse(packet.slice(`42${LIVE_NSP},`.length));
        if (event === 'subscribe:tournament') subscribedTournamentId = arg;
      }
    });
  });

  return {
    subscribedTo: () => subscribedTournamentId,
    sendScore: (frame) => socket?.send(`42${LIVE_NSP},${JSON.stringify(['score', frame])}`),
  };
}
