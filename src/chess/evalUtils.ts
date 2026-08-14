import { Chess } from 'chess.js';
import { toChessJsFen } from './chess960';

/** Engine score, always from WHITE's perspective. Exactly one of cp/mate set. */
export interface Score {
  cp?: number;
  mate?: number;
}

/** Centipawn value used to compare mate scores against cp scores. */
export const MATE_CP = 10_000;

/** UCI reports scores from the side to move — normalize to white's perspective. */
export function toWhitePerspective(score: Score, sideToMove: 'w' | 'b'): Score {
  if (sideToMove === 'w') return score;
  if (score.mate !== undefined) return { mate: -score.mate };
  if (score.cp !== undefined) return { cp: -score.cp };
  return score;
}

/** Collapse a score to a single centipawn number (mates dominate, closer mates bigger). */
export function scoreToCp(score: Score): number {
  if (score.mate !== undefined) {
    if (score.mate === 0) return 0;
    const sign = score.mate > 0 ? 1 : -1;
    return sign * (MATE_CP - Math.abs(score.mate));
  }
  return score.cp ?? 0;
}

/** "+1.2", "-0.5", "M5", "-M3", "0.0" */
export function formatScore(score: Score): string {
  if (score.mate !== undefined) {
    return score.mate >= 0 ? `M${score.mate}` : `-M${Math.abs(score.mate)}`;
  }
  const pawns = (score.cp ?? 0) / 100;
  return `${pawns > 0 ? '+' : ''}${pawns.toFixed(1)}`;
}

/**
 * Compact unsigned label shown inside the eval bar: "1.2", "15", "M5", "#".
 * The label sits at the winning side's end of the bar, so the sign is
 * carried by position rather than text (chess.com style).
 */
export function formatBarScore(score: Score): string {
  if (score.mate !== undefined) {
    return score.mate === 0 ? '#' : `M${Math.abs(score.mate)}`;
  }
  const cp = score.cp ?? 0;
  if (Math.abs(cp) >= MATE_CP) return '#'; // terminalScore() encodes checkmate as ±MATE_CP
  const pawns = Math.abs(cp) / 100;
  return pawns >= 10 ? String(Math.round(pawns)) : pawns.toFixed(1);
}

/** White's share of the eval bar, 0..1 (0.5 = equal). */
export function scoreToBarRatio(score: Score): number {
  if (score.mate !== undefined && score.mate !== 0) {
    return score.mate > 0 ? 0.98 : 0.02;
  }
  const cp = scoreToCp(score);
  return 1 / (1 + Math.exp(-cp / 400));
}

/**
 * Score of a game-over position (the engine returns `bestmove (none)` there).
 * Checkmate → mate 0 for the winner; any other end → 0.00.
 */
export function terminalScore(fen: string): Score | null {
  // Chess960 engine FENs carry Shredder castling letters chess.js can't load.
  const chess = new Chess(toChessJsFen(fen));
  if (!chess.isGameOver()) return null;
  if (chess.isCheckmate()) {
    // Side to move is the one mated: white to move means black won.
    return { cp: chess.turn() === 'w' ? -MATE_CP : MATE_CP };
  }
  return { cp: 0 };
}

/** Convert a UCI principal variation into SAN, starting from `fen`. */
export function uciPvToSan(fen: string, pv: string[]): string[] {
  const chess = new Chess(toChessJsFen(fen));
  const sans: string[] = [];
  for (const uci of pv) {
    try {
      const move = chess.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci.length > 4 ? uci[4] : undefined,
      });
      sans.push(move.san);
    } catch {
      break; // stop at the first move that doesn't apply (stale PV)
    }
  }
  return sans;
}
