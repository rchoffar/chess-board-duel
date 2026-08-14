import { Chess, type Move } from 'chess.js';
import { diffOccupancy, occupancyEquals, type Occupancy } from '../ble/protocol';
import {
  applyCastle,
  castleOccupancy,
  castlingStateAfterMove,
  legalCastles,
  type Castle960Move,
  type CastlingState,
} from './chess960';

/**
 * A committed (or previewed) move, portable across variants. chess.js verbose
 * moves satisfy this structurally; Chess960 castles are built by hand since
 * chess.js cannot represent them.
 */
export interface DetectedMove {
  san: string;
  color: 'w' | 'b';
  /** King squares for castles. */
  from: string;
  to: string;
  piece: string;
  /** chess.js flag letters; contains 'k'/'q' for castles. */
  flags: string;
  captured?: string;
  promotion?: string;
  /** FEN before/after the move (chess.js-loadable). */
  before: string;
  after: string;
  /** Rook squares, set only for Chess960 castles. */
  rookFrom?: string;
  rookTo?: string;
}

export type DetectorEvent =
  /** Physical board matches the expected position (also clears a previous illegal state). */
  | { type: 'match' }
  /** A legal move was completed on the physical board and applied to the game. */
  | { type: 'move'; move: DetectedMove; completedAt: number }
  /** Position matches a legal move but hasn't been stable long enough to commit yet. */
  | { type: 'pending'; move: DetectedMove }
  /** Board differs from expected but only briefly (piece in the air, capture in progress). */
  | { type: 'transient' }
  /** Board has been stable in a position that is neither expected nor one legal move away. */
  | { type: 'illegal'; mismatches: string[] };

type Candidate =
  | { kind: 'normal'; move: Move }
  | { kind: 'castle'; castle: Castle960Move };

const DEFAULT_DEBOUNCE_MS = 500;
const DEFAULT_MOVE_CONFIRM_MS = 400;

/** Occupancy (a1..h8, FEN piece letters) of a chess.js position. */
export function occupancyFromChess(chess: Chess): Occupancy {
  const occ: Occupancy = new Array(64).fill(null);
  // chess.board() returns ranks 8 -> 1, files a -> h
  const board = chess.board();
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const cell = board[r][f];
      if (cell) {
        const index = (7 - r) * 8 + f;
        occ[index] = cell.color === 'w' ? cell.type.toUpperCase() : cell.type;
      }
    }
  }
  return occ;
}

/**
 * Turns the stream of physical-board occupancy frames into game events.
 *
 * The Chessnut board reports which piece sits on which square — never moves.
 * This class owns a chess.js instance (the expected position) and interprets
 * each frame as: still the expected position, a completed legal move, a
 * transient in-between state, or (after a debounce) an illegal position.
 *
 * A legal-move position is only committed after it has been stable for
 * `moveConfirmMs`: sliding a piece across the board passes through squares
 * that are themselves legal destinations (e.g. Qd1–h5 passes e2/f3/g4), and
 * committing instantly would record the wrong move.
 *
 * Exception (`allowTakeBack`): when a pending capture is answered by a
 * recapture on the same square before the confirmation delay elapses, the
 * recapture is physical proof the capture happened, so the pending capture is
 * committed immediately. The recapture itself is then detected normally when
 * the same frame is evaluated against the advanced position.
 *
 * Chess960 (`opts.castling` set): chess.js runs with castling rights stripped,
 * so castle candidates are generated here — after the normal candidates — by
 * comparing the frame against each legal castle's resulting occupancy. There
 * is no real ambiguity: a rook-only castle crosses the stationary king's
 * square (illegal as a plain rook move) and a king-only castle spans ≥2
 * squares, and frames carry piece identity.
 */
export class MoveDetector {
  readonly chess: Chess;
  private readonly debounceMs: number;
  private readonly moveConfirmMs: number;
  private readonly allowTakeBack: boolean;
  private castling: CastlingState | null;
  private expectedOcc: Occupancy;
  private unexplained: { occ: Occupancy; since: number } | null = null;
  private pendingMove: {
    occ: Occupancy;
    candidate: Candidate;
    preview: DetectedMove;
    since: number;
  } | null = null;
  /** One entry per committed move, so undo works across castles (which reset chess.js history). */
  private history: { move: DetectedMove; beforeFen: string; castling: CastlingState | null }[] =
    [];

  constructor(
    chess?: Chess,
    opts?: {
      debounceMs?: number;
      moveConfirmMs?: number;
      allowTakeBack?: boolean;
      /** Chess960 castling origins; enables 960 castle detection when set. */
      castling?: CastlingState | null;
    }
  ) {
    this.chess = chess ?? new Chess();
    this.debounceMs = opts?.debounceMs ?? DEFAULT_DEBOUNCE_MS;
    this.moveConfirmMs = opts?.moveConfirmMs ?? DEFAULT_MOVE_CONFIRM_MS;
    this.allowTakeBack = opts?.allowTakeBack ?? true;
    this.castling = opts?.castling ?? null;
    this.expectedOcc = occupancyFromChess(this.chess);
  }

  get expectedOccupancy(): Occupancy {
    return this.expectedOcc;
  }

  /** Legal Chess960 castles in the current position (empty when not 960). */
  availableCastles(): Castle960Move[] {
    return this.castling ? legalCastles(this.chess, this.castling) : [];
  }

  /**
   * Milliseconds after which a re-check (feeding the same frame again) can
   * change the outcome. Used by callers to schedule a re-feed timer, since the
   * board may not send another frame while the position is stable.
   */
  get maxSettleMs(): number {
    return Math.max(this.debounceMs, this.moveConfirmMs) + 50;
  }

