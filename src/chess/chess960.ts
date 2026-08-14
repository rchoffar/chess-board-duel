import { Chess, type Color, type PieceSymbol, type Square } from 'chess.js';
import type { Occupancy } from '../ble/protocol';
import type { DetectedMove } from './MoveDetector';

/**
 * Chess960 (Fischer Random) support — pure helpers, no side effects.
 *
 * chess.js has no Chess960 castling: it strips castling rights unless the
 * king/rooks sit on their standard squares and only generates standard-
 * geometry castles. So in 960 games chess.js always runs with castling
 * field '-' (even for position 518 = the standard start) and this module is
 * the only source of castling truth: it tracks rights, validates legality
 * and applies castles to the chess.js instance via load().
 */

export type Variant = 'standard' | 'chess960';

/** The Chess960 index whose start position equals standard chess. */
export const CHESS960_STANDARD_INDEX = 518;

const FILES = 'abcdefgh';

/** Knight placements over the 5 squares left free after bishops + queen. */
const KNIGHT_PAIRS: [number, number][] = [
  [0, 1], [0, 2], [0, 3], [0, 4], [1, 2],
  [1, 3], [1, 4], [2, 3], [2, 4], [3, 4],
];

/**
 * Start FEN for a Chess960 index (0..959), by Scharnagl's derivation.
 * Castling field is 'KQkq' — valid X-FEN at the start since the origin rooks
 * are the outermost (only) rooks. chess960Fen(518) is the standard start FEN.
 */
export function chess960Fen(index: number): string {
  if (!Number.isInteger(index) || index < 0 || index > 959) {
    throw new Error(`Chess960 index out of range: ${index}`);
  }
  const back: (string | null)[] = new Array(8).fill(null);
  const lightBishop = index % 4; // b, d, f, h
  const n2 = Math.floor(index / 4);
  const darkBishop = n2 % 4; // a, c, e, g
  const n3 = Math.floor(n2 / 4);
  const queen = n3 % 6;
  const knights = Math.floor(n3 / 6);

  back[1 + 2 * lightBishop] = 'b';
  back[2 * darkBishop] = 'b';

  const freeAfterBishops = freeIndices(back);
  back[freeAfterBishops[queen]] = 'q';

  const freeAfterQueen = freeIndices(back);
  const [n1, nn2] = KNIGHT_PAIRS[knights];
  back[freeAfterQueen[n1]] = 'n';
  back[freeAfterQueen[nn2]] = 'n';

  const [r1, k, r2] = freeIndices(back);
  back[r1] = 'r';
  back[k] = 'k';
  back[r2] = 'r';

  const rank = back.join('');
  return `${rank}/pppppppp/8/8/8/8/PPPPPPPP/${rank.toUpperCase()} w KQkq - 0 1`;
}

function freeIndices(back: (string | null)[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < 8; i++) if (back[i] === null) out.push(i);
  return out;
}

export function randomChess960Index(rng: () => number = Math.random): number {
  return Math.min(959, Math.floor(rng() * 960));
}

export type CastleSide = 'k' | 'q';

export interface SideCastling {
  /** King origin square (fixed for the whole game). */
  king: string;
  /** Rook origin squares; null once that right is lost. */
  rooks: { k: string | null; q: string | null };
}

export interface CastlingState {
  w: SideCastling;
  b: SideCastling;
}

/** Derive king + rook origins from ranks 1/8 of a start FEN. */
export function castlingStateFromFen(startFen: string): CastlingState {
  const placement = startFen.split(' ')[0];
  const ranks = placement.split('/');
  return {
    w: sideFromRank(expandRank(ranks[7]), '1', 'K', 'R'),
    b: sideFromRank(expandRank(ranks[0]), '8', 'k', 'r'),
  };
}

function expandRank(rank: string): (string | null)[] {
  const out: (string | null)[] = [];
  for (const ch of rank) {
    if (ch >= '1' && ch <= '8') {
      for (let i = 0; i < Number(ch); i++) out.push(null);
    } else {
      out.push(ch);
    }
  }
  return out;
}

