/**
 * Round-chip model for the published structure.
 *
 * TMX's draw control bar offers a row of round tabs (R32 · R16 · QF · SF · F)
 * that set the *starting* round of the bracket, so a 128-draw opens on the
 * quarters instead of asking the viewer to pan across five columns. This is the
 * model behind the same affordance on the public viewer.
 *
 * Labels come from the factory's own `abbreviatedRoundName`, which is populated
 * on every in-context matchUp (verified against `getEventData` for draw sizes 8
 * and 32: `QF`/`SF`/`F` and `R32`/`R16`/`QF`/`SF`/`F`). `roundName` is the
 * fallback, and a generated `R{n}` the last resort — the label is never
 * invented from position, because a consolation or playoff structure's rounds
 * are not the main draw's.
 *
 * Pure: this repo's vitest has no DOM, so the decision of *which* chips exist
 * and *whether* they select is made here and asserted directly.
 */

export interface RoundChip {
  roundNumber: number;
  label: string;
  matchUpCount: number;
}

/** Minimum rounds before a round selector earns its space (mirrors TMX). */
const MIN_SELECTABLE_ROUNDS = 3;

function chipLabel(matchUp: any, roundNumber: number): string {
  const abbreviated = matchUp?.abbreviatedRoundName;
  if (typeof abbreviated === 'string' && abbreviated.trim()) return abbreviated.trim();
  const roundName = matchUp?.roundName;
  if (typeof roundName === 'string' && roundName.trim()) return roundName.trim();
  return `R${roundNumber}`;
}

/** One chip per round present in `matchUps`, ordered by round number. */
export function buildRoundChips(matchUps: any[]): RoundChip[] {
  const byRound = new Map<number, any[]>();
  for (const matchUp of matchUps ?? []) {
    const roundNumber = Number(matchUp?.roundNumber);
    if (!Number.isFinite(roundNumber) || roundNumber < 1) continue;
    const bucket = byRound.get(roundNumber);
    if (bucket) bucket.push(matchUp);
    else byRound.set(roundNumber, [matchUp]);
  }

  // `sort` on an array built one line above — nothing external to reorder.
  // (`toSorted` is unavailable: this repo compiles against `lib: ES2020`.)
  return [...byRound.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([roundNumber, roundMatchUps]) => ({
      roundNumber,
      label: chipLabel(roundMatchUps[0], roundNumber),
      matchUpCount: roundMatchUps.length,
    }));
}

/**
 * Should the chips *select* a starting round (elimination bracket), rather than
 * merely scroll to one?
 *
 * Round robin and ad hoc structures are excluded for the same reason TMX
 * excludes them: their "rounds" are groups or generated rows, not a
 * progression, so collapsing the earlier ones hides results rather than noise.
 */
export function isRoundSelectable({
  chips,
  isRoundRobin,
  isAdHoc,
}: {
  chips: RoundChip[];
  isRoundRobin?: boolean;
  isAdHoc?: boolean;
}): boolean {
  if (isRoundRobin || isAdHoc) return false;
  return (chips?.length ?? 0) >= MIN_SELECTABLE_ROUNDS;
}

/**
 * The round the bracket should open on.
 *
 * A live search overrides any selection back to round 1: the point of the
 * search is "where does this player appear", and a bracket still collapsed to
 * the semifinals answers it wrongly by omission. Out-of-range selections
 * (a structure switch carrying stale state) fall back to round 1 as well.
 */
export function resolveInitialRoundNumber({
  chips,
  selectedRoundNumber,
  searchActive,
}: {
  chips: RoundChip[];
  selectedRoundNumber?: number;
  searchActive?: boolean;
}): number {
  if (searchActive) return 1;
  if (!selectedRoundNumber) return 1;
  return chips?.some((chip) => chip.roundNumber === selectedRoundNumber) ? selectedRoundNumber : 1;
}
