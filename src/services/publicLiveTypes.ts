/**
 * Local mirror of the PublicLivePayload shape from
 * competition-factory-server's projector module.
 *
 * Kept narrow on purpose — courthive-public doesn't need to know about
 * the full BoltHistoryDocument shape, only the fields surfaced in the
 * compact public-live broadcast. The canonical source is
 * `competition-factory-server/src/modules/projectors/types/public-live-payload.ts`
 * and that file is authoritative for any field semantics.
 */

export type PublicLiveFormat = 'STANDARD' | 'INTENNSE';
export type PublicLiveStatus = 'pre' | 'in_progress' | 'completed';

export interface PublicLiveSide {
  teamName: string;
  playerName: string;
  setScores: number[];
  gameScore?: number;
  isServing: boolean;
}

export interface PublicLiveIntennseBolt {
  number: number;
  state: 'pre' | 'play' | 'paused' | 'complete';
  boltClockMs: number;
  serveClockMs: number;
}

export interface PublicLivePayload {
  matchUpId: string;
  tournamentId: string;
  format: PublicLiveFormat;
  status: PublicLiveStatus;
  side1: PublicLiveSide;
  side2: PublicLiveSide;
  intennseBolt?: PublicLiveIntennseBolt;
  generatedAt: string;
}
