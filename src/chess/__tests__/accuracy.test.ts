import { winPctFromScore, moveAccuracies, gameAccuracy } from '../accuracy';

describe('winPctFromScore', () => {
  it('is 50% for an equal position and symmetric around it', () => {
    expect(winPctFromScore({ cp: 0 })).toBeCloseTo(50);
    expect(winPctFromScore({ cp: 200 }) + winPctFromScore({ cp: -200 })).toBeCloseTo(100);
  });

  it('approaches the extremes for mate scores', () => {
    expect(winPctFromScore({ mate: 2 })).toBeGreaterThan(99.9);
    expect(winPctFromScore({ mate: -2 })).toBeLessThan(0.1);
  });

  it('grows with advantage', () => {
    expect(winPctFromScore({ cp: 300 })).toBeGreaterThan(winPctFromScore({ cp: 100 }));
  });
});

describe('moveAccuracies', () => {
  it('scores a move that keeps the eval as ~perfect', () => {
    const [acc] = moveAccuracies([{ cp: 20 }, { cp: 20 }]);
    expect(acc).toBeGreaterThan(99);
  });

  it('treats improving moves as (near-)perfect — the formula intercept is 99.9999', () => {
    const [acc] = moveAccuracies([{ cp: 0 }, { cp: 300 }]);
    expect(acc).toBeCloseTo(100, 3);
  });

  it('punishes a blunder heavily', () => {
    const [acc] = moveAccuracies([{ cp: 0 }, { cp: -600 }]);
    expect(acc).toBeLessThan(45);
  });

  it('judges black moves from black perspective', () => {
    // Score jumps in white's favour after black's move → bad for black.
    const accuracies = moveAccuracies([{ cp: 0 }, { cp: 0 }, { cp: 500 }]);
    expect(accuracies[1]).toBeLessThan(55);
    // Score drops after black's move → great for black.
    const accuracies2 = moveAccuracies([{ cp: 0 }, { cp: 0 }, { cp: -300 }]);
    expect(accuracies2[1]).toBeCloseTo(100, 3);
  });

  it('returns one accuracy per move', () => {
    expect(moveAccuracies([{ cp: 0 }])).toHaveLength(0);
    expect(moveAccuracies([{ cp: 0 }, { cp: 0 }, { cp: 0 }, { cp: 0 }])).toHaveLength(3);
  });
});

describe('gameAccuracy', () => {
  it('splits per player', () => {
    // White plays perfectly, black blunders every move.
    const scores = [{ cp: 0 }, { cp: 0 }, { cp: 400 }, { cp: 400 }, { cp: 800 }];
    const { white, black } = gameAccuracy(scores);
    expect(white).toBeGreaterThan(99);
    expect(black).toBeLessThan(50);
  });

  it('handles an empty game', () => {
    expect(gameAccuracy([{ cp: 0 }])).toEqual({ white: 100, black: 100 });
  });

  it('stays within 0..100', () => {
    const scores = [{ cp: 0 }, { mate: -1 }, { cp: 0 }, { mate: 1 }];
    const { white, black } = gameAccuracy(scores);
    expect(white).toBeGreaterThanOrEqual(0);
    expect(white).toBeLessThanOrEqual(100);
    expect(black).toBeGreaterThanOrEqual(0);
    expect(black).toBeLessThanOrEqual(100);
  });
});
