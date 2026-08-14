import { Chess } from 'chess.js';
import { animationForStep } from '../moveAnimation';

function makeMove(fen: string | undefined, san: string) {
  const chess = fen ? new Chess(fen) : new Chess();
  return chess.move(san);
}

describe('animationForStep', () => {
  it('slides a single piece forward', () => {
    const move = makeMove(undefined, 'e4');
    expect(animationForStep(move, 1)).toEqual([{ from: 'e2', to: 'e4', piece: 'P' }]);
  });

  it('reverses the slide when stepping backward', () => {
    const move = makeMove(undefined, 'Nf3');
    expect(animationForStep(move, -1)).toEqual([{ from: 'f3', to: 'g1', piece: 'N' }]);
  });

  it('uses lowercase letters for black pieces', () => {
    const chess = new Chess();
    chess.move('e4');
    const move = chess.move('Nf6');
    expect(animationForStep(move, 1)).toEqual([{ from: 'g8', to: 'f6', piece: 'n' }]);
  });

  it('slides only the capturing piece on a capture', () => {
    const chess = new Chess();
    chess.move('e4');
    chess.move('d5');
    const move = chess.move('exd5');
    expect(animationForStep(move, 1)).toEqual([{ from: 'e4', to: 'd5', piece: 'P' }]);
  });

  it('adds the rook segment for white kingside castling', () => {
    const move = makeMove('r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1', 'O-O');
    expect(animationForStep(move, 1)).toEqual([
      { from: 'e1', to: 'g1', piece: 'K' },
      { from: 'h1', to: 'f1', piece: 'R' },
    ]);
  });

  it('adds the rook segment for black queenside castling, reversed backward', () => {
    const move = makeMove('r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R b KQkq - 0 1', 'O-O-O');
    expect(animationForStep(move, -1)).toEqual([
      { from: 'c8', to: 'e8', piece: 'k' },
      { from: 'd8', to: 'a8', piece: 'r' },
    ]);
  });

  it('slides the pawn letter on promotion in both directions', () => {
    const move = makeMove('8/4P3/8/8/8/8/2k5/K7 w - - 0 1', 'e8=Q');
    expect(animationForStep(move, 1)).toEqual([{ from: 'e7', to: 'e8', piece: 'P' }]);
    expect(animationForStep(move, -1)).toEqual([{ from: 'e8', to: 'e7', piece: 'P' }]);
  });

  it('slides a single segment on en passant', () => {
    const chess = new Chess('4k3/8/8/8/4p3/8/3P4/4K3 w - - 0 1');
    chess.move('d4');
    const move = chess.move('exd3');
    expect(animationForStep(move, 1)).toEqual([{ from: 'e4', to: 'd3', piece: 'p' }]);
  });

  it('uses the Chess960 rook squares when the move carries them', () => {
    const move = {
      san: 'O-O',
      color: 'w' as const,
      from: 'b1',
      to: 'g1',
      piece: 'k',
      flags: 'k',
      before: '',
      after: '',
      rookFrom: 'c1',
      rookTo: 'f1',
    };
    expect(animationForStep(move, 1)).toEqual([
      { from: 'b1', to: 'g1', piece: 'K' },
      { from: 'c1', to: 'f1', piece: 'R' },
    ]);
  });

  it('skips zero-length segments (king-stays and rook-stays castles)', () => {
    const kingStays = {
      san: 'O-O',
      color: 'w' as const,
      from: 'g1',
      to: 'g1',
      piece: 'k',
      flags: 'k',
      before: '',
      after: '',
      rookFrom: 'h1',
      rookTo: 'f1',
    };
    expect(animationForStep(kingStays, 1)).toEqual([{ from: 'h1', to: 'f1', piece: 'R' }]);

    const rookStays = { ...kingStays, from: 'e1', to: 'g1', rookFrom: 'f1', rookTo: 'f1' };
    expect(animationForStep(rookStays, 1)).toEqual([{ from: 'e1', to: 'g1', piece: 'K' }]);
  });
});
