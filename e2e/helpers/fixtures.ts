import { mocksEngine, tournamentEngine } from 'tods-competition-factory';

/**
 * Hermetic fixture builder for courthive-public e2e tests.
 *
 * Generates a published tournament with `mocksEngine` and projects it through
 * the same factory queries the competition-factory-server uses, so the mocked
 * HTTP responses match production byte-for-byte in shape:
 *
 *   - `/factory/tournamentinfo`  → `queryGovernor.getTournamentInfo(...)`
 *   - `/factory/eventdata`       → `queryGovernor.getEventData(...)`
 *
 * Everything runs in-process in the Node test runner; no server is touched.
 */

export interface PublicTournamentFixture {
  tournamentId: string;
  tournamentName: string;
  eventId: string;
  eventName: string;
  /** Body returned by POST /factory/tournamentinfo — `{ success, tournamentInfo }`. */
  tournamentInfo: any;
  /** Body returned by POST /factory/eventdata — `{ success, eventData, participants }`. */
  eventData: any;
}

export interface BuildOptions {
  tournamentName?: string;
  eventName?: string;
  drawSize?: number;
  /** Generate completed outcomes so draws render with scores. */
  completeAllMatchUps?: boolean;
}

/**
 * Build a fully-published single-event tournament fixture. `withVenueData` and
 * `usePublishState` mirror the flags courthive-public sends from
 * `getTournamentInfo` (`tournamentsApi.ts`).
 */
export function buildPublishedTournament(opts: BuildOptions = {}): PublicTournamentFixture {
  const tournamentName = opts.tournamentName ?? 'CourtHive Public Open';
  const eventName = opts.eventName ?? "Men's Singles";
  const drawSize = opts.drawSize ?? 8;

  const { tournamentRecord } = mocksEngine.generateTournamentRecord({
    startDate: '2026-07-01',
    endDate: '2026-07-05',
    drawProfiles: [{ drawSize, eventName }],
    venueProfiles: [{ courtsCount: 4, venueName: 'Center Club' }],
    completeAllMatchUps: opts.completeAllMatchUps ?? true,
  });
  tournamentRecord.tournamentName = tournamentName;

  tournamentEngine.setState(tournamentRecord);

  const { events } = tournamentEngine.getEvents();
  const event = events[0];
  const eventId = event.eventId;

  // Publish so usePublishState:true exposes eventInfo + orderOfPlay, matching
  // what a published public tournament returns from CFS.
  tournamentEngine.publishEvent({ eventId });
  tournamentEngine.publishOrderOfPlay?.({});

  const infoResult = tournamentEngine.getTournamentInfo({ usePublishState: true, withVenueData: true });
  const eventDataResult = tournamentEngine.getEventData({ eventId, hydrateParticipants: true });

  return {
    tournamentId: tournamentRecord.tournamentId,
    tournamentName,
    eventId,
    eventName,
    tournamentInfo: { success: true, tournamentInfo: infoResult.tournamentInfo },
    eventData: { success: true, eventData: eventDataResult.eventData, participants: eventDataResult.participants },
  };
}