function sideFromRank(
  cells: (string | null)[],
  rank: string,
  kingLetter: string,
  rookLetter: string
): SideCastling {
  const kingFile = cells.indexOf(kingLetter);
  if (kingFile < 0) throw new Error(`No ${kingLetter} on back rank`);
  let qRook: string | null = null;
  let kRook: string | null = null;
  for (let f = 0; f < 8; f++) {
    if (cells[f] !== rookLetter) continue;
    if (f < kingFile) qRook = FILES[f] + rank;
    else if (f > kingFile) kRook = FILES[f] + rank;
  }
  return { king: FILES[kingFile] + rank, rooks: { k: kRook, q: qRook } };
}

/**
 * Rights update for a NORMAL (non-castle) move: a king move clears both of the
 * mover's rights; a rook leaving its origin clears that side; a capture
 * landing on an enemy rook origin clears the enemy side (a right still held
 * implies the rook is sitting there).
 */
export function castlingStateAfterMove(
  state: CastlingState,
  move: { color: Color; piece: string; from: string; to: string; captured?: string }
): CastlingState {
  const mover = clone(state[move.color]);
  const enemyColor: Color = move.color === 'w' ? 'b' : 'w';
  const enemy = clone(state[enemyColor]);

  if (move.piece === 'k') {
    mover.rooks = { k: null, q: null };
  } else if (move.piece === 'r') {
    if (move.from === mover.rooks.k) mover.rooks.k = null;
    if (move.from === mover.rooks.q) mover.rooks.q = null;
  }
  if (move.captured) {
    if (move.to === enemy.rooks.k) enemy.rooks.k = null;
    if (move.to === enemy.rooks.q) enemy.rooks.q = null;
  }
  return move.color === 'w' ? { w: mover, b: enemy } : { w: enemy, b: mover };
}

function clone(side: SideCastling): SideCastling {
  return { king: side.king, rooks: { ...side.rooks } };
}

export interface Castle960Move {
  color: Color;
  side: CastleSide;
  kingFrom: string;
  kingTo: string; // g1/c1/g8/c8
  rookFrom: string;
  rookTo: string; // f1/d1/f8/d8
}

const KING_TO_FILE: Record<CastleSide, number> = { k: 6, q: 2 };
const ROOK_TO_FILE: Record<CastleSide, number> = { k: 5, q: 3 };

/**
 * Legal castles for the side to move. Checks: right still held; every square
 * on the king path (origin→destination) and rook path (origin→destination)
 * empty except the king and rook themselves; no king-path square (origin
 * included = not castling out of check) attacked; and — on a scratch board —
 * the king is not attacked in the resulting position (catches enemy sliders
 * unblocked by the rook's departure, a 960-only case).
 */
export function legalCastles(chess: Chess, state: CastlingState): Castle960Move[] {
  const color = chess.turn();
  const side = state[color];
  const enemy: Color = color === 'w' ? 'b' : 'w';
  const rank = color === 'w' ? '1' : '8';
  const out: Castle960Move[] = [];

  for (const cs of ['k', 'q'] as CastleSide[]) {
    const rookFrom = side.rooks[cs];
    if (!rookFrom) continue;
    const kingFrom = side.king;
    const kingTo = FILES[KING_TO_FILE[cs]] + rank;
    const rookTo = FILES[ROOK_TO_FILE[cs]] + rank;
    const castle: Castle960Move = { color, side: cs, kingFrom, kingTo, rookFrom, rookTo };

    if (!pathsClear(chess, castle, rank)) continue;
    if (kingPathAttacked(chess, castle, enemy)) continue;
    if (finalPositionInCheck(chess, castle, enemy)) continue;
    out.push(castle);
  }
  return out;
}

function fileOf(square: string): number {
  return square.charCodeAt(0) - 97;
}

function filesBetweenInclusive(a: string, b: string): number[] {
  const lo = Math.min(fileOf(a), fileOf(b));
  const hi = Math.max(fileOf(a), fileOf(b));
  const out: number[] = [];
  for (let f = lo; f <= hi; f++) out.push(f);
  return out;
}

function pathsClear(chess: Chess, c: Castle960Move, rank: string): boolean {
  const files = new Set([
    ...filesBetweenInclusive(c.kingFrom, c.kingTo),
    ...filesBetweenInclusive(c.rookFrom, c.rookTo),
  ]);
  for (const f of files) {
    const square = (FILES[f] + rank) as Square;
    if (square === c.kingFrom || square === c.rookFrom) continue;
    if (chess.get(square)) return false;
  }
  return true;
}

