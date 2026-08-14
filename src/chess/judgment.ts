import { Chess, type Square } from 'chess.js';
import { MATE_CP, scoreToCp, type Score } from './evalUtils';

export type Judgment =
  | 'brilliant'
  | 'best'
  | 'good'
  | 'ok'
  | 'imprecision'
  | 'mistake'
  | 'miss'
  | 'blunder';

export interface JudgmentMeta {
  glyph: string;
  color: string;
  label: string;
}

/** Chess.com-style palette — theme-independent, shared by board badges and move list. */
export const JUDGMENT_META: Record<Judgment, JudgmentMeta> = {
  brilliant: { glyph: '!!', color: '#26C2A3', label: 'Brilliant' },
  best: { glyph: '★', color: '#81B64C', label: 'Best move' },
  good: { glyph: '✓', color: '#95B776', label: 'Good move' },
  ok: { glyph: '✓', color: '#8A8F99', label: 'Move ok' },
  imprecision: { glyph: '?!', color: '#F7C631', label: 'Imprecision' },
  mistake: { glyph: '?', color: '#FFA459', label: 'Mistake' },
  miss: { glyph: '✗', color: '#FF7769', label: 'Missed win' },
  blunder: { glyph: '??', color: '#FA412D', label: 'Blunder' },
};

/** Ordered best → worst, for the review summary table. */
export const JUDGMENT_ORDER: Judgment[] = [
  'brilliant',
  'best',
  'good',
  'ok',
  'imprecision',
  'mistake',
  'miss',
  'blunder',
];

const BLUNDER_CP = 300;
const MISTAKE_CP = 120;
const IMPRECISION_CP = 50;
const GOOD_CP = 25;

// "miss": the mover was clearly winning and the move let it slip.
const MISS_WINNING_BEFORE_CP = 200;
const MISS_LOST_AFTER_CP = 100;

// A sacrifice must give up at least a minor-piece's worth of material.
const SACRIFICE_MIN_POINTS = 2;

const PIECE_POINTS: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };

/**
 * Rough static-exchange check: after playing `uci` from `fenBefore`, can the
 * opponent win >= SACRIFICE_MIN_POINTS of material on the destination square?
 * Approximation (least-attacker vs defenders count), documented as such —
 * good enough to tell a real sacrifice from a plain good move.
 */
export function isSacrifice(fenBefore: string, uci: string): boolean {
  try {
    const chess = new Chess(fenBefore);
    const mover = chess.turn();
    const opponent = mover === 'w' ? 'b' : 'w';
    const move = chess.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci.length > 4 ? uci[4] : undefined,
    });

    const placedValue = PIECE_POINTS[move.promotion ?? move.piece] ?? 0;
    const capturedValue = move.captured ? PIECE_POINTS[move.captured] : 0;

    const dest = move.to as Square;
    const attackers = chess.attackers(dest, opponent);
    if (attackers.length === 0) return false;

    const defenders = chess.attackers(dest, mover);
    const leastAttackerValue = Math.min(
      ...attackers.map((sq) => PIECE_POINTS[chess.get(sq as Square)?.type ?? 'p'] ?? 1)
    );

    // Opponent takes our piece. If we can't recapture, we lose the full piece;
    // if we can, the attacker at least trades — count the piece-vs-attacker diff.
    const lossIfCaptured = defenders.length === 0 ? placedValue : placedValue - leastAttackerValue;
    const netLoss = lossIfCaptured - capturedValue;
    return netLoss >= SACRIFICE_MIN_POINTS;
  } catch {
    return false;
  }
}

/**
 * Judge one move from the mover's perspective.
 * Scores are white-perspective; `fenBefore` is the position the move was played in.
 */
export function judgeMove(
  before: Score,
  after: Score,
  mover: 'w' | 'b',
  playedUci: string,
  bestUci: string | null,
  fenBefore?: string
): Judgment {
  const sign = mover === 'w' ? 1 : -1;
  const cpBefore = sign * scoreToCp(before);
  const cpAfter = sign * scoreToCp(after);
  const loss = cpBefore - cpAfter;

  // Delivering checkmate is always best, even when the engine's bestUci was a
  // different mate (terminalScore gives the mated position the full MATE_CP).
  const deliversMate = cpAfter >= MATE_CP;

  if (deliversMate || (bestUci && playedUci === bestUci)) {
    if (fenBefore && cpAfter >= -50 && isSacrifice(fenBefore, playedUci)) return 'brilliant';
    return 'best';
  }

  if (loss >= MISTAKE_CP && cpBefore >= MISS_WINNING_BEFORE_CP && cpAfter <= MISS_LOST_AFTER_CP) {
    return 'miss';
  }
  if (loss >= BLUNDER_CP) return 'blunder';
  if (loss >= MISTAKE_CP) return 'mistake';
  if (loss >= IMPRECISION_CP) return 'imprecision';
  if (loss >= GOOD_CP) return 'ok';
  return 'good';
}

export interface JudgedInput {
  /** Scores for positions 0..N (position i = after i plies), white perspective. */
  positionScores: Score[];
  /** Engine best move (UCI) for positions 0..N-1. */
  bestUcis: (string | null)[];
  /** The moves actually played, UCI, length N. */
  playedUcis: string[];
  /** FENs for positions 0..N (needed for sacrifice detection). */
  fens?: string[];
}

/** Judgments for every move of a game (index = ply, 0-based). */
export function judgeGame({ positionScores, bestUcis, playedUcis, fens }: JudgedInput): Judgment[] {
  const judgments: Judgment[] = [];
  for (let i = 0; i < playedUcis.length; i++) {
    const before = positionScores[i];
    const after = positionScores[i + 1];
    if (!before || !after) break;
    judgments.push(
      judgeMove(before, after, i % 2 === 0 ? 'w' : 'b', playedUcis[i], bestUcis[i] ?? null, fens?.[i])
    );
  }
  return judgments;
}

/** Per-player counts for the review summary. */
export function judgmentCounts(judgments: Judgment[]): Record<Judgment, { white: number; black: number }> {
  const counts = Object.fromEntries(
    JUDGMENT_ORDER.map((j) => [j, { white: 0, black: 0 }])
  ) as Record<Judgment, { white: number; black: number }>;
  judgments.forEach((judgment, ply) => {
    counts[judgment][ply % 2 === 0 ? 'white' : 'black']++;
  });
  return counts;
}
