/**
 * Pure participant-counting helpers used by `createTeamsGrid`. No DOM, no
 * courthive-components imports — kept side-effect-free so unit tests can
 * exercise the count math without a browser-like environment.
 */

export type CountParticipant = {
  participantId: string;
  participantName?: string;
  participantType?: string;
  participantRole?: string;
  individualParticipantIds?: string[];
  person?: any;
};

export function indexIndividualsByTeamName(
  participants: CountParticipant[],
): Map<string, CountParticipant[]> {
  const index = new Map<string, CountParticipant[]>();
  for (const p of participants) {
    if (p.participantType !== 'INDIVIDUAL') continue;
    const teamName = p.person?.biographicalInformation?.teamAttributes?.[0]?.teamName;
    if (!teamName) continue;
    const list = index.get(teamName);
    if (list) list.push(p);
    else index.set(teamName, [p]);
  }
  return index;
}

/**
 * Pure count calculator — returns numeric counts so the render path can
 * wrap them in i18n strings and tests can assert against numbers without
 * needing i18n init.
 *
 * Roster = `individualParticipantIds[]` (authoritative — factory walks this
 * for draws / scoring) unioned with any individual whose `teamAttributes[0]
 * .teamName` matches the team name and whose role is COMPETITOR or unset.
 * The union covers the import race where a COMPETITOR has been imported and
 * stamped with the team name but not yet attached to the team participant's
 * roster.
 *
 * Coaches = role === COACH.
 * Staff = any other non-COMPETITOR role (MEDICAL / CAPTAIN / OFFICIAL / …).
 */
export function computeTeamCounts(
  team: CountParticipant,
  index: Map<string, CountParticipant[]>,
): { players: number; coaches: number; staff: number } {
  const teamRosterIds = new Set((team.individualParticipantIds ?? []) as string[]);
  const associated = index.get(team.participantName || '') ?? [];

  let rosterExtras = 0;
  let coaches = 0;
  let staff = 0;
  for (const p of associated) {
    const role = p.participantRole;
    if (!role || role === 'COMPETITOR') {
      if (!teamRosterIds.has(p.participantId)) rosterExtras++;
    } else if (role === 'COACH') {
      coaches++;
    } else {
      staff++;
    }
  }

  return { players: teamRosterIds.size + rosterExtras, coaches, staff };
}
