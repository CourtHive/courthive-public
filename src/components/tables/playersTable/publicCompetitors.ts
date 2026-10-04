/**
 * Who belongs in the public Players tab.
 *
 * The tab filtered on `participantType === 'INDIVIDUAL'` alone, which let personnel in: an OFFICIAL, a
 * COACH or a PHYSIO is an INDIVIDUAL participant exactly as a player is, so a referee rendered as a
 * competitor. GROUPs reached it too — a GROUP has no `person`, so it rendered as someone named e.g.
 * "Transport Van A".
 *
 * CFS stopped serving non-competitors on its public route, but this stays as the second guard. Neither
 * layer should be the sole one, and this table also renders payloads from servers that have not been
 * updated yet.
 *
 * Lives in its own module so it can be tested: importing the table pulls Tabulator, which touches
 * `document` at import time, and this repo's vitest runner has no DOM.
 */

const COMPETITOR = 'COMPETITOR';
const INDIVIDUAL = 'INDIVIDUAL';

/**
 * Phrased as "has a role, and it is not COMPETITOR" rather than "is COMPETITOR", deliberately.
 *
 * A participant carrying no `participantRole` at all is a player from a record written before the role
 * was universally present. An allow-list would drop them and quietly empty the tab for older
 * tournaments — a worse failure than the one being fixed, because it looks like a tournament with no
 * entries rather than like a bug.
 */
export function isPublicCompetitor(participant: any): boolean {
  if (participant?.participantType !== INDIVIDUAL) return false;
  return !participant.participantRole || participant.participantRole === COMPETITOR;
}

export function publicCompetitors(participants: any[] | undefined): any[] {
  return (participants ?? []).filter(isPublicCompetitor);
}
