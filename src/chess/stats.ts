/**
 * Pure player statistics over recorded games. No sqlite imports — callers pass
 * game rows (see `listGamesForPlayer`) so everything here is unit-testable.
 */

/** The subset of a game row the stats need. */
export interface StatGame {
  whiteId: number | null;
  blackId: number | null;
  white: string;
  black: string;
  result: string; // '1-0' | '0-1' | '1/2-1/2' | '*'
  startedAt: number;
}

export type Outcome = 'W' | 'D' | 'L';

export interface Tally {
  games: number;
  wins: number;
  draws: number;
  losses: number;
}

export interface OpponentRecord extends Tally {
  opponentId: number;
  name: string;
}

export interface PlayerStats {
  overall: Tally;
  asWhite: Tally;
  asBlack: Tally;
  /** Head-to-head records, most played first. */
  opponents: OpponentRecord[];
  /** Outcomes of the last `formSize` finished games, oldest → newest. */
  form: Outcome[];
}

const FORM_SIZE = 10;

export function emptyTally(): Tally {
  return { games: 0, wins: 0, draws: 0, losses: 0 };
}

/** Win percentage 0-100, or null when no games were played. */
export function winRate(t: Tally): number | null {
  return t.games === 0 ? null : (t.wins / t.games) * 100;
}

/** Chess score percentage (draw = half a point), or null when no games. */
export function scoreRate(t: Tally): number | null {
  return t.games === 0 ? null : ((t.wins + t.draws / 2) / t.games) * 100;
}

function outcomeFor(game: StatGame, playerIsWhite: boolean): Outcome | null {
  if (game.result === '1/2-1/2') return 'D';
  if (game.result === '1-0') return playerIsWhite ? 'W' : 'L';
  if (game.result === '0-1') return playerIsWhite ? 'L' : 'W';
  return null; // unfinished / aborted
}

function addOutcome(t: Tally, outcome: Outcome): void {
  t.games += 1;
  if (outcome === 'W') t.wins += 1;
  else if (outcome === 'D') t.draws += 1;
  else t.losses += 1;
}

/**
 * Aggregate a player's record from their games. Unfinished/aborted games and
 * games where the player faced themself are ignored.
 */
export function computePlayerStats(games: StatGame[], playerId: number): PlayerStats {
  const overall = emptyTally();
  const asWhite = emptyTally();
  const asBlack = emptyTally();
  const opponents = new Map<number, OpponentRecord>();
  const outcomes: { outcome: Outcome; startedAt: number }[] = [];

  for (const game of games) {
    const isWhite = game.whiteId === playerId;
    const isBlack = game.blackId === playerId;
    if (isWhite === isBlack) continue; // not the player's game, or played themself
    const outcome = outcomeFor(game, isWhite);
    if (!outcome) continue;

    addOutcome(overall, outcome);
    addOutcome(isWhite ? asWhite : asBlack, outcome);
    outcomes.push({ outcome, startedAt: game.startedAt });

    const opponentId = isWhite ? game.blackId : game.whiteId;
    const opponentName = isWhite ? game.black : game.white;
    if (opponentId != null) {
      let record = opponents.get(opponentId);
      if (!record) {
        record = { opponentId, name: opponentName, ...emptyTally() };
        opponents.set(opponentId, record);
      }
      record.name = opponentName; // latest name wins after renames
      addOutcome(record, outcome);
    }
  }

  outcomes.sort((a, b) => a.startedAt - b.startedAt);

  return {
    overall,
    asWhite,
    asBlack,
    opponents: [...opponents.values()].sort(
      (a, b) => b.games - a.games || a.name.localeCompare(b.name)
    ),
    form: outcomes.slice(-FORM_SIZE).map((o) => o.outcome),
  };
}
