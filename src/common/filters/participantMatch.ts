/**
 * Participant-name matching for the public draw and schedule searches.
 *
 * TMX filters a structure by `side.participant.participantName` alone. The
 * public viewer needs one step more: a doubles or team side often renders its
 * members rather than the pair name, and a spectator searching for a family
 * member types the person's name, not the pair's. So individual participants
 * are matched too, and a side that carries only a `participantName` still
 * matches on it.
 *
 * Pure by design — this repo's vitest runs without a DOM, so every decision
 * that can be made outside the render path is made here and unit-tested.
 */

/** Lower-case + trim a raw input value; `''` means "no filter". */
export function normalizeSearch(value?: string | null): string {
  return (value ?? '').trim().toLowerCase();
}

/** Every participant name attached to a matchUp: side names plus individuals. */
export function matchUpParticipantNames(matchUp: any): string[] {
  const names: string[] = [];
  for (const side of matchUp?.sides ?? []) {
    const participant = side?.participant;
    if (participant?.participantName) names.push(participant.participantName);
    for (const individual of participant?.individualParticipants ?? []) {
      if (individual?.participantName) names.push(individual.participantName);
    }
  }
  return names;
}

/**
 * Does this matchUp involve a participant whose name contains `search`?
 *
 * An empty search matches everything — callers can pass the raw input value
 * through without branching. A matchUp with no resolvable names never matches
 * a non-empty search (a BYE or an unfilled draw position is not a hit).
 */
export function matchUpMatchesSearch(matchUp: any, search: string): boolean {
  const needle = normalizeSearch(search);
  if (!needle) return true;
  return matchUpParticipantNames(matchUp).some((name) => name.toLowerCase().includes(needle));
}

/**
 * Filter a `roundMatchUps` map ({ roundNumber: matchUp[] }) without mutating it.
 * Rounds that lose every matchUp are kept as empty arrays so the round numbering
 * downstream (chips, headers) still describes the structure rather than the hit list.
 */
export function filterRoundMatchUps(
  roundMatchUps: Record<string, any[]> | undefined,
  search: string,
): Record<string, any[]> {
  const needle = normalizeSearch(search);
  const entries = Object.entries(roundMatchUps ?? {});
  if (!needle) return Object.fromEntries(entries.map(([round, matchUps]) => [round, [...(matchUps ?? [])]]));
  return Object.fromEntries(
    entries.map(([round, matchUps]) => [round, (matchUps ?? []).filter((m) => matchUpMatchesSearch(m, needle))]),
  );
}
