import { Chess } from 'chess.js';
import { MoveDetector, occupancyFromChess } from '../MoveDetector';
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

describe('occupancyFromChess', () => {
  it('matches the protocol starting occupancy', () => {
    expect(occupancyFromChess(new Chess())).toEqual(startingOccupancy());
  });
});

describe('MoveDetector', () => {
  it('reports match for the expected position', () => {
    const d = new MoveDetector();
    expect(d.onFrame(startingOccupancy(), 0)).toEqual({ type: 'match' });
  });

  it('detects a simple pawn move', () => {
    const d = new MoveDetector();
    const event = d.onFrame(occAfter('e4'), 0);
    expect(event.type).toBe('move');
    if (event.type === 'move') expect(event.move.san).toBe('e4');
    expect(d.chess.fen()).toContain(' b '); // black to move
  });

  it('treats a lifted piece as transient, then detects the completed move', () => {
    const d = new MoveDetector();
    const lifted = withChanges(startingOccupancy(), { e2: null });
    expect(d.onFrame(lifted, 0).type).toBe('transient');
    const event = d.onFrame(occAfter('e4'), 100);
    expect(event.type).toBe('move');
  });

  it('detects a capture, including the intermediate captured-piece-removed state', () => {
    const d = new MoveDetector(new Chess());
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
    const d = new MoveDetector(chess);
    const target = occAfter('e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'O-O');
    const event = d.onFrame(target, 0);
    expect(event.type).toBe('move');
    if (event.type === 'move') expect(event.move.san).toBe('O-O');
  });

  it('detects en passant (captured pawn is on a different square)', () => {
    const chess = new Chess();
    for (const san of ['e4', 'a6', 'e5', 'd5']) chess.move(san);
    const d = new MoveDetector(chess);
    const target = occAfter('e4', 'a6', 'e5', 'd5', 'exd6');
    const event = d.onFrame(target, 0);
    expect(event.type).toBe('move');
    if (event.type === 'move') expect(event.move.san).toBe('exd6');
  });

  it('detects promotion and the chosen piece', () => {
    const chess = new Chess('8/4P1k1/8/8/8/8/8/4K3 w - - 0 1');
    const d = new MoveDetector(chess);
    const after = new Chess('4N3/6k1/8/8/8/8/8/4K3 b - - 0 1');
    const event = d.onFrame(occupancyFromChess(after), 0);
    expect(event.type).toBe('move');
    if (event.type === 'move') {
      expect(event.move.promotion).toBe('n');
      expect(event.move.san).toBe('e8=N+');
    }
  });

  it('flags a stable illegal position after the debounce, with mismatched squares', () => {
    const d = new MoveDetector(new Chess(), { debounceMs: 500 });
    // white plays Ke2?? from the start — illegal (king can't move)
    const wrong = withChanges(startingOccupancy(), { e1: null, e3: 'K' });
    expect(d.onFrame(wrong, 0).type).toBe('transient');
    expect(d.onFrame(wrong, 300).type).toBe('transient');
    const event = d.onFrame(wrong, 600);
    expect(event.type).toBe('illegal');
    if (event.type === 'illegal') expect(event.mismatches.sort()).toEqual(['e1', 'e3']);
  });

  it('recovers when the illegal position is corrected back to expected', () => {
    const d = new MoveDetector(new Chess(), { debounceMs: 500 });
    const wrong = withChanges(startingOccupancy(), { e1: null, e3: 'K' });
    d.onFrame(wrong, 0);
    expect(d.onFrame(wrong, 600).type).toBe('illegal');
    expect(d.onFrame(startingOccupancy(), 700)).toEqual({ type: 'match' });
    // and a legal move afterwards still works
    expect(d.onFrame(occAfter('e4'), 800).type).toBe('move');
  });

  it('recovers when the illegal position is corrected into a legal move', () => {
    const d = new MoveDetector(new Chess(), { debounceMs: 500 });
    const wrong = withChanges(startingOccupancy(), { e2: null, e5: 'P' });
    d.onFrame(wrong, 0);
    expect(d.onFrame(wrong, 600).type).toBe('illegal');
    const event = d.onFrame(occAfter('e4'), 700);
    expect(event.type).toBe('move');
  });

  it('does not flag illegal while the position keeps changing (debounce resets)', () => {
    const d = new MoveDetector(new Chess(), { debounceMs: 500 });
    const a = withChanges(startingOccupancy(), { e2: null });
    const b = withChanges(startingOccupancy(), { e2: null, d2: null });
    expect(d.onFrame(a, 0).type).toBe('transient');
    expect(d.onFrame(b, 400).type).toBe('transient');
    expect(d.onFrame(a, 800).type).toBe('transient'); // new unexplained state, timer restarts
  });

  it('any change after checkmate is illegal (no legal moves)', () => {
    const chess = new Chess();
    for (const san of ['f3', 'e5', 'g4', 'Qh4#']) chess.move(san);
    const d = new MoveDetector(chess, { debounceMs: 500 });
    const wrong = withChanges(occupancyFromChess(chess), { e1: null, e2: 'K' });
    d.onFrame(wrong, 0);
    expect(d.onFrame(wrong, 600).type).toBe('illegal');
  });
});
