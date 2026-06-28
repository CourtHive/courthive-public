import { mocksEngine, tournamentEngine } from 'tods-competition-factory';

/**
 * Hermetic fixture builder for courthive-public e2e tests.
 *
 * Generates a published tournament with `mocksEngine` and projects it through
 * the same factory queries the competition-factory-server uses, so the mocked
 * HTTP responses match production byte-for-byte in shape:
 *
 *   - `/factory/tournamentinfo`     → `queryGovernor.getTournamentInfo(...)`
 *   - `/factory/eventdata`          → `queryGovernor.getEventData(...)`
 *   - `/factory/scheduledmatchups`  → `queryGovernor.competitionScheduleMatchUps(...)`
 *   - `/factory/participants`       → `queryGovernor.getParticipants(...)`
 *
 * Everything runs in-process in the Node test runner; no server is touched.
 */

const DEFAULT_START_DATE = '2026-07-01';
const DEFAULT_EVENT_NAMES = ["Men's Singles"];

export interface EventRef {
  eventId: string;
  eventName: string;
}

export interface PublicTournamentFixture {
  tournamentId: string;
  tournamentName: string;
  scheduleDate: string;
  events: EventRef[];
  // First event, surfaced for convenience in single-event specs.
  eventId: string;
  eventName: string;
  // First draw of the first event, for deep-link route specs.
  drawId: string;
  structureId: string;
  // Body returned by POST /factory/tournamentinfo — `{ success, tournamentInfo }`.
  tournamentInfo: any;
  // Body returned by POST /factory/eventdata, keyed by eventId —
  // `{ success, eventData, participants }`.
  eventData: Record<string, any>;
  // Body returned by POST /factory/scheduledmatchups — `{ success, ...schedule }`.
  scheduleData: any;
  // Body returned by POST /factory/participants — `{ success, participants }`.
  participants: any;
}

export interface BuildOptions {
  tournamentName?: string;
  // One event per name; defaults to a single "Men's Singles".
  eventNames?: string[];
  drawSize?: number;
  // Generate completed outcomes so draws render with scores (default true).
  completeAllMatchUps?: boolean;
  // Publish + expose the participant list, surfacing the Players tab (default true).
  publishParticipants?: boolean;
  // Assign the first event's round-1 matchUps to courts/times (default true).
  scheduleFirstRound?: boolean;
}

/**
 * Schedule the first event's round-1 matchUps onto courts at staggered times so
 * the public schedule grid renders real cells rather than its empty state.
 */
function scheduleRoundOne(firstEventId: string, scheduleDate: string): void {
  const { courts } = tournamentEngine.getVenuesAndCourts();
  const courtCount = courts.length;
  const { matchUps } = tournamentEngine.allTournamentMatchUps({
    matchUpFilters: { roundNumbers: [1], eventIds: [firstEventId] },
  });
  matchUps.forEach((matchUp: any, i: number) => {
    const courtId = courts[i % courtCount].courtId;
    // courtOrder is the row index the public schedule grid places cells by;
    // scheduledTime alone leaves the grid empty (scheduleGovernor.courtGridRows
    // buckets by courtOrder).
    const courtOrder = Math.floor(i / courtCount) + 1;
    const scheduledTime = `${(8 + i).toString().padStart(2, '0')}:00`;
    tournamentEngine.assignMatchUpCourt({ drawId: matchUp.drawId, matchUpId: matchUp.matchUpId, courtId, courtDayDate: scheduleDate });
    tournamentEngine.addMatchUpScheduleItems({
      schedule: { scheduledDate: scheduleDate, scheduledTime, courtId, courtOrder },
      matchUpId: matchUp.matchUpId,
      drawId: matchUp.drawId,
    });
  });
}

/**
 * Build a fully-published tournament fixture. `usePublishState` + `withVenueData`
 * mirror the flags courthive-public sends from `tournamentsApi.ts`.
 */
export function buildPublishedTournament(opts: BuildOptions = {}): PublicTournamentFixture {
  const tournamentName = opts.tournamentName ?? 'CourtHive Public Open';
  const eventNames = opts.eventNames ?? DEFAULT_EVENT_NAMES;
  const drawSize = opts.drawSize ?? 8;
  const completeAllMatchUps = opts.completeAllMatchUps ?? true;
  const publishParticipants = opts.publishParticipants ?? true;
  const scheduleFirstRound = opts.scheduleFirstRound ?? true;
  const scheduleDate = DEFAULT_START_DATE;

  const { tournamentRecord } = mocksEngine.generateTournamentRecord({
    drawProfiles: eventNames.map((eventName) => ({ drawSize, eventName })),
    venueProfiles: [{ courtsCount: 4, venueName: 'Center Club', startTime: '08:00', endTime: '20:00' }],
    startDate: scheduleDate,
    endDate: '2026-07-05',
    completeAllMatchUps,
  });
  tournamentRecord.tournamentName = tournamentName;

  tournamentEngine.setState(tournamentRecord);

  const { events } = tournamentEngine.getEvents();
  const eventRefs: EventRef[] = events.map((event: any) => ({ eventId: event.eventId, eventName: event.eventName }));
  const firstEventId = eventRefs[0].eventId;

  if (scheduleFirstRound) scheduleRoundOne(firstEventId, scheduleDate);

  // Publish so usePublishState:true exposes eventInfo, participants, and the
  // order of play — matching what a published public tournament returns.
  for (const event of events) tournamentEngine.publishEvent({ eventId: event.eventId });
  if (publishParticipants) tournamentEngine.publishParticipants({});
  tournamentEngine.publishOrderOfPlay({});

  const tournamentInfo = tournamentEngine.getTournamentInfo({ usePublishState: true, withVenueData: true }).tournamentInfo;

  const eventData: Record<string, any> = {};
  for (const ref of eventRefs) {
    const result = tournamentEngine.getEventData({ eventId: ref.eventId, hydrateParticipants: true });
    eventData[ref.eventId] = { success: true, eventData: result.eventData, participants: result.participants };
  }

  const firstDraw = eventData[firstEventId].eventData?.drawsData?.[0];

  // Mirror the options courthive-public's getScheduledMatchUps sends, notably
  // withCourtGridRows + minCourtGridRows, so each court carries its matchUps
  // and the public schedule grid can place cells.
  const scheduleResult = tournamentEngine.competitionScheduleMatchUps({
    courtCompletedMatchUps: true,
    withCourtGridRows: true,
    minCourtGridRows: 10,
    usePublishState: true,
    nextMatchUps: true,
  });

  const participantsResult = tournamentEngine.getParticipants({
    withScaleValues: true,
    usePublishState: true,
    withEvents: true,
  });

  return {
    tournamentId: tournamentRecord.tournamentId,
    tournamentName,
    scheduleDate,
    events: eventRefs,
    eventId: firstEventId,
    eventName: eventRefs[0].eventName,
    drawId: firstDraw?.drawId,
    structureId: firstDraw?.structures?.[0]?.structureId,
    tournamentInfo: { success: true, tournamentInfo },
    eventData,
    scheduleData: { success: true, ...scheduleResult },
    participants: { success: true, participants: participantsResult.participants },
  };
}
