import { Chess, type Move } from 'chess.js';
import { diffOccupancy, occupancyEquals, type Occupancy } from '../ble/protocol';

export type DetectorEvent =
  /** Physical board matches the expected position (also clears a previous illegal state). */
  | { type: 'match' }
  /** A legal move was completed on the physical board and applied to the game. */
  | { type: 'move'; move: Move }
  /** Board differs from expected but only briefly (piece in the air, capture in progress). */
  | { type: 'transient' }
  /** Board has been stable in a position that is neither expected nor one legal move away. */
  | { type: 'illegal'; mismatches: string[] };

const DEFAULT_DEBOUNCE_MS = 500;

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
 */
export class MoveDetector {
  readonly chess: Chess;
  private readonly debounceMs: number;
  private expectedOcc: Occupancy;
  private unexplained: { occ: Occupancy; since: number } | null = null;

  constructor(chess?: Chess, opts?: { debounceMs?: number }) {
    this.chess = chess ?? new Chess();
    this.debounceMs = opts?.debounceMs ?? DEFAULT_DEBOUNCE_MS;
    this.expectedOcc = occupancyFromChess(this.chess);
  }

  get expectedOccupancy(): Occupancy {
    return this.expectedOcc;
  }

  /** Feed one physical-board frame. `now` is a millisecond timestamp (e.g. Date.now()). */
  onFrame(occ: Occupancy, now: number): DetectorEvent {
    if (occupancyEquals(occ, this.expectedOcc)) {
      this.unexplained = null;
      return { type: 'match' };
    }

    const move = this.findCompletedMove(occ);
    if (move) {
      this.expectedOcc = occupancyFromChess(this.chess);
      this.unexplained = null;
      return { type: 'move', move };
    }

    if (this.unexplained && occupancyEquals(occ, this.unexplained.occ)) {
      if (now - this.unexplained.since >= this.debounceMs) {
        return { type: 'illegal', mismatches: diffOccupancy(this.expectedOcc, occ) };
      }
      return { type: 'transient' };
    }

    this.unexplained = { occ, since: now };
    return { type: 'transient' };
  }

  /**
   * If `occ` is exactly the position after one legal move from the current
   * position, apply that move to the game and return it.
   */
  private findCompletedMove(occ: Occupancy): Move | null {
    for (const candidate of this.chess.moves({ verbose: true })) {
      this.chess.move(candidate);
      const matches = occupancyEquals(occupancyFromChess(this.chess), occ);
      if (matches) return candidate;
      this.chess.undo();
    }
    return null;
  }
}
