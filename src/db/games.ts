import * as SQLite from 'expo-sqlite';
import type { TimeControl } from '../chess/clock';

export interface GameRecord {
  id: number;
  startedAt: number;
  endedAt: number | null;
  white: string;
  black: string;
  baseMinutes: number;
  incrementSeconds: number;
  result: string; // '1-0' | '0-1' | '1/2-1/2' | '*'
  termination: string | null;
  moveCount: number;
  pgn: string;
}

let db: SQLite.SQLiteDatabase | null = null;

function getDb(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync('chessnut-local.db');
    db.execSync(`
      CREATE TABLE IF NOT EXISTS games (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        startedAt INTEGER NOT NULL,
        endedAt INTEGER,
        white TEXT NOT NULL,
        black TEXT NOT NULL,
        baseMinutes INTEGER NOT NULL,
        incrementSeconds INTEGER NOT NULL,
        result TEXT NOT NULL DEFAULT '*',
        termination TEXT,
        moveCount INTEGER NOT NULL DEFAULT 0,
        pgn TEXT NOT NULL DEFAULT ''
      );
    `);
  }
  return db;
}

/** Insert a new in-progress game row; returns its id. */
export function createGame(params: {
  startedAt: number;
  white: string;
  black: string;
  timeControl: TimeControl;
}): number {
  const result = getDb().runSync(
    `INSERT INTO games (startedAt, white, black, baseMinutes, incrementSeconds) VALUES (?, ?, ?, ?, ?)`,
    [params.startedAt, params.white, params.black, params.timeControl.baseMinutes, params.timeControl.incrementSeconds]
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

export function getGame(id: number): GameRecord | null {
  return getDb().getFirstSync<GameRecord>(`SELECT * FROM games WHERE id = ?`, [id]);
}

export function deleteGame(id: number): void {
  getDb().runSync(`DELETE FROM games WHERE id = ?`, [id]);
}
