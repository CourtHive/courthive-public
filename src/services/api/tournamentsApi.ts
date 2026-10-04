import { getHeldParticipantsVersion, reconcileParticipants } from './participantsVersionStore';
import { baseApi } from './baseApi';

const MISSING_TOURNAMENT_ID = 'Missing tournamentId';

export async function getTournamentInfo(params?: { tournamentId: string }) {
  if (!params?.tournamentId) throw new Error(MISSING_TOURNAMENT_ID);
  return await baseApi.post('/factory/tournamentinfo', { ...params, withVenueData: true, usePublishState: true });
}

export async function getProviderCalendar({
  providerAbbr,
  limit,
  offset,
}: {
  providerAbbr: string;
  limit?: number;
  offset?: number;
}) {
  if (!providerAbbr) throw new Error('missing provicerAbbr');
  return await baseApi.post('/provider/calendar', { providerAbbr, limit, offset });
}

/** Rows per request. The server clamps to its own ceiling regardless. */
const CALENDAR_PAGE_SIZE = 500;

/** Stop here. 20 x 500 = 10,000, well past any real provider calendar. */
const MAX_CALENDAR_PAGES = 20;

/**
 * Every page of a provider's public calendar, merged.
 *
 * `/provider/calendar` became PAGED in competition-factory-server #974, defaulting to 500
 * entries. This call site asked for the calendar and rendered whatever came back, so the
 * moment the server started capping, two real providers silently lost tournaments from the
 * public listing — ALTA showed 500 of 967, HTS 500 of 533. The list looked complete; it was
 * not, which is the worst shape a truncation can take.
 *
 * A server that predates paging returns no `paging` block; that response is taken as the
 * whole list, so this stays safe against either side deploying first.
 */
export async function fetchProviderCalendar({ providerAbbr }: { providerAbbr: string }) {
  const tournaments: any[] = [];
  let provider: any;
  let offset = 0;
  let truncated = false;

  for (let page = 0; page < MAX_CALENDAR_PAGES; page++) {
    const response: any = await getProviderCalendar({ providerAbbr, limit: CALENDAR_PAGE_SIZE, offset });
    const calendar = response?.data?.calendar;
    if (!calendar) break;

    provider ??= calendar.provider;
    tournaments.push(...(calendar.tournaments ?? []));

    const paging = response?.data?.paging;
    if (!paging) break;
    // `returned: 0` with `hasMore: true` would be a server bug; treat no progress as the end
    // rather than spinning.
    if (!paging.hasMore || !paging.returned) break;

    offset += paging.returned;
    if (page === MAX_CALENDAR_PAGES - 1) truncated = true;
  }

  return { provider, tournaments, truncated };
}

/**
 * Every per-event response carries the WHOLE tournament participant list at its top level, so the
 * same 52%-78.6% of bytes arrives again for each event. We send back the stamp we already hold; the
 * server omits participants only when it matches, and we re-attach our copy before returning.
 *
 * The stamp rides the request only when we actually hold one, so a first fetch is byte-identical to
 * what it was before this handshake existed. Callers see today's shape either way — the response
 * always has `participants` populated when the tournament has any.
 */
export async function getEventData(params?: { tournamentId: string; eventId: string; hydrateParticipants?: boolean }) {
  if (!params?.tournamentId) throw new Error(MISSING_TOURNAMENT_ID);
  if (!params?.eventId) throw new Error('missing eventId');

  const { tournamentId } = params;
  const heldVersion = getHeldParticipantsVersion(tournamentId);
  // Conditional spread, not `participantsVersion: heldVersion`. An explicitly-undefined key is
  // invisible to JSON.stringify but visible to Object.keys, and the request shape must not move for
  // a caller that holds nothing.
  // Ask for draw STUBS. A server that does not understand `drawsProfile` ignores it and returns the
  // full payload, which the caller detects by the presence of `structures` — so this is safe to send
  // before the server side is deployed, and starts paying the moment it is.
  const request = {
    ...params,
    ...(heldVersion && { participantsVersion: heldVersion }),
    drawsProfile: 'STUBS',
  };

  const response = await baseApi.post('/factory/eventdata', request);

  // baseApi's response interceptor resolves to undefined on a network/HTTP error rather than
  // rejecting, so there may be no payload at all here.
  const payload = response?.data;
  if (!payload) return response;

  const participants = reconcileParticipants({
    participantsVersion: payload.participantsVersion,
    participants: payload.participants,
    tournamentId,
  });
  if (participants) payload.participants = participants;

  return response;
}

/**
 * One draw's structures — the draw tier of the payload decomposition.
 *
 * `hydrateParticipants: false` leaves each side with its `participantId` and a small draw-scoped stub
 * instead of a full inlined participant (321 bytes per side on a real draw). The caller rehydrates
 * from the tournament participant set it already holds, which is the same information for far fewer
 * bytes — and it is the reason fetching draws separately is a saving rather than a loss.
 */
export async function getDrawData(params: { tournamentId: string; drawId: string }) {
  if (!params?.tournamentId) throw new Error(MISSING_TOURNAMENT_ID);
  if (!params?.drawId) throw new Error('missing drawId');

  return await baseApi.post('/factory/drawdata', { ...params, hydrateParticipants: false });
}

export async function getScheduledMatchUps(params?: {
  hydrateParticipants?: boolean;
  scheduledDate?: string;
  tournamentId: string;
}) {
  if (!params?.tournamentId) throw new Error(MISSING_TOURNAMENT_ID);
  Object.assign(params, {
    courtCompletedMatchUps: true,
    withCourtGridRows: true,
    usePublishState: true,
    minCourtGridRows: 10,
    nextMatchUps: true,
  });
  return await baseApi.post('/factory/scheduledmatchUps', { params });
}

export async function getParticipants(params?: { tournamentId: string }) {
  if (!params?.tournamentId) throw new Error(MISSING_TOURNAMENT_ID);
  return await baseApi.post('/factory/participants', { params });
}

export async function getServerFactoryVersion() {
  return await baseApi.get('/factory/version');
}

export async function getProviderBrandingByTournament({ tournamentId }: { tournamentId: string }) {
  if (!tournamentId) throw new Error(MISSING_TOURNAMENT_ID);
  return await baseApi.get(`/provider/by-tournament/${tournamentId}/branding`);
}

export async function getScoringLaunchByTournament({ tournamentId }: { tournamentId: string }) {
  if (!tournamentId) throw new Error(MISSING_TOURNAMENT_ID);
  return await baseApi.get(`/provider/by-tournament/${tournamentId}/scoring-launch`);
}
