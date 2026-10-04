/**
 * Is this tournament public?
 *
 * ONE definition, and it is the factory's: `publishState.tournament.status.published`, which
 * `getTournamentInfo` returns as `tournamentInfo.publishState`. The factory rolls up every component —
 * an event with a published draw, the order of play, the participant list, and since 7.0.0 the
 * tournament's INFORMATION, which is what makes a tournament public during its registration phase,
 * before any draw exists.
 *
 * This used to restate the rule as "no events listed, no order of play, no participants". That was a
 * second definition of a rule the factory already owns, and it was wrong the moment information publish
 * shipped: a tournament published for registration reads as unpublished and the visitor is redirected
 * away from a page that is meant to be public.
 *
 * The old component test remains ONLY as a fallback for a response carrying no roll-up (an older
 * server, or a partial payload). Absent everything, a tournament is treated as unpublished: withholding
 * is the safe direction.
 */
export function isFullyUnpublished(tournamentInfo: any): boolean {
  if (!tournamentInfo) return true;

  const published = tournamentInfo.publishState?.status?.published;
  if (typeof published === 'boolean') return !published;

  const hasEvents = !!tournamentInfo.eventInfo?.length;
  const hasSchedule = !!tournamentInfo.publishState?.orderOfPlay?.published;
  const hasParticipants = !!tournamentInfo.publishState?.participants?.published;
  return !hasEvents && !hasSchedule && !hasParticipants;
}
