// Pure geometry for the best-move arrow overlay. No RN imports; unit-tested.

export interface Point {
  x: number;
  y: number;
}

export interface ArrowSpec {
  /** SVG path `d` for the stroked shaft (ends short of the tip). */
  shaft: string;
  /** SVG polygon `points` for the triangular head (tip at the destination center). */
  head: string;
}

type Orientation = 'white' | 'black';

// Proportions relative to squareSize, tuned to chess.com's look.
const STROKE_RATIO = 0.22;
const HEAD_LENGTH_RATIO = 0.32;
const HEAD_HALF_WIDTH_RATIO = 0.3;
const START_OFFSET_RATIO = 0.38;

export const ARROW_STROKE_RATIO = STROKE_RATIO;

function fileOf(square: string): number {
  return square.charCodeAt(0) - 97;
}

function rankOf(square: string): number {
  return Number(square[1]) - 1;
}

/** Top-left corner of a square in board pixels, honoring orientation. */
export function squareTopLeft(square: string, squareSize: number, orientation: Orientation): Point {
  const file = fileOf(square);
  const rank = rankOf(square);
  const col = orientation === 'white' ? file : 7 - file;
  const row = orientation === 'white' ? 7 - rank : rank;
  return { x: col * squareSize, y: row * squareSize };
}

/** Center of a square in board pixels, honoring orientation. */
export function squareCenter(square: string, squareSize: number, orientation: Orientation): Point {
  const { x, y } = squareTopLeft(square, squareSize, orientation);
  return { x: x + squareSize / 2, y: y + squareSize / 2 };
}

export function isKnightMove(from: string, to: string): boolean {
  const df = Math.abs(fileOf(to) - fileOf(from));
  const dr = Math.abs(rankOf(to) - rankOf(from));
  return df > 0 && dr > 0 && df + dr === 3;
}

function normalize(from: Point, to: Point): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  return { x: dx / len, y: dy / len };
}

function fmt(n: number): string {
  return String(Math.round(n * 100) / 100);
}

/**
 * Build the shaft path + head polygon for a move arrow. Knight moves bend as
 * an L: long leg first, then the perpendicular short leg (chess.com style).
 * The start is offset from the origin center so the piece stays visible;
 * the head's tip lands exactly on the destination center.
 */
export function buildArrow(
  from: string,
  to: string,
  squareSize: number,
  orientation: Orientation
): ArrowSpec {
  const a = squareCenter(from, squareSize, orientation);
  const b = squareCenter(to, squareSize, orientation);
  const startOffset = START_OFFSET_RATIO * squareSize;
  const headLength = HEAD_LENGTH_RATIO * squareSize;
  const headHalfWidth = HEAD_HALF_WIDTH_RATIO * squareSize;

  let points: Point[]; // shaft vertices: start [, corner], shaftEnd
  let lastLegDir: Point;

  if (isKnightMove(from, to)) {
    const df = Math.abs(fileOf(to) - fileOf(from));
    // Long leg first (the 2-square component). df === 2 → the corner is at
    // (fileTo, rankFrom); otherwise the rank component is long → (fileFrom, rankTo).
    const corner =
      df === 2
        ? squareCenter(`${to[0]}${from[1]}`, squareSize, orientation)
        : squareCenter(`${from[0]}${to[1]}`, squareSize, orientation);
    const firstDir = normalize(a, corner);
    lastLegDir = normalize(corner, b);
    const start = { x: a.x + firstDir.x * startOffset, y: a.y + firstDir.y * startOffset };
    const shaftEnd = { x: b.x - lastLegDir.x * headLength, y: b.y - lastLegDir.y * headLength };
    points = [start, corner, shaftEnd];
  } else {
    lastLegDir = normalize(a, b);
    const start = { x: a.x + lastLegDir.x * startOffset, y: a.y + lastLegDir.y * startOffset };
    const shaftEnd = { x: b.x - lastLegDir.x * headLength, y: b.y - lastLegDir.y * headLength };
    points = [start, shaftEnd];
  }

  const shaft =
    `M ${fmt(points[0].x)} ${fmt(points[0].y)} ` +
    points
      .slice(1)
      .map((p) => `L ${fmt(p.x)} ${fmt(p.y)}`)
      .join(' ');

  const base = points[points.length - 1];
  const perp = { x: -lastLegDir.y, y: lastLegDir.x };
  const head = [
    { x: b.x, y: b.y },
    { x: base.x + perp.x * headHalfWidth, y: base.y + perp.y * headHalfWidth },
    { x: base.x - perp.x * headHalfWidth, y: base.y - perp.y * headHalfWidth },
  ]
    .map((p) => `${fmt(p.x)},${fmt(p.y)}`)
    .join(' ');

  return { shaft, head };
}
