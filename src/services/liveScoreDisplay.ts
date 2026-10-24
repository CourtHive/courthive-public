/**
 * Turn a live score from the score-relay into something a spectator can read: a display-only matchUp copy for
 * the bracket and the schedule, and a compact string.
 *
 * A live score is unofficial. It is shown only while the matchUp carries no official result, it never sets the
 * matchUp's `winningSide`, and it is applied to a COPY — the published matchUp the page fetched is never touched,
 * so the next official update replaces it cleanly.
 *
 * The same rules as TMX's `services/messaging/liveScoreDisplay.ts`, so a TD and a spectator see one live score.
 */

export interface LiveSet {
  setNumber?: number;
  side1Score?: number;
  side2Score?: number;
  side1TiebreakScore?: number;
  side2TiebreakScore?: number;
  side1PointScore?: number | string;
  side2PointScore?: number | string;
  winningSide?: number;
}

export interface LiveScore {
  sets: LiveSet[];
  scoreStringSide1?: string;
  scoreStringSide2?: string;
}

type Side = 1 | 2;

const OFFICIAL_ENDING_STATUSES = new Set([
  'COMPLETED',
  'RETIRED',
  'DEFAULTED',
  'WALKOVER',
  'DOUBLE_WALKOVER',
  'DOUBLE_DEFAULT',
  'CANCELLED',
  'ABANDONED',
  'DEAD_RUBBER',
]);

const SET_FIELDS = [
  'setNumber',
  'side1Score',
  'side2Score',
  'side1TiebreakScore',
  'side2TiebreakScore',
  'side1PointScore',
  'side2PointScore',
  'winningSide',
] as const;

const hasValue = (v: unknown) => v !== undefined && v !== null && v !== '';

function sanitizeSet(raw: any): LiveSet | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const set: any = {};
  for (const field of SET_FIELDS) {
    const value = raw[field];
    if (typeof value === 'number' || (typeof value === 'string' && field.endsWith('PointScore'))) set[field] = value;
  }
  return set;
}

/** Keep only the score fields a display needs; a relay frame is untrusted input. */
export function sanitizeLiveScore(raw: any): LiveScore | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const sets = Array.isArray(raw.sets) ? raw.sets.map(sanitizeSet).filter(Boolean) : [];
  const score: LiveScore = { sets };
  if (typeof raw.scoreStringSide1 === 'string') score.scoreStringSide1 = raw.scoreStringSide1;
  if (typeof raw.scoreStringSide2 === 'string') score.scoreStringSide2 = raw.scoreStringSide2;
  if (!sets.length && !score.scoreStringSide1) return undefined;
  return score;
}

/** True when the matchUp already carries a result the TD (or a trusted path) entered. */
export function hasOfficialScore(matchUp: any): boolean {
  if (!matchUp) return false;
  if (matchUp.winningSide || OFFICIAL_ENDING_STATUSES.has(matchUp.matchUpStatus)) return true;
  const sets = matchUp.score?.sets ?? [];
  const setHasGames = (s: any) => (s?.side1Score ?? 0) > 0 || (s?.side2Score ?? 0) > 0;
  return sets.some(setHasGames) || !!matchUp.score?.scoreStringSide1;
}

function formatSet(set: LiveSet, first: Side): string {
  const second: Side = first === 1 ? 2 : 1;
  const mine = set[`side${first}Score`] ?? 0;
  const theirs = set[`side${second}Score`] ?? 0;
  const games = `${mine}-${theirs}`;
  const tbMine = set[`side${first}TiebreakScore`];
  const tbTheirs = set[`side${second}TiebreakScore`];
  if (!hasValue(tbMine) && !hasValue(tbTheirs)) return games;
  const loserTb = mine > theirs ? tbTheirs : tbMine;
  return `${games}(${loserTb ?? 0})`;
}

/**
 * Compact string from one side's perspective (side 1 by default), e.g. `6-3 2-1 (30-15)`. Game points come from
 * the last set when the producer sent them. Falls back to the producer's own string when it sent no sets.
 */
export function formatLiveScore(score: LiveScore | undefined, perspective: Side = 1): string {
  if (!score) return '';
  const sets = score.sets ?? [];
  if (!sets.length) return (perspective === 1 ? score.scoreStringSide1 : score.scoreStringSide2) ?? '';
  const other: Side = perspective === 1 ? 2 : 1;
  const games = sets.map((set) => formatSet(set, perspective)).join(' ');
  const last = sets[sets.length - 1];
  const mine = last[`side${perspective}PointScore`];
  const theirs = last[`side${other}PointScore`];
  const points = hasValue(mine) || hasValue(theirs) ? ` (${mine ?? 0}-${theirs ?? 0})` : '';
  return `${games}${points}`;
}

/**
 * A display copy carrying the live score as IN_PROGRESS — with the side strings the schedule cell reads — or the
 * same object when there is no live score or an official one exists.
 */
export function withLiveScore<T>(matchUp: T, live: LiveScore | undefined): T {
  const m: any = matchUp;
  if (!live || hasOfficialScore(m)) return matchUp;
  return {
    ...m,
    matchUpStatus: 'IN_PROGRESS',
    score: {
      sets: live.sets.map((s) => ({ ...s })),
      scoreStringSide1: formatLiveScore(live, 1),
      scoreStringSide2: formatLiveScore(live, 2),
    },
    liveTracked: true,
  };
}
