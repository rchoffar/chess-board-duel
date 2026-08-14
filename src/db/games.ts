import { isSymmetric, type PlayerTimeControls } from '../chess/clock';
import type { Variant } from '../chess/chess960';
import { getDb } from './db';

export interface GameRecord {
  id: number;
  startedAt: number;
  endedAt: number | null;
  white: string;
  black: string;
  whiteId: number | null;
  blackId: number | null;
  /** White's control. */
  baseMinutes: number;
  incrementSeconds: number;
  /** Black's control; NULL = same as White (all legacy rows). */
  blackBaseMinutes: number | null;
  blackIncrementSeconds: number | null;
  variant: Variant;
  /** Chess960 start position (KQkq X-FEN); NULL for standard games. */
  startFen: string | null;
  result: string; // '1-0' | '0-1' | '1/2-1/2' | '*'
  termination: string | null;
  moveCount: number;
  pgn: string;
}

/** Reconstruct both sides' controls from a db row (legacy rows are symmetric). */
export function timeControlsOf(
  g: Pick<
    GameRecord,
    'baseMinutes' | 'incrementSeconds' | 'blackBaseMinutes' | 'blackIncrementSeconds'
  >
): PlayerTimeControls {
  const w = { baseMinutes: g.baseMinutes, incrementSeconds: g.incrementSeconds };
  const b =
    g.blackBaseMinutes != null && g.blackIncrementSeconds != null
      ? { baseMinutes: g.blackBaseMinutes, incrementSeconds: g.blackIncrementSeconds }
      : w;
  return { w, b };
}

/** Insert a new in-progress game row; returns its id. */
export function createGame(params: {
  startedAt: number;
  white: string;
  black: string;
  whiteId: number | null;
  blackId: number | null;
  timeControls: PlayerTimeControls;
  variant: Variant;
  startFen: string | null;
}): number {
  const { timeControls: tcs } = params;
  const result = getDb().runSync(
    `INSERT INTO games (startedAt, white, black, whiteId, blackId,
       baseMinutes, incrementSeconds, blackBaseMinutes, blackIncrementSeconds,
       variant, startFen)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      params.startedAt,
      params.white,
      params.black,
      params.whiteId,
      params.blackId,
      tcs.w.baseMinutes,
      tcs.w.incrementSeconds,
      isSymmetric(tcs) ? null : tcs.b.baseMinutes,
      isSymmetric(tcs) ? null : tcs.b.incrementSeconds,
      params.variant,
      params.startFen,
    ]
  );
  return Number(result.lastInsertRowId);
}

/** Autosave: refresh the PGN and move count of an in-progress game. */
export function updateGameProgress(id: number, pgn: string, moveCount: number): void {
  getDb().runSync(`UPDATE games SET pgn = ?, moveCount = ? WHERE id = ?`, [pgn, moveCount, id]);
}

export function finishGame(
  id: number,
  params: { endedAt: number; result: string; termination: string | null; pgn: string; moveCount: number }
): void {
  getDb().runSync(
    `UPDATE games SET endedAt = ?, result = ?, termination = ?, pgn = ?, moveCount = ? WHERE id = ?`,
    [params.endedAt, params.result, params.termination, params.pgn, params.moveCount, id]
  );
}

export function listGames(): GameRecord[] {
  return getDb().getAllSync<GameRecord>(`SELECT * FROM games ORDER BY startedAt DESC`);
}

/** Finished games involving a player, oldest first (stats work chronologically). */
export function listGamesForPlayer(playerId: number): GameRecord[] {
  return getDb().getAllSync<GameRecord>(
    `SELECT * FROM games WHERE (whiteId = ? OR blackId = ?) ORDER BY startedAt ASC`,
    [playerId, playerId]
  );
}

export function getGame(id: number): GameRecord | null {
  return getDb().getFirstSync<GameRecord>(`SELECT * FROM games WHERE id = ?`, [id]);
}

export function deleteGame(id: number): void {
  getDb().runSync(`DELETE FROM games WHERE id = ?`, [id]);
}
