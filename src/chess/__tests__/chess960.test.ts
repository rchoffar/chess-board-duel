import { Chess } from 'chess.js';
import {
  CHESS960_STANDARD_INDEX,
  applyCastle,
  castleOccupancy,
  castlingStateFromFen,
  castlingStateAfterMove,
  chess960Fen,
  engineFen,
  legalCastles,
  randomChess960Index,
  shredderCastling,
  toChessJsFen,
  withCastlingField,
  type CastlingState,
} from '../chess960';
import { occupancyFromChess } from '../MoveDetector';
import { squareIndex } from '../../ble/protocol';

const STANDARD_FEN = new Chess().fen();

describe('chess960Fen', () => {
  it('produces the standard start at index 518', () => {
    expect(chess960Fen(CHESS960_STANDARD_INDEX)).toBe(STANDARD_FEN);
  });

  it('throws outside 0..959 or on non-integers', () => {
    expect(() => chess960Fen(-1)).toThrow();
    expect(() => chess960Fen(960)).toThrow();
    expect(() => chess960Fen(1.5)).toThrow();
  });

  it('generates 960 unique, structurally valid positions', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 960; i++) {
      const fen = chess960Fen(i);
      seen.add(fen);
      const back = fen.split('/')[0];
      expect(back).toHaveLength(8);
      expect([...back].sort().join('')).toBe('bbknnqrr');
      // bishops on opposite colors
      const b1 = back.indexOf('b');
      const b2 = back.indexOf('b', b1 + 1);
      expect((b1 + b2) % 2).toBe(1);
      // king strictly between the rooks
      const r1 = back.indexOf('r');
      const r2 = back.indexOf('r', r1 + 1);
      const k = back.indexOf('k');
      expect(k).toBeGreaterThan(r1);
      expect(k).toBeLessThan(r2);
      // white back rank mirrors black
      expect(fen.split(' ')[0].split('/')[7]).toBe(back.toUpperCase());
    }
    expect(seen.size).toBe(960);
  });

  it('randomChess960Index stays in range and follows the rng', () => {
    expect(randomChess960Index(() => 0)).toBe(0);
    expect(randomChess960Index(() => 0.999999)).toBe(959);
    expect(randomChess960Index(() => 0.5)).toBe(480);
  });
});

describe('castlingStateFromFen', () => {
  it('reads king and rook origins from the standard start', () => {
    const state = castlingStateFromFen(STANDARD_FEN);
    expect(state.w).toEqual({ king: 'e1', rooks: { k: 'h1', q: 'a1' } });
    expect(state.b).toEqual({ king: 'e8', rooks: { k: 'h8', q: 'a8' } });
  });

  it('reads a shuffled back rank (BBQNNRKR)', () => {
    const fen = 'bbqnnrkr/pppppppp/8/8/8/8/PPPPPPPP/BBQNNRKR w KQkq - 0 1';
    const state = castlingStateFromFen(fen);
    expect(state.w).toEqual({ king: 'g1', rooks: { k: 'h1', q: 'f1' } });
    expect(state.b).toEqual({ king: 'g8', rooks: { k: 'h8', q: 'f8' } });
  });
});

describe('castlingStateAfterMove', () => {
  const initial = castlingStateFromFen(STANDARD_FEN);

  it('a king move clears both of the mover’s rights', () => {
    const next = castlingStateAfterMove(initial, {
      color: 'w',
      piece: 'k',
      from: 'e1',
      to: 'e2',
    });
    expect(next.w.rooks).toEqual({ k: null, q: null });
    expect(next.b.rooks).toEqual({ k: 'h8', q: 'a8' });
  });

  it('a rook leaving its origin clears only that side', () => {
    const next = castlingStateAfterMove(initial, {
      color: 'b',
      piece: 'r',
      from: 'h8',
      to: 'g8',
    });
    expect(next.b.rooks).toEqual({ k: null, q: 'a8' });
  });

  it('a capture on an enemy rook origin clears the enemy side', () => {
    const next = castlingStateAfterMove(initial, {
      color: 'w',
      piece: 'b',
      from: 'e5',
      to: 'h8',
      captured: 'r',
    });
    expect(next.b.rooks).toEqual({ k: null, q: 'a8' });
    expect(next.w.rooks).toEqual({ k: 'h1', q: 'a1' });
  });

  it('a capture elsewhere keeps all rights', () => {
    const next = castlingStateAfterMove(initial, {
      color: 'w',
      piece: 'n',
      from: 'f3',
      to: 'e5',
      captured: 'p',
    });
    expect(next).toEqual(initial);
  });
});

