import { judgeMove, judgeGame, judgmentCounts, isSacrifice, JUDGMENT_META } from '../judgment';
import {
  toWhitePerspective,
  scoreToCp,
  formatScore,
  scoreToBarRatio,
  terminalScore,
  uciPvToSan,
  MATE_CP,
} from '../evalUtils';

describe('evalUtils', () => {
  it('normalizes UCI scores to white perspective', () => {
    expect(toWhitePerspective({ cp: 50 }, 'w')).toEqual({ cp: 50 });
    expect(toWhitePerspective({ cp: 50 }, 'b')).toEqual({ cp: -50 });
    expect(toWhitePerspective({ mate: 3 }, 'b')).toEqual({ mate: -3 });
  });

  it('collapses mate scores above any cp score', () => {
    expect(scoreToCp({ cp: 900 })).toBe(900);
    expect(scoreToCp({ mate: 2 })).toBe(MATE_CP - 2);
    expect(scoreToCp({ mate: -5 })).toBe(-(MATE_CP - 5));
    expect(scoreToCp({ mate: 1 })).toBeGreaterThan(scoreToCp({ mate: 8 }));
  });

  it('formats scores', () => {
    expect(formatScore({ cp: 123 })).toBe('+1.2');
    expect(formatScore({ cp: -50 })).toBe('-0.5');
    expect(formatScore({ cp: 0 })).toBe('0.0');
    expect(formatScore({ mate: 5 })).toBe('M5');
    expect(formatScore({ mate: -3 })).toBe('-M3');
  });

  it('maps scores to a 0..1 bar ratio', () => {
    expect(scoreToBarRatio({ cp: 0 })).toBeCloseTo(0.5);
    expect(scoreToBarRatio({ cp: 400 })).toBeGreaterThan(0.7);
    expect(scoreToBarRatio({ cp: -400 })).toBeLessThan(0.3);
    expect(scoreToBarRatio({ mate: 2 })).toBe(0.98);
    expect(scoreToBarRatio({ mate: -2 })).toBe(0.02);
  });

  it('synthesizes terminal scores (engine says bestmove (none) there)', () => {
    expect(terminalScore('rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3')).toEqual({
      cp: -MATE_CP,
    });
    expect(terminalScore('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1')).toEqual({ cp: 0 });
    expect(terminalScore('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')).toBeNull();
  });

  it('converts a UCI pv to SAN', () => {
    const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    expect(uciPvToSan(start, ['e2e4', 'e7e5', 'g1f3'])).toEqual(['e4', 'e5', 'Nf3']);
    expect(uciPvToSan(start, ['e2e4', 'e2e4'])).toEqual(['e4']);
  });
});

