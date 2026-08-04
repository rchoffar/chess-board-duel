import { Chess } from 'chess.js';
import { buildPgn } from '../pgn';

const META = {
  white: 'Remy',
  black: 'Alice',
  startedAt: new Date('2026-08-04T18:30:00').getTime(),
  timeControl: { baseMinutes: 5, incrementSeconds: 3 },
};

describe('buildPgn', () => {
  it('produces headers chess.com accepts and a result-terminated movetext', () => {
    const chess = new Chess();
    for (const san of ['e4', 'e5', 'Nf3', 'Nc6']) chess.move(san);
    const pgn = buildPgn(chess, { ...META, result: '*' });

    expect(pgn).toContain('[Event "Local over-the-board game"]');
    expect(pgn).toContain('[Date "2026.08.04"]');
    expect(pgn).toContain('[White "Remy"]');
    expect(pgn).toContain('[Black "Alice"]');
    expect(pgn).toContain('[Result "*"]');
    expect(pgn).toContain('[TimeControl "300+3"]');
    expect(pgn).toContain('1. e4 e5 2. Nf3 Nc6');
    expect(pgn.trim().endsWith('*')).toBe(true);
  });

  it('includes result and termination for a finished game', () => {
    const chess = new Chess();
    for (const san of ['f3', 'e5', 'g4', 'Qh4#']) chess.move(san);
    const pgn = buildPgn(chess, { ...META, result: '0-1', termination: 'Checkmate' });

    expect(pgn).toContain('[Result "0-1"]');
    expect(pgn).toContain('[Termination "Checkmate"]');
    expect(pgn).toContain('Qh4#');
    expect(pgn.trim().endsWith('0-1')).toBe(true);
  });

  it('round-trips through chess.js loadPgn (importability check)', () => {
    const chess = new Chess();
    for (const san of ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6']) chess.move(san);
    const pgn = buildPgn(chess, { ...META, result: '1/2-1/2', termination: 'Draw by agreement' });

    const reloaded = new Chess();
    expect(() => reloaded.loadPgn(pgn)).not.toThrow();
    expect(reloaded.history()).toEqual(['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6']);
    expect(reloaded.getHeaders().Result).toBe('1/2-1/2');
  });

  it('handles a game with no moves', () => {
    const pgn = buildPgn(new Chess(), { ...META, result: '*' });
    expect(pgn.trim().endsWith('*')).toBe(true);
  });
});
