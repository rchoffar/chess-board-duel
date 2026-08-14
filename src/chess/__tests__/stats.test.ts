import { computePlayerStats, emptyTally, scoreRate, winRate, type StatGame } from '../stats';

const ALICE = 1;
const BOB = 2;
const CARA = 3;

let t = 0;
function game(
  whiteId: number | null,
  blackId: number | null,
  result: string,
  names?: { white?: string; black?: string }
): StatGame {
  const nameOf = (id: number | null) => (id === ALICE ? 'Alice' : id === BOB ? 'Bob' : 'Cara');
  return {
    whiteId,
    blackId,
    white: names?.white ?? nameOf(whiteId),
    black: names?.black ?? nameOf(blackId),
    result,
    startedAt: ++t,
  };
}

describe('winRate / scoreRate', () => {
  it('returns null with no games', () => {
    expect(winRate(emptyTally())).toBeNull();
    expect(scoreRate(emptyTally())).toBeNull();
  });

  it('computes percentages', () => {
    const tally = { games: 4, wins: 2, draws: 1, losses: 1 };
    expect(winRate(tally)).toBe(50);
    expect(scoreRate(tally)).toBe(62.5);
  });
});

describe('computePlayerStats', () => {
  it('splits results per color', () => {
    const games = [
      game(ALICE, BOB, '1-0'), // win as white
      game(ALICE, BOB, '0-1'), // loss as white
      game(BOB, ALICE, '0-1'), // win as black
      game(BOB, ALICE, '1/2-1/2'), // draw as black
    ];
    const stats = computePlayerStats(games, ALICE);

    expect(stats.overall).toEqual({ games: 4, wins: 2, draws: 1, losses: 1 });
    expect(stats.asWhite).toEqual({ games: 2, wins: 1, draws: 0, losses: 1 });
    expect(stats.asBlack).toEqual({ games: 2, wins: 1, draws: 1, losses: 0 });
  });

  it('ignores unfinished, aborted and self games', () => {
    const games = [
      game(ALICE, BOB, '*'),
      game(ALICE, ALICE, '1-0'),
      game(ALICE, BOB, '1-0'),
    ];
    const stats = computePlayerStats(games, ALICE);
    expect(stats.overall).toEqual({ games: 1, wins: 1, draws: 0, losses: 0 });
  });

  it('ignores games the player is not part of', () => {
    const stats = computePlayerStats([game(BOB, CARA, '1-0')], ALICE);
    expect(stats.overall.games).toBe(0);
    expect(stats.opponents).toEqual([]);
  });

  it('builds head-to-head records sorted by games played', () => {
    const games = [
      game(ALICE, BOB, '1-0'),
      game(BOB, ALICE, '1-0'),
      game(ALICE, BOB, '1/2-1/2'),
      game(ALICE, CARA, '1-0'),
    ];
    const stats = computePlayerStats(games, ALICE);

    expect(stats.opponents).toEqual([
      { opponentId: BOB, name: 'Bob', games: 3, wins: 1, draws: 1, losses: 1 },
      { opponentId: CARA, name: 'Cara', games: 1, wins: 1, draws: 0, losses: 0 },
    ]);
  });

  it('reports form as the last outcomes, oldest first', () => {
    const games = [
      game(ALICE, BOB, '1-0'),
      game(ALICE, BOB, '0-1'),
      game(ALICE, BOB, '1/2-1/2'),
    ];
    expect(computePlayerStats(games, ALICE).form).toEqual(['W', 'L', 'D']);
  });

  it('caps form at the last 10 games', () => {
    const games = Array.from({ length: 12 }, (_, i) =>
      game(ALICE, BOB, i === 0 ? '0-1' : '1-0')
    );
    const form = computePlayerStats(games, ALICE).form;
    expect(form).toHaveLength(10);
    expect(form.every((o) => o === 'W')).toBe(true);
  });
});