  /** Take back the last committed move and resync the expected occupancy. */
  undo(): DetectedMove | null {
    const entry = this.history.pop();
    if (!entry) return null;
    let undone: DetectedMove | null;
    if (this.castling === null) {
      undone = (this.chess.undo() as DetectedMove | null) ?? null;
      if (!undone) return null;
    } else {
      // 960: castles are applied via load(), which wipes chess.js history —
      // restore from our own snapshot instead.
      undone = entry.move;
      this.chess.load(entry.beforeFen);
      this.castling = entry.castling;
    }
    this.expectedOcc = occupancyFromChess(this.chess);
    this.pendingMove = null;
    this.unexplained = null;
    return undone;
  }

  /** Feed one physical-board frame. `now` is a millisecond timestamp (e.g. Date.now()). */
  onFrame(occ: Occupancy, now: number): DetectorEvent {
    if (occupancyEquals(occ, this.expectedOcc)) {
      this.unexplained = null;
      this.pendingMove = null;
      return { type: 'match' };
    }

    const candidate = this.findCandidateMove(occ);
    if (candidate) {
      this.unexplained = null;
      if (this.pendingMove && occupancyEquals(occ, this.pendingMove.occ)) {
        if (now - this.pendingMove.since >= this.moveConfirmMs) {
          return this.commitCandidate(this.pendingMove.candidate, this.pendingMove.since);
        }
        return { type: 'pending', move: this.pendingMove.preview };
      }
      if (this.moveConfirmMs <= 0) {
        return this.commitCandidate(candidate, now);
      }
      const preview = this.previewOf(candidate);
      this.pendingMove = { occ: [...occ], candidate, preview, since: now };
      return { type: 'pending', move: preview };
    }

    if (this.allowTakeBack && this.pendingMove && this.findRecaptureMove(occ)) {
      // A recapture on the pending capture's square proves the capture was
      // real — commit it now; the recapture itself is picked up when this
      // frame is evaluated again against the advanced position.
      return this.commitCandidate(this.pendingMove.candidate, this.pendingMove.since);
    }
    // Keep a pending capture alive through the recapture's lift window (the
    // recapturing piece in the air is a no-candidate frame).
    if (!(this.allowTakeBack && this.pendingCapture())) {
      this.pendingMove = null;
    }
    if (this.unexplained && occupancyEquals(occ, this.unexplained.occ)) {
      if (now - this.unexplained.since >= this.debounceMs) {
        return { type: 'illegal', mismatches: diffOccupancy(this.expectedOcc, occ) };
      }
      return { type: 'transient' };
    }

    this.unexplained = { occ: [...occ], since: now };
    return { type: 'transient' };
  }

  /** The pending move, if it is a capture (castles never capture). */
  private pendingCapture(): Move | null {
    if (this.pendingMove?.candidate.kind !== 'normal') return null;
    return this.pendingMove.candidate.move.captured ? this.pendingMove.candidate.move : null;
  }

  /** DetectedMove for an unapplied candidate (castles applied on a scratch board). */
  private previewOf(candidate: Candidate): DetectedMove {
    if (candidate.kind === 'normal') return candidate.move as DetectedMove;
    return applyCastle(new Chess(this.chess.fen()), candidate.castle);
  }

  private commitCandidate(candidate: Candidate, completedAt: number): DetectorEvent {
    const beforeFen = this.chess.fen();
    const castlingBefore = this.castling;
    let detected: DetectedMove;
    if (candidate.kind === 'castle') {
      detected = applyCastle(this.chess, candidate.castle);
      if (this.castling) {
        const color = candidate.castle.color;
        this.castling = {
          ...this.castling,
          [color]: { king: this.castling[color].king, rooks: { k: null, q: null } },
        };
      }
    } else {
      const applied = this.chess.move(candidate.move);
      if (this.castling) this.castling = castlingStateAfterMove(this.castling, applied);
      detected = applied as DetectedMove;
    }
    this.history.push({ move: detected, beforeFen, castling: castlingBefore });
    this.expectedOcc = occupancyFromChess(this.chess);
    this.pendingMove = null;
    this.unexplained = null;
    return { type: 'move', move: detected, completedAt };
  }

  /**
   * If `occ` is exactly the position after one legal move from the current
   * position, return that move (without applying it).
   */
  private findCandidateMove(occ: Occupancy): Candidate | null {
    for (const candidate of this.chess.moves({ verbose: true })) {
      this.chess.move(candidate);
      const matches = occupancyEquals(occupancyFromChess(this.chess), occ);
      this.chess.undo();
      if (matches) return { kind: 'normal', move: candidate };
    }
    if (this.castling) {
      for (const castle of legalCastles(this.chess, this.castling)) {
        if (occupancyEquals(castleOccupancy(this.expectedOcc, castle), occ)) {
          return { kind: 'castle', castle };
        }
      }
    }
    return null;
  }

  /**
   * If `occ` is the pending position after one legal capture on the pending
   * move's destination square, return that recapture (without applying it).
   */
  private findRecaptureMove(occ: Occupancy): Move | null {
    const pending = this.pendingCapture();
    if (!pending) return null;
    const to = pending.to;
    this.chess.move(pending);
    let found: Move | null = null;
    for (const reply of this.chess.moves({ verbose: true })) {
      if (!reply.captured || reply.to !== to) continue;
      this.chess.move(reply);
      const matches = occupancyEquals(occupancyFromChess(this.chess), occ);
      this.chess.undo();
      if (matches) {
        found = reply;
        break;
      }
    }
    this.chess.undo();
    return found;
  }
}
