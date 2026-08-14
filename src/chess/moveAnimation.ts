import type { DetectedMove } from './MoveDetector';

/** One piece sliding across the board during a replay step. */
export interface AnimationSegment {
  /** Algebraic square the floating piece starts on. */
  from: string;
  /** Square it lands on — hidden in the grid while the slide runs. */
  to: string;
  /** FEN piece letter to draw ('N' = white knight, 'p' = black pawn, …). */
  piece: string;
}

export interface MoveAnimationSpec {
  segments: AnimationSegment[];
  /** Monotonic counter; a new key restarts the animation even for repeated squares. */
  key: number;
}

const ROOK_CASTLE_SQUARES: Record<string, { from: string; to: string }> = {
  wk: { from: 'h1', to: 'f1' },
  wq: { from: 'a1', to: 'd1' },
  bk: { from: 'h8', to: 'f8' },
  bq: { from: 'a8', to: 'd8' },
};

/**
 * Segments to animate when stepping a replay by one ply.
 * direction 1 = forward (board shows move.after), -1 = backward (move.before).
 * Promotions slide the pawn in both directions; the promoted piece appears at
 * arrival. Captures need nothing special — the displayed FEN is the end state.
 */
export function animationForStep(move: DetectedMove, direction: 1 | -1): AnimationSegment[] {
  const piece = move.color === 'w' ? move.piece.toUpperCase() : move.piece;
  const seg = (from: string, to: string, p: string): AnimationSegment =>
    direction === 1 ? { from, to, piece: p } : { from: to, to: from, piece: p };

  const segments: AnimationSegment[] = [];
  // Chess960 king-stays castles have no king slide at all.
  if (move.from !== move.to) segments.push(seg(move.from, move.to, piece));

  const castle = move.flags.includes('k') ? 'k' : move.flags.includes('q') ? 'q' : null;
  if (castle) {
    // Chess960 castles carry their own rook squares; standard chess.js moves
    // fall back to the fixed corners.
    const rook = move.rookFrom
      ? { from: move.rookFrom, to: move.rookTo! }
      : ROOK_CASTLE_SQUARES[`${move.color}${castle}`];
    if (rook.from !== rook.to) {
      segments.push(seg(rook.from, rook.to, move.color === 'w' ? 'R' : 'r'));
    }
  }

  return segments;
}