describe('legalCastles', () => {
  /** 960-style position loader: castling runs with '-', rights live in `state`. */
  function pos(fen: string): Chess {
    return new Chess(withCastlingField(fen, '-'));
  }

  const standardState = castlingStateFromFen(STANDARD_FEN);

  it('finds both castles for white on a cleared standard back rank', () => {
    const chess = pos('r3k2r/8/8/8/8/8/8/R3K2R w - - 0 1');
    const castles = legalCastles(chess, standardState);
    expect(castles).toHaveLength(2);
    expect(castles.map((c) => c.side).sort()).toEqual(['k', 'q']);
    const kingside = castles.find((c) => c.side === 'k')!;
    expect(kingside).toMatchObject({ kingFrom: 'e1', kingTo: 'g1', rookFrom: 'h1', rookTo: 'f1' });
  });

  it('rejects a castle whose right is gone', () => {
    const chess = pos('r3k2r/8/8/8/8/8/8/R3K2R w - - 0 1');
    const state: CastlingState = {
      ...standardState,
      w: { king: 'e1', rooks: { k: null, q: 'a1' } },
    };
    expect(legalCastles(chess, state).map((c) => c.side)).toEqual(['q']);
  });

  it('rejects blocked king and rook paths', () => {
    // bishop on f1 blocks the king path; knight on b1 blocks the rook path
    const chess = pos('4k3/8/8/8/8/8/8/RN2KB1R w - - 0 1');
    expect(legalCastles(chess, standardState)).toHaveLength(0);
  });

  it('rejects castling out of, through, and into check', () => {
    const outOf = pos('k3r3/8/8/8/8/8/8/R3K2R w - - 0 1'); // e1 attacked
    expect(legalCastles(outOf, standardState)).toHaveLength(0);
    const through = pos('k4r2/8/8/8/8/8/8/R3K2R w - - 0 1'); // f1 attacked
    expect(legalCastles(through, standardState).map((c) => c.side)).toEqual(['q']);
    const into = pos('k5r1/8/8/8/8/8/8/R3K2R w - - 0 1'); // g1 attacked
    expect(legalCastles(into, standardState).map((c) => c.side)).toEqual(['q']);
  });

  it('rejects a castle where the rook’s departure unblocks a checking slider', () => {
    // 960-only case: queen a1 is blocked by the rook on b1; after O-O-O
    // (king d1→c1, rook b1→d1) the king on c1 would be in check through b1.
    const state: CastlingState = {
      w: { king: 'd1', rooks: { k: null, q: 'b1' } },
      b: { king: 'e8', rooks: { k: null, q: null } },
    };
    const chess = pos('4k3/8/8/8/8/8/8/qR1K4 w - - 0 1');
    expect(legalCastles(chess, state)).toHaveLength(0);
  });

  it('allows a king-stays castle (king already on g1)', () => {
    // BBQNNRKR-style: king g1, kingside rook h1 → only the rook moves (h1→f1
    // is blocked by... nothing; f1 must be free)
    const state: CastlingState = {
      w: { king: 'g1', rooks: { k: 'h1', q: null } },
      b: { king: 'g8', rooks: { k: null, q: null } },
    };
    const chess = pos('6k1/8/8/8/8/8/8/6KR w - - 0 1');
    const castles = legalCastles(chess, state);
    expect(castles).toHaveLength(1);
    expect(castles[0]).toMatchObject({ kingFrom: 'g1', kingTo: 'g1', rookFrom: 'h1', rookTo: 'f1' });
  });

  it('allows a swap castle (king f1, rook g1)', () => {
    const state: CastlingState = {
      w: { king: 'f1', rooks: { k: 'g1', q: null } },
      b: { king: 'g8', rooks: { k: null, q: null } },
    };
    const chess = pos('6k1/8/8/8/8/8/8/5KR1 w - - 0 1');
    const castles = legalCastles(chess, state);
    expect(castles).toHaveLength(1);
    expect(castles[0]).toMatchObject({ kingFrom: 'f1', kingTo: 'g1', rookFrom: 'g1', rookTo: 'f1' });
  });

  it('generates black castles on rank 8', () => {
    const chess = pos('r3k2r/8/8/8/8/8/8/4K3 b - - 0 1');
    const state: CastlingState = {
      w: { king: 'e1', rooks: { k: null, q: null } },
      b: { king: 'e8', rooks: { k: 'h8', q: 'a8' } },
    };
    const castles = legalCastles(chess, state);
    expect(castles).toHaveLength(2);
    expect(castles.find((c) => c.side === 'q')).toMatchObject({
      kingFrom: 'e8',
      kingTo: 'c8',
      rookFrom: 'a8',
      rookTo: 'd8',
    });
  });
});

