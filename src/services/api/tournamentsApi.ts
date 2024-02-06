import { baseApi } from './baseApi';

export async function getTournamentInfo(params?: { providerId: string; tournamentId: string }) {
  const { providerId, tournamentId } = params ?? {};
  if (!tournamentId) throw new Error('missing tournamentId');
  if (!providerId) throw new Error('missing providerId');
  return await baseApi.post('/factory/getTournamentInfo', { providerId, tournamentId });
}

export async function getEventData(params?: { providerId: string; tournamentId: string; eventId: string }) {
  const { providerId, tournamentId, eventId } = params ?? {};
  if (!tournamentId) throw new Error('missing tournamentId');
  if (!providerId) throw new Error('missing providerId');
  if (!eventId) throw new Error('missing eventId');
  return await baseApi.post('/factory/eventData', { providerId, tournamentId, eventId });
}

export async function getServerFactoryVersion() {
  return await baseApi.get('/factory/version');
}