describe('isSacrifice', () => {
  // White queen takes a pawn that is defended by another pawn: gives up Q for P.
  const DEFENDED_PAWN = '3k4/8/4p3/3p4/8/8/8/3QK3 w - - 0 1';
  // Same but the pawn is undefended: plain capture, not a sacrifice.
  const FREE_PAWN = '3k4/8/8/3p4/8/8/8/3QK3 w - - 0 1';

  it('detects capturing a defended pawn with the queen as a sacrifice', () => {
    expect(isSacrifice(DEFENDED_PAWN, 'd1d5')).toBe(true);
  });

  it('does not flag winning a free pawn', () => {
    expect(isSacrifice(FREE_PAWN, 'd1d5')).toBe(false);
  });

  it('does not flag a quiet developing move', () => {
    expect(isSacrifice('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'g1f3')).toBe(false);
  });
});

describe('judgeMove', () => {
  it('labels the engine move as best', () => {
    expect(judgeMove({ cp: 50 }, { cp: 40 }, 'w', 'e2e4', 'e2e4')).toBe('best');
  });

  it('upgrades a best-move sacrifice to brilliant', () => {
    const fen = '3k4/8/4p3/3p4/8/8/8/3QK3 w - - 0 1';
    expect(judgeMove({ cp: 100 }, { cp: 120 }, 'w', 'd1d5', 'd1d5', fen)).toBe('brilliant');
  });

  it('denies brilliant when the mover ends up losing anyway', () => {
    const fen = '3k4/8/4p3/3p4/8/8/8/3QK3 w - - 0 1';
    expect(judgeMove({ cp: -300 }, { cp: -400 }, 'w', 'd1d5', 'd1d5', fen)).toBe('best');
  });

  it('classifies loss tiers at their boundaries', () => {
    const j = (loss: number) => judgeMove({ cp: 0 }, { cp: -loss }, 'w', 'a2a3', 'e2e4');
    expect(j(24)).toBe('good');
    expect(j(25)).toBe('ok');
    expect(j(49)).toBe('ok');
    expect(j(50)).toBe('imprecision');
    expect(j(119)).toBe('imprecision');
    expect(j(120)).toBe('mistake');
    expect(j(299)).toBe('mistake');
    expect(j(300)).toBe('blunder');
  });

  it('shows miss instead of mistake/blunder when a winning position slips away', () => {
    expect(judgeMove({ cp: 350 }, { cp: 20 }, 'w', 'a2a3', 'e2e4')).toBe('miss');
    expect(judgeMove({ cp: 250 }, { cp: 80 }, 'w', 'a2a3', 'e2e4')).toBe('miss');
    // not winning enough before → plain blunder
    expect(judgeMove({ cp: 100 }, { cp: -250 }, 'w', 'a2a3', 'e2e4')).toBe('blunder');
    // still winning after → plain mistake territory
    expect(judgeMove({ cp: 500 }, { cp: 300 }, 'w', 'a2a3', 'e2e4')).toBe('mistake');
  });

  it('flips perspective for black', () => {
    expect(judgeMove({ cp: 0 }, { cp: 350 }, 'b', 'a7a6', 'e7e5')).toBe('blunder');
    expect(judgeMove({ cp: -300 }, { cp: -20 }, 'b', 'a7a6', 'e7e5')).toBe('miss');
    expect(judgeMove({ cp: 0 }, { cp: -200 }, 'b', 'a7a6', 'e7e5')).toBe('good');
  });

  it('treats allowing mate as a blunder via mate-to-cp collapse', () => {
    expect(judgeMove({ cp: 0 }, { mate: -3 }, 'w', 'g2g4', 'e2e4')).toBe('blunder');
  });

  it('labels delivering checkmate as best even when it is not the engine move', () => {
    // Before: mate in 1 for the mover; after: terminalScore of the mated position.
    expect(judgeMove({ mate: 1 }, { cp: MATE_CP }, 'w', 'd1h5', 'f3h5')).toBe('best');
    expect(judgeMove({ mate: -1 }, { cp: -MATE_CP }, 'b', 'd8h4', 'g8f6')).toBe('best');
    // A slower-but-still-mating line is a mate all the same.
    expect(judgeMove({ mate: 2 }, { cp: MATE_CP }, 'w', 'd1h5', 'f3h5')).toBe('best');
  });

  it('upgrades a mating sacrifice to brilliant', () => {
    // Same sacrifice fen as above; the scores say the sac delivered mate.
    const fen = '3k4/8/4p3/3p4/8/8/8/3QK3 w - - 0 1';
    expect(judgeMove({ mate: 1 }, { cp: MATE_CP }, 'w', 'd1d5', 'd1a4', fen)).toBe('brilliant');
  });
});

describe('judgeGame / judgmentCounts', () => {
  it('judges a game and counts per player', () => {
    const judgments = judgeGame({
      positionScores: [{ cp: 20 }, { cp: 30 }, { cp: 500 }],
      bestUcis: ['e2e4', 'g8f6'],
      playedUcis: ['e2e4', 'f7f6'],
    });
    expect(judgments).toEqual(['best', 'blunder']);

    const counts = judgmentCounts(judgments);
    expect(counts.best).toEqual({ white: 1, black: 0 });
    expect(counts.blunder).toEqual({ white: 0, black: 1 });
    expect(counts.good).toEqual({ white: 0, black: 0 });
  });

  it('every judgment has display metadata', () => {
    const judgments = ['brilliant', 'best', 'good', 'ok', 'imprecision', 'mistake', 'miss', 'blunder'] as const;
    for (const j of judgments) {
      expect(JUDGMENT_META[j].glyph.length).toBeGreaterThan(0);
      expect(JUDGMENT_META[j].color).toMatch(/^#/);
      expect(JUDGMENT_META[j].label.length).toBeGreaterThan(0);
    }
  });
});