describe('castleOccupancy', () => {
  it('transforms a standard kingside castle', () => {
    const chess = new Chess('r3k2r/8/8/8/8/8/8/R3K2R w - - 0 1');
    const occ = occupancyFromChess(chess);
    const after = castleOccupancy(occ, {
      color: 'w',
      side: 'k',
      kingFrom: 'e1',
      kingTo: 'g1',
      rookFrom: 'h1',
      rookTo: 'f1',
    });
    expect(after[squareIndex('e1')]).toBeNull();
    expect(after[squareIndex('h1')]).toBeNull();
    expect(after[squareIndex('g1')]).toBe('K');
    expect(after[squareIndex('f1')]).toBe('R');
  });

  it('handles the swap castle without erasing either piece', () => {
    const chess = new Chess('6k1/8/8/8/8/8/8/5KR1 w - - 0 1');
    const after = castleOccupancy(occupancyFromChess(chess), {
      color: 'w',
      side: 'k',
      kingFrom: 'f1',
      kingTo: 'g1',
      rookFrom: 'g1',
      rookTo: 'f1',
    });
    expect(after[squareIndex('g1')]).toBe('K');
    expect(after[squareIndex('f1')]).toBe('R');
  });

  it('handles a king-stays castle', () => {
    const chess = new Chess('6k1/8/8/8/8/8/8/6KR w - - 0 1');
    const after = castleOccupancy(occupancyFromChess(chess), {
      color: 'w',
      side: 'k',
      kingFrom: 'g1',
      kingTo: 'g1',
      rookFrom: 'h1',
      rookTo: 'f1',
    });
    expect(after[squareIndex('g1')]).toBe('K');
    expect(after[squareIndex('f1')]).toBe('R');
    expect(after[squareIndex('h1')]).toBeNull();
  });
});

describe('applyCastle', () => {
  it('flips the turn, bumps counters, keeps castling/ep at "-"', () => {
    const chess = new Chess('r3k2r/8/8/8/8/8/8/R3K2R w - - 3 7');
    const move = applyCastle(chess, {
      color: 'w',
      side: 'k',
      kingFrom: 'e1',
      kingTo: 'g1',
      rookFrom: 'h1',
      rookTo: 'f1',
    });
    const fields = chess.fen().split(' ');
    expect(fields[1]).toBe('b');
    expect(fields[2]).toBe('-');
    expect(fields[3]).toBe('-');
    expect(fields[4]).toBe('4');
    expect(fields[5]).toBe('7');
    expect(move.san).toBe('O-O');
    expect(move).toMatchObject({ from: 'e1', to: 'g1', rookFrom: 'h1', rookTo: 'f1', piece: 'k' });
    expect(move.before).toContain(' w ');
    expect(move.after).toBe(chess.fen());
  });

  it('bumps the fullmove number after a black castle', () => {
    const chess = new Chess('r3k2r/8/8/8/8/8/8/4K3 b - - 0 12');
    applyCastle(chess, {
      color: 'b',
      side: 'q',
      kingFrom: 'e8',
      kingTo: 'c8',
      rookFrom: 'a8',
      rookTo: 'd8',
    });
    const fields = chess.fen().split(' ');
    expect(fields[1]).toBe('w');
    expect(fields[5]).toBe('13');
  });

  it('suffixes SAN with + when the castle gives check', () => {
    // rook lands on f1, checking a king on f8
    const chess = new Chess('5k2/8/8/8/8/8/8/4K2R w - - 0 1');
    const move = applyCastle(chess, {
      color: 'w',
      side: 'k',
      kingFrom: 'e1',
      kingTo: 'g1',
      rookFrom: 'h1',
      rookTo: 'f1',
    });
    expect(move.san).toBe('O-O+');
  });
});

describe('Shredder/engine FEN helpers', () => {
  it('builds the Shredder castling field from remaining rights', () => {
    const full = castlingStateFromFen(STANDARD_FEN);
    expect(shredderCastling(full)).toBe('HAha');
    const partial: CastlingState = {
      w: { king: 'e1', rooks: { k: null, q: 'a1' } },
      b: { king: 'e8', rooks: { k: 'h8', q: null } },
    };
    expect(shredderCastling(partial)).toBe('Ah');
    const none: CastlingState = {
      w: { king: 'e1', rooks: { k: null, q: null } },
      b: { king: 'e8', rooks: { k: null, q: null } },
    };
    expect(shredderCastling(none)).toBe('-');
  });

  it('engineFen swaps in the Shredder field', () => {
    const fen = 'bbqnnrkr/pppppppp/8/8/8/8/PPPPPPPP/BBQNNRKR w KQkq - 0 1';
    const chess = new Chess(withCastlingField(fen, '-'));
    const state = castlingStateFromFen(fen);
    expect(engineFen(chess, state).split(' ')[2]).toBe('HFhf');
  });

  it('toChessJsFen keeps KQkq and "-" but strips Shredder letters', () => {
    expect(toChessJsFen(STANDARD_FEN)).toBe(STANDARD_FEN);
    const dash = withCastlingField(STANDARD_FEN, '-');
    expect(toChessJsFen(dash)).toBe(dash);
    const shredder = withCastlingField(STANDARD_FEN, 'HAha');
    expect(toChessJsFen(shredder)).toBe(dash);
  });
});
