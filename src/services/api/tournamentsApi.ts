import { baseApi } from './baseApi';

const MISSING_TOURNAMENT_ID = 'Missing tournamentId';

export async function getTournamentInfo(params?: { tournamentId: string }) {
  if (!params?.tournamentId) throw new Error(MISSING_TOURNAMENT_ID);
  return await baseApi.post('/factory/tournamentinfo', params);
}

export async function getProviderCalendar({ providerAbbr }: { providerAbbr: string }) {
  if (!providerAbbr) throw new Error('missing provicerAbbr');
  return await baseApi.post('/provider/calendar', { providerAbbr });
}

export async function getEventData(params?: { tournamentId: string; eventId: string }) {
  if (!params?.tournamentId) throw new Error(MISSING_TOURNAMENT_ID);
  if (!params?.eventId) throw new Error('missing eventId');
  return await baseApi.post('/factory/eventdata', params);
}

export async function getScheduledMatchUps(params?: { tournamentId: string; scheduledDate?: string }) {
  if (!params?.tournamentId) throw new Error(MISSING_TOURNAMENT_ID);
  Object.assign(params, {
    courtCompletedMatchUps: true,
    withCourtGridRows: true,
    usePublishState: true,
    minCourtGridRows: 10,
    nextMatchUps: true
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
