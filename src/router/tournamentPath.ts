/**
 * Route-path construction for the tournament view.
 *
 * Extracted from `updateRouteUrl` when the schedule grew "view this match in
 * its draw": that navigation needs the *same* path the URL-sync code builds,
 * and two copies of a route shape drift. `updateRouteUrl` pushes the path onto
 * history; the schedule hands it to the router to resolve.
 *
 * Pure — asserted directly, since this repo's vitest has no DOM.
 */

export interface TournamentPathParams {
  tournamentId: string;
  eventId?: string;
  drawId?: string;
  structureId?: string;
  tab?: string;
}

const TAB_SEGMENTS: Record<string, string> = {
  Schedule: 'schedule',
  Events: 'events',
  Players: 'participants',
};

/**
 * `/tournament/:tournamentId` plus either a tab segment or the
 * event → draw → structure chain. A tab wins over the chain: they are two ways
 * of asking for the same page and the caller only ever means one.
 *
 * Deeper segments are dropped when a shallower one is missing — a structure
 * without its draw has no addressable route, and emitting one would produce a
 * URL the router cannot match.
 */
export function buildTournamentPath({ tournamentId, eventId, drawId, structureId, tab }: TournamentPathParams): string {
  let path = `/tournament/${tournamentId}`;

  const tabSegment = tab && TAB_SEGMENTS[tab];
  if (tabSegment) return `${path}/${tabSegment}`;
  if (!eventId) return path;

  path += `/event/${eventId}`;
  if (!drawId) return path;

  path += `/draw/${drawId}`;
  if (structureId) path += `/structure/${structureId}`;
  return path;
}
