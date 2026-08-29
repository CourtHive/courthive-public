import { getHeldParticipantsVersion, reconcileParticipants } from './participantsVersionStore';
import { baseApi } from './baseApi';

const MISSING_TOURNAMENT_ID = 'Missing tournamentId';

export async function getTournamentInfo(params?: { tournamentId: string }) {
  if (!params?.tournamentId) throw new Error(MISSING_TOURNAMENT_ID);
  return await baseApi.post('/factory/tournamentinfo', { ...params, withVenueData: true, usePublishState: true });
}

export async function getProviderCalendar({ providerAbbr }: { providerAbbr: string }) {
  if (!providerAbbr) throw new Error('missing provicerAbbr');
  return await baseApi.post('/provider/calendar', { providerAbbr });
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
