import { Chess } from 'chess.js';
import { MoveDetector, occupancyFromChess } from '../MoveDetector';
import { castlingStateFromFen, withCastlingField } from '../chess960';
import { squareIndex, startingOccupancy, type Occupancy } from '../../ble/protocol';

/** Occupancy after applying SAN moves from the start position. */
function occAfter(...sans: string[]): Occupancy {
  const chess = new Chess();
  for (const san of sans) chess.move(san);
  return occupancyFromChess(chess);
}

/** Mutate a copy: remove/place pieces by square. */
function withChanges(occ: Occupancy, changes: Record<string, string | null>): Occupancy {
  const copy = [...occ];
  for (const [sq, piece] of Object.entries(changes)) copy[squareIndex(sq)] = piece;
  return copy;
}

/** Detector that commits legal moves immediately (no confirmation delay). */
function instantDetector(chess?: Chess, debounceMs = 500) {
  return new MoveDetector(chess, { debounceMs, moveConfirmMs: 0 });
}

describe('occupancyFromChess', () => {
  it('matches the protocol starting occupancy', () => {
    expect(occupancyFromChess(new Chess())).toEqual(startingOccupancy());
  });
});

describe('MoveDetector (instant commit)', () => {
  it('reports match for the expected position', () => {
    const d = instantDetector();
    expect(d.onFrame(startingOccupancy(), 0)).toEqual({ type: 'match' });
  });

  it('detects a simple pawn move', () => {
    const d = instantDetector();
    const event = d.onFrame(occAfter('e4'), 0);
    expect(event.type).toBe('move');
    if (event.type === 'move') expect(event.move.san).toBe('e4');
    expect(d.chess.fen()).toContain(' b '); // black to move
  });

  it('treats a lifted piece as transient, then detects the completed move', () => {
    const d = instantDetector();
    const lifted = withChanges(startingOccupancy(), { e2: null });
    expect(d.onFrame(lifted, 0).type).toBe('transient');
    const event = d.onFrame(occAfter('e4'), 100);
    expect(event.type).toBe('move');
  });

  it('detects a capture, including the intermediate captured-piece-removed state', () => {
    const d = instantDetector();
    d.onFrame(occAfter('e4'), 0);
    d.onFrame(occAfter('e4', 'd5'), 100);
    // capture in progress: d5 pawn removed from board, e4 pawn lifted
    const midCapture = withChanges(occAfter('e4', 'd5'), { d5: null, e4: null });
    expect(d.onFrame(midCapture, 200).type).toBe('transient');
    const event = d.onFrame(occAfter('e4', 'd5', 'exd5'), 300);
    expect(event.type).toBe('move');
    if (event.type === 'move') expect(event.move.san).toBe('exd5');
  });

  it('detects castling (two pieces moved at once)', () => {
    const chess = new Chess();
    for (const san of ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5']) chess.move(san);
    const d = instantDetector(chess);
    const target = occAfter('e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'O-O');
    const event = d.onFrame(target, 0);
    expect(event.type).toBe('move');
    if (event.type === 'move') expect(event.move.san).toBe('O-O');
  });

  it('detects en passant (captured pawn is on a different square)', () => {
    const chess = new Chess();
    for (const san of ['e4', 'a6', 'e5', 'd5']) chess.move(san);
    const d = instantDetector(chess);
    const target = occAfter('e4', 'a6', 'e5', 'd5', 'exd6');
    const event = d.onFrame(target, 0);
    expect(event.type).toBe('move');
    if (event.type === 'move') expect(event.move.san).toBe('exd6');
  });

  it('detects promotion and the chosen piece', () => {
    const chess = new Chess('8/4P1k1/8/8/8/8/8/4K3 w - - 0 1');
    const d = instantDetector(chess);
    const after = new Chess('4N3/6k1/8/8/8/8/8/4K3 b - - 0 1');
    const event = d.onFrame(occupancyFromChess(after), 0);
    expect(event.type).toBe('move');
    if (event.type === 'move') {
      expect(event.move.promotion).toBe('n');
      expect(event.move.san).toBe('e8=N+');
    }
  });

  it('flags a stable illegal position after the debounce, with mismatched squares', () => {
    const d = instantDetector(new Chess(), 500);
    // white plays Ke3?? from the start — illegal (king can't move there)
    const wrong = withChanges(startingOccupancy(), { e1: null, e3: 'K' });
    expect(d.onFrame(wrong, 0).type).toBe('transient');
    expect(d.onFrame(wrong, 300).type).toBe('transient');
    const event = d.onFrame(wrong, 600);
    expect(event.type).toBe('illegal');
    if (event.type === 'illegal') expect(event.mismatches.sort()).toEqual(['e1', 'e3']);
  });

  it('recovers when the illegal position is corrected back to expected', () => {
    const d = instantDetector(new Chess(), 500);
    const wrong = withChanges(startingOccupancy(), { e1: null, e3: 'K' });
    d.onFrame(wrong, 0);
    expect(d.onFrame(wrong, 600).type).toBe('illegal');
    expect(d.onFrame(startingOccupancy(), 700)).toEqual({ type: 'match' });
    // and a legal move afterwards still works
    expect(d.onFrame(occAfter('e4'), 800).type).toBe('move');
  });

  it('recovers when the illegal position is corrected into a legal move', () => {
    const d = instantDetector(new Chess(), 500);
    const wrong = withChanges(startingOccupancy(), { e2: null, e5: 'P' });
    d.onFrame(wrong, 0);
    expect(d.onFrame(wrong, 600).type).toBe('illegal');
    const event = d.onFrame(occAfter('e4'), 700);
    expect(event.type).toBe('move');
  });

  it('does not flag illegal while the position keeps changing (debounce resets)', () => {
    const d = instantDetector(new Chess(), 500);
    const a = withChanges(startingOccupancy(), { e2: null });
    const b = withChanges(startingOccupancy(), { e2: null, d2: null });
    expect(d.onFrame(a, 0).type).toBe('transient');
    expect(d.onFrame(b, 400).type).toBe('transient');
    expect(d.onFrame(a, 800).type).toBe('transient'); // new unexplained state, timer restarts
  });

  it('any change after checkmate is illegal (no legal moves)', () => {
    const chess = new Chess();
    for (const san of ['f3', 'e5', 'g4', 'Qh4#']) chess.move(san);
    const d = instantDetector(chess, 500);
    const wrong = withChanges(occupancyFromChess(chess), { e1: null, e2: 'K' });
    d.onFrame(wrong, 0);
    expect(d.onFrame(wrong, 600).type).toBe('illegal');
  });
});

describe('MoveDetector (move confirmation delay)', () => {
  it('reports pending until the position has been stable for moveConfirmMs', () => {
    const d = new MoveDetector(new Chess(), { moveConfirmMs: 400 });
    const target = occAfter('e4');
    const first = d.onFrame(target, 1000);
    expect(first.type).toBe('pending');
    expect(d.onFrame(target, 1200).type).toBe('pending');
    const event = d.onFrame(target, 1400);
    expect(event.type).toBe('move');
    if (event.type === 'move') {
      expect(event.move.san).toBe('e4');
      // completion time is when the position was first reached, not confirmed
      expect(event.completedAt).toBe(1000);
    }
  });

  it('does not record squares a sliding piece passes through (Qd1–h5 via e2/f3/g4)', () => {
    const chess = new Chess();
    for (const san of ['e4', 'e5']) chess.move(san);
    const d = new MoveDetector(chess, { moveConfirmMs: 400 });

    // Sliding the queen along the diagonal creates a chain of legal-looking positions.
    expect(d.onFrame(occAfter('e4', 'e5', 'Qe2'), 0).type).toBe('pending');
    expect(d.onFrame(occAfter('e4', 'e5', 'Qf3'), 150).type).toBe('pending');
    expect(d.onFrame(occAfter('e4', 'e5', 'Qg4'), 300).type).toBe('pending');
    expect(d.onFrame(occAfter('e4', 'e5', 'Qh5'), 450).type).toBe('pending');
    // Only the final resting square gets committed.
    const event = d.onFrame(occAfter('e4', 'e5', 'Qh5'), 900);
    expect(event.type).toBe('move');
    if (event.type === 'move') expect(event.move.san).toBe('Qh5');
    expect(d.chess.history()).toEqual(['e4', 'e5', 'Qh5']);
  });

  it('abandons a pending move if the piece returns to its origin', () => {
    const d = new MoveDetector(new Chess(), { moveConfirmMs: 400 });
    expect(d.onFrame(occAfter('e4'), 0).type).toBe('pending');
    expect(d.onFrame(startingOccupancy(), 200)).toEqual({ type: 'match' });
    expect(d.chess.history()).toEqual([]);
  });

  it('exposes maxSettleMs for re-feed scheduling', () => {
    const d = new MoveDetector(new Chess(), { moveConfirmMs: 400, debounceMs: 500 });
    expect(d.maxSettleMs).toBe(550);
  });
});

describe('MoveDetector (fast recapture)', () => {
  function afterE4d5(): Chess {
    const chess = new Chess();
    for (const san of ['e4', 'd5']) chess.move(san);
    return chess;
  }

  it('commits a pending capture as soon as the recapture lands', () => {
    const d = new MoveDetector(afterE4d5(), { moveConfirmMs: 400 });
    expect(d.onFrame(occAfter('e4', 'd5', 'exd5'), 0).type).toBe('pending');
    // recapturing queen lifted off d8, still in the air
    const lifted = withChanges(occAfter('e4', 'd5', 'exd5'), { d8: null });
    expect(d.onFrame(lifted, 150).type).toBe('transient');
    // queen lands on d5 before exd5's confirmation delay elapsed
    const recaptured = occAfter('e4', 'd5', 'exd5', 'Qxd5');
    const first = d.onFrame(recaptured, 300);
    expect(first.type).toBe('move');
    if (first.type === 'move') {
      expect(first.move.san).toBe('exd5');
      expect(first.completedAt).toBe(0);
    }
    // same frame against the advanced position: the recapture confirms normally
    expect(d.onFrame(recaptured, 300).type).toBe('pending');
    const second = d.onFrame(recaptured, 700);
    expect(second.type).toBe('move');
    if (second.type === 'move') {
      expect(second.move.san).toBe('Qxd5');
      expect(second.completedAt).toBe(300);
    }
    expect(d.chess.history()).toEqual(['e4', 'd5', 'exd5', 'Qxd5']);
  });

  it('keeps the old illegal behavior when allowTakeBack is off', () => {
    const d = new MoveDetector(afterE4d5(), { moveConfirmMs: 400, allowTakeBack: false });
    expect(d.onFrame(occAfter('e4', 'd5', 'exd5'), 0).type).toBe('pending');
    const recaptured = occAfter('e4', 'd5', 'exd5', 'Qxd5');
    expect(d.onFrame(recaptured, 300).type).toBe('transient');
    expect(d.onFrame(recaptured, 850).type).toBe('illegal');
    expect(d.chess.history()).toEqual(['e4', 'd5']);
  });

  it('does not trigger for a fast reply to a non-capture (no general lookahead)', () => {
    const d = new MoveDetector(new Chess(), { moveConfirmMs: 400 });
    expect(d.onFrame(occAfter('e4'), 0).type).toBe('pending');
    expect(d.onFrame(occAfter('e4', 'd5'), 150).type).toBe('transient');
    expect(d.chess.history()).toEqual([]);
  });

  it('does not trigger when the fast reply captures on a different square', () => {
    const chess = new Chess();
    for (const san of ['e4', 'd5', 'Nc3', 'dxe4']) chess.move(san);
    const d = new MoveDetector(chess, { moveConfirmMs: 400 });
    expect(d.onFrame(occAfter('e4', 'd5', 'Nc3', 'dxe4', 'Nxe4'), 0).type).toBe('pending');
    // black answers the pending Nxe4 by grabbing the d2 pawn instead
    const wrong = occAfter('e4', 'd5', 'Nc3', 'dxe4', 'Nxe4', 'Qxd2');
    expect(d.onFrame(wrong, 150).type).toBe('transient');
    expect(d.onFrame(wrong, 700).type).toBe('illegal');
    expect(d.chess.history()).toEqual(['e4', 'd5', 'Nc3', 'dxe4']);
  });

  it('still allows retracting a pending capture', () => {
    const d = new MoveDetector(afterE4d5(), { moveConfirmMs: 400 });
    expect(d.onFrame(occAfter('e4', 'd5', 'exd5'), 0).type).toBe('pending');
    expect(d.onFrame(occAfter('e4', 'd5'), 200)).toEqual({ type: 'match' });
    expect(d.chess.history()).toEqual(['e4', 'd5']);
  });

  it('handles a promotion capture answered by a fast recapture', () => {
    const chess = new Chess('5r2/4P1k1/8/8/8/8/8/4K3 w - - 0 1');
    const d = new MoveDetector(chess, { moveConfirmMs: 400 });
    const promoted = new Chess('5r2/4P1k1/8/8/8/8/8/4K3 w - - 0 1');
    promoted.move('exf8=Q+');
    expect(d.onFrame(occupancyFromChess(promoted), 0).type).toBe('pending');
    promoted.move('Kxf8');
    const event = d.onFrame(occupancyFromChess(promoted), 200);
    expect(event.type).toBe('move');
    if (event.type === 'move') expect(event.move.san).toBe('exf8=Q+');
  });
});

describe('MoveDetector (Chess960)', () => {
  // White: Ra1, Kb1, Rc1 (king between the rooks). Kingside castle = Kb1→g1 +
  // Rc1→f1; queenside (Kb1→c1 + Ra1→d1) is blocked by the c1 rook itself.
  const FEN = '1k6/8/8/8/8/8/8/RKR5 w KQkq - 0 1';

  function detector960(moveConfirmMs = 0) {
    return new MoveDetector(new Chess(withCastlingField(FEN, '-')), {
      moveConfirmMs,
      castling: castlingStateFromFen(FEN),
    });
  }

  function startOcc() {
    return occupancyFromChess(new Chess(withCastlingField(FEN, '-')));
  }

  it('detects a 960 kingside castle from the occupancy diff', () => {
    const d = detector960();
    const target = withChanges(startOcc(), { b1: null, c1: null, g1: 'K', f1: 'R' });
    const event = d.onFrame(target, 0);
    expect(event.type).toBe('move');
    if (event.type === 'move') {
      expect(event.move.san).toBe('O-O');
      expect(event.move).toMatchObject({ from: 'b1', to: 'g1', rookFrom: 'c1', rookTo: 'f1' });
    }
    expect(d.chess.fen()).toContain(' b ');
    expect(d.expectedOccupancy).toEqual(target);
  });

  it('does not offer the castle blocked by the other rook', () => {
    const d = detector960();
    expect(d.availableCastles().map((c) => c.side)).toEqual(['k']);
    // queenside castle occupancy (Kc1 + Rd1) is not reachable → transient
    const wrong = withChanges(startOcc(), { b1: null, a1: null, c1: 'K', d1: 'R' });
    expect(d.onFrame(wrong, 0).type).toBe('transient');
  });

  it('detects a rook-stays castle (only the king moves)', () => {
    // King e1, kingside rook already on f1: castle = Ke1→g1, Rf1 stays.
    const fen = '1k6/8/8/8/8/8/8/4KR2 w K - 0 1';
    const state = {
      w: { king: 'e1', rooks: { k: 'f1' as string | null, q: null } },
      b: { king: 'b8', rooks: { k: null, q: null } },
    };
    const chess = new Chess(withCastlingField(fen, '-'));
    const d = new MoveDetector(chess, { moveConfirmMs: 0, castling: state });
    const target = withChanges(occupancyFromChess(chess), { e1: null, g1: 'K' });
    const event = d.onFrame(target, 0);
    expect(event.type).toBe('move');
    if (event.type === 'move') {
      expect(event.move.san).toBe('O-O');
      expect(event.move).toMatchObject({ from: 'e1', to: 'g1', rookFrom: 'f1', rookTo: 'f1' });
    }
  });

  it('loses castling after a king move', () => {
    const d = detector960();
    const kingMove = withChanges(startOcc(), { b1: null, b2: 'K' });
    expect(d.onFrame(kingMove, 0).type).toBe('move');
    expect(d.availableCastles()).toEqual([]);
  });

  it('confirms a castle only after moveConfirmMs, like any other move', () => {
    const d = detector960(400);
    const target = withChanges(startOcc(), { b1: null, c1: null, g1: 'K', f1: 'R' });
    expect(d.onFrame(target, 0).type).toBe('pending');
    expect(d.onFrame(target, 200).type).toBe('pending');
    const event = d.onFrame(target, 400);
    expect(event.type).toBe('move');
    if (event.type === 'move') expect(event.move.san).toBe('O-O');
  });

  it('undoes a castle (and restores castling rights) despite the chess.js history reset', () => {
    const d = detector960();
    const before = d.chess.fen();
    const target = withChanges(startOcc(), { b1: null, c1: null, g1: 'K', f1: 'R' });
    expect(d.onFrame(target, 0).type).toBe('move');
    const undone = d.undo();
    expect(undone?.san).toBe('O-O');
    expect(d.chess.fen()).toBe(before);
    expect(d.expectedOccupancy).toEqual(startOcc());
    expect(d.availableCastles().map((c) => c.side)).toEqual(['k']);
    // and it can be replayed
    expect(d.onFrame(target, 100).type).toBe('move');
  });

  it('undoes a normal 960 move and restores rights cleared by it', () => {
    const d = detector960();
    const kingMove = withChanges(startOcc(), { b1: null, b2: 'K' });
    expect(d.onFrame(kingMove, 0).type).toBe('move');
    expect(d.availableCastles()).toEqual([]);
    expect(d.undo()?.san).toBe('Kb2');
    expect(d.availableCastles().map((c) => c.side)).toEqual(['k']);
  });
});

describe('MoveDetector.undo', () => {
  it('takes back the last committed move and resyncs the expected occupancy', () => {
    const d = instantDetector();
    expect(d.onFrame(occAfter('e4'), 0).type).toBe('move');
    const undone = d.undo();
    expect(undone?.san).toBe('e4');
    expect(d.chess.history()).toEqual([]);
    expect(d.expectedOccupancy).toEqual(startingOccupancy());
    expect(d.onFrame(startingOccupancy(), 100)).toEqual({ type: 'match' });
  });

  it('re-detects the same move after an undo (detector fully resynced)', () => {
    const d = instantDetector();
    d.onFrame(occAfter('e4'), 0);
    d.undo();
    const event = d.onFrame(occAfter('e4'), 100);
    expect(event.type).toBe('move');
    if (event.type === 'move') expect(event.move.san).toBe('e4');
    expect(d.chess.history()).toEqual(['e4']);
  });

  it('returns null with no history and leaves the expected occupancy unchanged', () => {
    const d = instantDetector();
    expect(d.undo()).toBeNull();
    expect(d.expectedOccupancy).toEqual(startingOccupancy());
  });

  it('clears a pending move so it cannot commit against the pre-undo position', () => {
    const d = new MoveDetector(new Chess(), { moveConfirmMs: 400 });
    // Commit e4, then leave d5 pending when undo() is called.
    d.onFrame(occAfter('e4'), 0);
    expect(d.onFrame(occAfter('e4'), 400).type).toBe('move');
    expect(d.onFrame(occAfter('e4', 'd5'), 500).type).toBe('pending');
    expect(d.undo()?.san).toBe('e4');
    // The stale frame is now two moves ahead of the expected position: it must
    // be re-evaluated from scratch, never committed as the old pending d5.
    expect(d.onFrame(occAfter('e4', 'd5'), 1000).type).toBe('transient');
    expect(d.chess.history()).toEqual([]);
  });
});
