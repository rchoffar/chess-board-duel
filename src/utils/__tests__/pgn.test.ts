import { Chess } from 'chess.js';
import { buildPgn, parseGamePgn, uciForMove } from '../pgn';
import { chess960Fen } from '../../chess/chess960';
import type { PlayerTimeControls } from '../../chess/clock';

const FIVE_THREE = { baseMinutes: 5, incrementSeconds: 3 };
const META = {
  white: 'Remy',
  black: 'Alice',
  startedAt: new Date('2026-08-04T18:30:00').getTime(),
  timeControls: { w: FIVE_THREE, b: FIVE_THREE } as PlayerTimeControls,
};

describe('buildPgn', () => {
  it('produces headers chess.com accepts and a result-terminated movetext', () => {
    const pgn = buildPgn(['e4', 'e5', 'Nf3', 'Nc6'], { ...META, result: '*' });

    expect(pgn).toContain('[Event "Local over-the-board game"]');
    expect(pgn).toContain('[Date "2026.08.04"]');
    expect(pgn).toContain('[White "Remy"]');
    expect(pgn).toContain('[Black "Alice"]');
    expect(pgn).toContain('[Result "*"]');
    expect(pgn).toContain('[TimeControl "300+3"]');
    expect(pgn).toContain('1. e4 e5 2. Nf3 Nc6');
    expect(pgn.trim().endsWith('*')).toBe(true);
    // symmetric control → no per-side tags
    expect(pgn).not.toContain('WhiteTimeControl');
    expect(pgn).not.toContain('BlackTimeControl');
  });

  it('includes result and termination for a finished game', () => {
    const pgn = buildPgn(['f3', 'e5', 'g4', 'Qh4#'], {
      ...META,
      result: '0-1',
      termination: 'Checkmate',
    });

    expect(pgn).toContain('[Result "0-1"]');
    expect(pgn).toContain('[Termination "Checkmate"]');
    expect(pgn).toContain('Qh4#');
    expect(pgn.trim().endsWith('0-1')).toBe(true);
  });

  it('round-trips through chess.js loadPgn (importability check)', () => {
    const pgn = buildPgn(['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6'], {
      ...META,
      result: '1/2-1/2',
      termination: 'Draw by agreement',
    });

    const reloaded = new Chess();
    expect(() => reloaded.loadPgn(pgn)).not.toThrow();
    expect(reloaded.history()).toEqual(['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6']);
    expect(reloaded.getHeaders().Result).toBe('1/2-1/2');
  });

  it('handles a game with no moves', () => {
    const pgn = buildPgn([], { ...META, result: '*' });
    expect(pgn.trim().endsWith('*')).toBe(true);
  });

  it('emits per-side tags when the time controls differ', () => {
    const pgn = buildPgn(['e4'], {
      ...META,
      timeControls: {
        w: { baseMinutes: 10, incrementSeconds: 5 },
        b: { baseMinutes: 5, incrementSeconds: 0 },
      },
      result: '*',
    });
    expect(pgn).toContain('[TimeControl "600+5"]');
    expect(pgn).toContain('[WhiteTimeControl "600+5"]');
    expect(pgn).toContain('[BlackTimeControl "300+0"]');
    // custom tags are still legal PGN
    expect(() => new Chess().loadPgn(pgn)).not.toThrow();
  });

  it('emits Variant/SetUp/FEN headers for Chess960', () => {
    const startFen = chess960Fen(100);
    const pgn = buildPgn([], { ...META, result: '*', variant: 'chess960', startFen });
    expect(pgn).toContain('[Variant "Chess960"]');
    expect(pgn).toContain('[SetUp "1"]');
    expect(pgn).toContain(`[FEN "${startFen}"]`);
  });
});

describe('parseGamePgn', () => {
  it('replays a standard game via chess.js', () => {
    const pgn = buildPgn(['e4', 'e5', 'Nf3'], { ...META, result: '*' });
    const game = parseGamePgn(pgn);
    expect(game.variant).toBe('standard');
    expect(game.moves.map((m) => m.san)).toEqual(['e4', 'e5', 'Nf3']);
    expect(game.moves[0].before).toBe(new Chess().fen());
    expect(game.moves[2].afterEngine).toBe(game.moves[2].after);
  });

  it('replays a Chess960 game with both castles', () => {
    // BBQNNRKR (SP 96): king g1/g8, rooks f+h. Kingside castle = king stays
    // on g, rook h→f... but f is occupied by the queenside rook, so free it.
    const startFen = 'bbqnnrkr/pppppppp/8/8/8/8/PPPPPPPP/BBQNNRKR w KQkq - 0 1';
    const sans = ['d4', 'd5', 'Nd3', 'Nd6', 'Ne3', 'Ne6', 'Rf1e1', 'Rf8e8', 'O-O', 'O-O'];
    // Build the expected line first to make sure the fixture is self-consistent.
    const game = parseGamePgn(
      buildPgn(sans, { ...META, result: '*', variant: 'chess960', startFen }),
      { variant: 'chess960', startFen }
    );
    expect(game.moves.map((m) => m.san).slice(-2)).toEqual(['O-O', 'O-O']);
    const whiteCastle = game.moves[8];
    expect(whiteCastle).toMatchObject({ from: 'g1', to: 'g1', rookFrom: 'h1', rookTo: 'f1' });
    // engine FENs carry the Shredder castling rights until they're spent
    expect(game.startEngineFen.split(' ')[2]).toBe('HFhf');
    expect(game.moves[8].beforeEngine.split(' ')[2]).toBe('Hh');
    expect(game.moves[9].afterEngine.split(' ')[2]).toBe('-');
    // chess.js-safe FENs always run with castling '-'
    expect(game.moves[8].after.split(' ')[2]).toBe('-');
    // final position: both kings castled
    const final = new Chess(game.moves[9].after);
    expect(final.get('g1' as any)?.type).toBe('k');
    expect(final.get('f1' as any)?.type).toBe('r');
    expect(final.get('g8' as any)?.type).toBe('k');
    expect(final.get('f8' as any)?.type).toBe('r');
  });

  it('detects the variant from PGN headers when no opts are given', () => {
    const startFen = chess960Fen(534);
    const pgn = buildPgn([], { ...META, result: '*', variant: 'chess960', startFen });
    const game = parseGamePgn(pgn);
    expect(game.variant).toBe('chess960');
    expect(game.startFen.split(' ')[2]).toBe('-');
    expect(game.moves).toEqual([]);
  });

  it('handles a zero-move standard game', () => {
    const pgn = buildPgn([], { ...META, result: '*' });
    const game = parseGamePgn(pgn);
    expect(game.moves).toEqual([]);
    expect(game.startFen).toBe(new Chess().fen());
  });
});

describe('uciForMove', () => {
  it('emits from+to+promotion for normal moves', () => {
    expect(uciForMove({ from: 'e2', to: 'e4' })).toBe('e2e4');
    expect(uciForMove({ from: 'e7', to: 'e8', promotion: 'q' })).toBe('e7e8q');
  });

  it('emits king-takes-rook for Chess960 castles', () => {
    expect(uciForMove({ from: 'g1', to: 'g1', rookFrom: 'h1' })).toBe('g1h1');
    expect(uciForMove({ from: 'e8', to: 'c8', rookFrom: 'a8' })).toBe('e8a8');
  });
});
