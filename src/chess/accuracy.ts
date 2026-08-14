import { scoreToCp, type Score } from './evalUtils';

/**
 * Accuracy metric following lichess's published formula
 * (https://lichess.org/page/accuracy): win-percentage swings per move,
 * mapped through an exponential to a 0-100 score. Chess.com's own formula is
 * proprietary; this is the standard open equivalent.
 */

/** Win probability for white, 0..100, from a white-perspective score. */
export function winPctFromScore(score: Score): number {
  const cp = scoreToCp(score);
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

/**
 * Accuracy of each move (0..100), index = 0-based ply.
 * `positionScores` are white-perspective scores for positions 0..N.
 */
export function moveAccuracies(positionScores: Score[]): number[] {
  const accuracies: number[] = [];
  for (let i = 0; i + 1 < positionScores.length; i++) {
    const moverIsWhite = i % 2 === 0;
    const before = winPctFromScore(positionScores[i]);
    const after = winPctFromScore(positionScores[i + 1]);
    // Win% lost by the mover; gaining ground counts as a perfect move.
    const drop = Math.max(0, moverIsWhite ? before - after : after - before);
    const raw = 103.1668 * Math.exp(-0.04354 * drop) - 3.1669;
    accuracies.push(Math.max(0, Math.min(100, raw)));
  }
  return accuracies;
}

/** Mean accuracy per player over the whole game. */
export function gameAccuracy(positionScores: Score[]): { white: number; black: number } {
  const perMove = moveAccuracies(positionScores);
  const white: number[] = [];
  const black: number[] = [];
  perMove.forEach((acc, ply) => (ply % 2 === 0 ? white : black).push(acc));
  const mean = (values: number[]) =>
    values.length === 0 ? 100 : values.reduce((a, b) => a + b, 0) / values.length;
  return { white: mean(white), black: mean(black) };
}
