import { Chess } from 'chess.js';
import {
  isSymmetric,
  timeControlTag,
  type PlayerTimeControls,
} from '../chess/clock';
import {
  applyCastle,
  castlingStateAfterMove,
  castlingStateFromFen,
  engineFen,
  legalCastles,
  withCastlingField,
  type Variant,
} from '../chess/chess960';
import type { DetectedMove } from '../chess/MoveDetector';

export interface PgnMeta {
  white: string;
  black: string;
  startedAt: number;
  timeControls: PlayerTimeControls;
  result: string; // '1-0' | '0-1' | '1/2-1/2' | '*'
  termination?: string;
  /** Defaults to 'standard'. */
  variant?: Variant;
  /** Start FEN (KQkq X-FEN); required when variant is 'chess960'. */
  startFen?: string;
}

/** PGN date tag: YYYY.MM.DD */
function pgnDate(timestamp: number): string {
  const d = new Date(timestamp);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}.${mm}.${dd}`;
}

/**
 * Full PGN for a game — headers chess.com's importer understands, then the
 * movetext built from the recorded SAN list. (The SAN list, not chess.js
 * history: Chess960 castles are applied via load(), which resets history.)
 */
export function buildPgn(sans: string[], meta: PgnMeta): string {
  const headers: [string, string][] = [
    ['Event', 'Local over-the-board game'],
    ['Site', 'Chess Board Duel'],
    ['Date', pgnDate(meta.startedAt)],
    ['Round', '-'],
    ['White', meta.white || 'White'],
    ['Black', meta.black || 'Black'],
    ['Result', meta.result],
    // A single TimeControl tag stays chess.com-compatible; when the sides
    // differ it holds White's and the custom per-side tags below disambiguate.
    ['TimeControl', timeControlTag(meta.timeControls.w)],
  ];
  if (!isSymmetric(meta.timeControls)) {
    headers.push(['WhiteTimeControl', timeControlTag(meta.timeControls.w)]);
    headers.push(['BlackTimeControl', timeControlTag(meta.timeControls.b)]);
  }
  if (meta.variant === 'chess960' && meta.startFen) {
    headers.push(['Variant', 'Chess960']);
    headers.push(['SetUp', '1']);
    headers.push(['FEN', meta.startFen]);
  }
  if (meta.termination) headers.push(['Termination', meta.termination]);

  const headerText = headers.map(([k, v]) => `[${k} "${v}"]`).join('\n');

  const parts: string[] = [];
  for (let i = 0; i < sans.length; i += 2) {
    parts.push(`${i / 2 + 1}.`, sans[i]);
    if (sans[i + 1]) parts.push(sans[i + 1]);
  }
  parts.push(meta.result);

  return `${headerText}\n\n${parts.join(' ')}\n`;
}

/**
 * A replayed ply: chess.js-loadable FENs in `before`/`after` (castling '-'
 * for 960), plus engine FENs carrying real castling rights (Shredder rook
 * files) for Stockfish in UCI_Chess960 mode.
 */
export interface ReplayMove extends DetectedMove {
  beforeEngine: string;
  afterEngine: string;
}

export interface ParsedGame {
  variant: Variant;
  /** chess.js-loadable start FEN (castling '-' for 960). */
  startFen: string;
  /** Start FEN for the engine (castling rights intact). */
  startEngineFen: string;
  moves: ReplayMove[];
}

const HEADER_RE = /\[\s*(\w+)\s*"([^"]*)"\s*\]/g;

function parseHeaders(pgn: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of pgn.matchAll(HEADER_RE)) out[m[1]] = m[2];
  return out;
}

/** Movetext SAN tokens: headers, comments, NAGs, move numbers, result stripped. */
function sanTokens(pgn: string): string[] {
  return pgn
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\{[^}]*\}/g, '')
    .split(/\s+/)
    .filter(
      (tok) =>
        tok.length > 0 &&
        !/^\d+\.+$/.test(tok) &&
        !/^\$\d+$/.test(tok) &&
        !['1-0', '0-1', '1/2-1/2', '*'].includes(tok)
    )
    .map((tok) => tok.replace(/^\d+\.+/, '')); // "1.e4" style
}

/**
 * Replay a stored game. Variant/startFen normally come from the DB row; the
 * PGN's own headers are the fallback. Standard games go through chess.js
 * loadPgn; Chess960 games are replayed move by move with castles applied by
 * the chess960 module.
 */
export function parseGamePgn(
  pgn: string,
  opts?: { variant?: Variant; startFen?: string }
): ParsedGame {
  const headers = parseHeaders(pgn);
  const headerVariant = /chess960|fischer/i.test(headers.Variant ?? '')
    ? 'chess960'
    : 'standard';
  const variant: Variant = opts?.variant ?? headerVariant;
  const startFen = opts?.startFen ?? headers.FEN ?? new Chess().fen();

  if (variant !== 'chess960') {
    const chess = new Chess();
    chess.loadPgn(pgn);
    const moves = chess.history({ verbose: true }).map((m) => ({
      ...(m as DetectedMove),
      beforeEngine: m.before,
      afterEngine: m.after,
    }));
    return { variant, startFen, startEngineFen: startFen, moves };
  }

  const chess = new Chess(withCastlingField(startFen, '-'));
  let castling = castlingStateFromFen(startFen);
  const startEngineFen = engineFen(chess, castling);
  const moves: ReplayMove[] = [];

  for (const san of sanTokens(pgn)) {
    const beforeEngine = engineFen(chess, castling);
    let detected: DetectedMove;
    if (san.startsWith('O-O')) {
      const side = san.startsWith('O-O-O') ? 'q' : 'k';
      const castle = legalCastles(chess, castling).find((c) => c.side === side);
      if (!castle) throw new Error(`Illegal castle in PGN: ${san}`);
      detected = applyCastle(chess, castle);
      castling = {
        ...castling,
        [castle.color]: { king: castling[castle.color].king, rooks: { k: null, q: null } },
      };
    } else {
      const applied = chess.move(san);
      castling = castlingStateAfterMove(castling, applied);
      detected = applied as DetectedMove;
    }
    moves.push({ ...detected, beforeEngine, afterEngine: engineFen(chess, castling) });
  }

  return { variant, startFen: withCastlingField(startFen, '-'), startEngineFen, moves };
}

/**
 * UCI string for a replayed move. Chess960 castles use king-takes-rook
 * notation — what Stockfish emits (and expects) in UCI_Chess960 mode.
 */
export function uciForMove(m: Pick<ReplayMove, 'from' | 'to' | 'promotion' | 'rookFrom'>): string {
  if (m.rookFrom) return `${m.from}${m.rookFrom}`;
  return `${m.from}${m.to}${m.promotion ?? ''}`;
}