function kingPathAttacked(chess: Chess, c: Castle960Move, enemy: Color): boolean {
  const rank = c.kingFrom[1];
  for (const f of filesBetweenInclusive(c.kingFrom, c.kingTo)) {
    if (chess.isAttacked((FILES[f] + rank) as Square, enemy)) return true;
  }
  return false;
}

function finalPositionInCheck(chess: Chess, c: Castle960Move, enemy: Color): boolean {
  const scratch = new Chess(withCastlingField(chess.fen(), '-'));
  applyCastlePieces(scratch, c);
  return scratch.isAttacked(c.kingTo as Square, enemy);
}

function applyCastlePieces(chess: Chess, c: Castle960Move): void {
  chess.remove(c.kingFrom as Square);
  chess.remove(c.rookFrom as Square);
  chess.put({ type: 'k' as PieceSymbol, color: c.color }, c.kingTo as Square);
  chess.put({ type: 'r' as PieceSymbol, color: c.color }, c.rookTo as Square);
}

/** Occupancy (a1..h8 piece letters) after a castle — pure array transform. */
export function castleOccupancy(occ: Occupancy, c: Castle960Move): Occupancy {
  const out = [...occ];
  const king = c.color === 'w' ? 'K' : 'k';
  const rook = c.color === 'w' ? 'R' : 'r';
  out[occupancyIndex(c.kingFrom)] = null;
  out[occupancyIndex(c.rookFrom)] = null;
  out[occupancyIndex(c.kingTo)] = king;
  out[occupancyIndex(c.rookTo)] = rook;
  return out;
}

function occupancyIndex(square: string): number {
  return (Number(square[1]) - 1) * 8 + fileOf(square);
}

/**
 * Apply a castle to the live instance. put/remove can't flip the turn, so the
 * position is rebuilt via load() — which wipes chess.js history; movetext must
 * therefore come from the recorded SAN list, and threefold repetition across a
 * castle goes undetected (accepted limitation).
 */
export function applyCastle(chess: Chess, c: Castle960Move): DetectedMove {
  const before = chess.fen();
  applyCastlePieces(chess, c);

  const fields = chess.fen().split(' ');
  fields[1] = c.color === 'w' ? 'b' : 'w';
  fields[2] = '-';
  fields[3] = '-';
  fields[4] = String(Number(fields[4]) + 1);
  if (c.color === 'b') fields[5] = String(Number(fields[5]) + 1);
  chess.load(fields.join(' '));

  let san = c.side === 'k' ? 'O-O' : 'O-O-O';
  if (chess.isCheckmate()) san += '#';
  else if (chess.inCheck()) san += '+';

  return {
    san,
    color: c.color,
    from: c.kingFrom,
    to: c.kingTo,
    piece: 'k',
    flags: c.side,
    before,
    after: chess.fen(),
    rookFrom: c.rookFrom,
    rookTo: c.rookTo,
  };
}

/** Shredder castling field (rook origin file letters, e.g. "HAha"), or '-'. */
export function shredderCastling(state: CastlingState): string {
  let out = '';
  if (state.w.rooks.k) out += state.w.rooks.k[0].toUpperCase();
  if (state.w.rooks.q) out += state.w.rooks.q[0].toUpperCase();
  if (state.b.rooks.k) out += state.b.rooks.k[0];
  if (state.b.rooks.q) out += state.b.rooks.q[0];
  return out || '-';
}

/** chess.js FEN with the castling field replaced — what Stockfish gets. */
export function engineFen(chess: Chess, state: CastlingState): string {
  return withCastlingField(chess.fen(), shredderCastling(state));
}

/** Replace a FEN's castling field. */
export function withCastlingField(fen: string, castling: string): string {
  const fields = fen.split(' ');
  fields[2] = castling;
  return fields.join(' ');
}

/**
 * Make a FEN loadable by chess.js: Shredder-style rook-file castling letters
 * (which chess.js rejects) become '-'; standard KQkq fields pass through.
 */
export function toChessJsFen(fen: string): string {
  const castling = fen.split(' ')[2];
  if (castling === '-' || /^[KQkq]+$/.test(castling)) return fen;
  return withCastlingField(fen, '-');
}
