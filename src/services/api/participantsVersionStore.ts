/**
 * Client half of the `participantsVersion` handshake (payload decomposition, G2 / D2).
 *
 * `getEventData` returns the tournament's ENTIRE participant list at the top level of every
 * per-event response — 52%–78.6% of each payload, byte-identical across every event of the same
 * tournament. Holding one copy and proving we hold it removes 61.7% of the aggregate transfer
 * (3,342 KB -> 1,281 KB, measured on the slam corpus).
 *
 * WHY WE PROVE RATHER THAN ASSERT. The client never says "don't send participants". It sends back
 * the stamp it holds, and the server omits them ONLY on an exact match. A stale, malformed, empty or
 * absent stamp returns participants exactly as today, so the failure direction is "sent bytes that
 * were not needed" rather than a blank bracket. That is the whole reason this is safe to adopt.
 *
 * WHY THE STORE IS TOURNAMENT-SCOPED, NOT EVENT-SCOPED. The stamp is computed over the tournament
 * participant set, so it is identical for every event. One held copy serves them all — keying per
 * event would hold five identical copies and win nothing.
 *
 * WHAT IS DELIBERATELY NOT HERE: nothing writes a participants-LESS payload anywhere. Serving one to
 * a caller that holds no version blanks every bracket side to TBD, which is why the server caches the
 * full payload and strips on the way out. This module mirrors that discipline: it only ever stores a
 * participant set the server actually sent.
 */

/** Held sets are ~400 KB each. Bounded so cross-tournament browsing cannot grow without limit. */
const MAX_HELD_TOURNAMENTS = 3;

type HeldParticipants = { participantsVersion: string; participants: any[] };

/** Insertion-ordered, so the oldest key is the first one `keys()` yields — a sufficient LRU here. */
const heldByTournamentId = new Map<string, HeldParticipants>();

/** The stamp to send on the next request for this tournament, or `undefined` to ask for everything. */
export function getHeldParticipantsVersion(tournamentId?: string): string | undefined {
  if (!tournamentId) return undefined;
  return heldByTournamentId.get(tournamentId)?.participantsVersion;
}

function hold({ participantsVersion, participants, tournamentId }: HeldParticipants & { tournamentId: string }): void {
  // Re-insert so a refreshed entry moves to the back of the eviction order.
  heldByTournamentId.delete(tournamentId);
  heldByTournamentId.set(tournamentId, { participantsVersion, participants });
  while (heldByTournamentId.size > MAX_HELD_TOURNAMENTS) {
    const oldest = heldByTournamentId.keys().next().value;
    if (oldest === undefined) break;
    heldByTournamentId.delete(oldest);
  }
}

/**
 * Reconcile one `getEventData` response against what we hold.
 *
 * Returns the participant set the caller should see, or `undefined` when there is none to supply —
 * which is exactly the shape a caller sees today when a response carries no participants.
 */
export function reconcileParticipants({
  participantsVersion,
  participants,
  tournamentId,
}: {
  participantsVersion?: string;
  participants?: any[];
  tournamentId?: string;
}): any[] | undefined {
  if (!tournamentId) return Array.isArray(participants) ? participants : undefined;

  if (Array.isArray(participants)) {
    // The server sent them. Hold only when a stamp came with them — a set we cannot name is a set we
    // could never prove we hold, and holding it unnamed would mean guessing on the next request.
    if (participantsVersion) hold({ participantsVersion, participants, tournamentId });
    return participants;
  }

  // Omitted. The server does this ONLY on an exact match with the stamp we sent, so the held set is
  // current by construction. The equality check is belt-and-braces: if it ever fails, our copy is
  // stale, and returning it would render a draw from participants the server has already replaced.
  const held = heldByTournamentId.get(tournamentId);
  if (held && participantsVersion && held.participantsVersion === participantsVersion) return held.participants;

  // Drop the stale hold so the next request sends no stamp and receives a full set. Self-correcting.
  heldByTournamentId.delete(tournamentId);
  return undefined;
}

/** Test seam, and the hook a future "tournament changed underneath us" signal would call. */
export function clearHeldParticipants(tournamentId?: string): void {
  if (tournamentId) heldByTournamentId.delete(tournamentId);
  else heldByTournamentId.clear();
}
