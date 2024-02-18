import { baseApi } from './baseApi';

export async function getTournamentInfo(params?: { tournamentId: string }) {
  if (!params?.tournamentId) throw new Error('missing tournamentId');
  return await baseApi.post('/factory/tournamentinfo', params);
}

export async function getProviderCalendar({ providerAbbr }: { providerAbbr: string }) {
  if (!providerAbbr) throw new Error('missing provicerAbbr');
  return await baseApi.post('/provider/calendar', { providerAbbr });
}

export async function getEventData(params?: { string; tournamentId: string; eventId: string }) {
  if (!params?.tournamentId) throw new Error('missing tournamentId');
  if (!params?.eventId) throw new Error('missing eventId');
  return await baseApi.post('/factory/eventData', params);
}

export async function getServerFactoryVersion() {
  return await baseApi.get('/factory/version');
}
