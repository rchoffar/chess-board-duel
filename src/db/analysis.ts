import * as SQLite from 'expo-sqlite';
import { getDb as getSharedDb } from './db';

/** One analysed position: ply 0 = starting position, ply i = after i moves. */
export interface AnalysisRow {
  gameId: number;
  ply: number;
  depth: number;
  cp: number | null;
  mate: number | null;
  bestUci: string | null;
  pv: string; // UCI moves, space-separated
}

let db: SQLite.SQLiteDatabase | null = null;

function getDb(): SQLite.SQLiteDatabase {
  if (!db) {
    db = getSharedDb();
    db.execSync(`
      CREATE TABLE IF NOT EXISTS analysis (
        gameId INTEGER NOT NULL,
        ply INTEGER NOT NULL,
        depth INTEGER NOT NULL,
        cp INTEGER,
        mate INTEGER,
        bestUci TEXT,
        pv TEXT NOT NULL DEFAULT '',
        PRIMARY KEY (gameId, ply)
      );
    `);
  }
  return db;
}

export function saveAnalysis(gameId: number, rows: Omit<AnalysisRow, 'gameId'>[]): void {
  const database = getDb();
  database.withTransactionSync(() => {
    database.runSync(`DELETE FROM analysis WHERE gameId = ?`, [gameId]);
    for (const row of rows) {
      database.runSync(
        `INSERT INTO analysis (gameId, ply, depth, cp, mate, bestUci, pv) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [gameId, row.ply, row.depth, row.cp, row.mate, row.bestUci, row.pv]
      );
    }
  });
}

export function getAnalysis(gameId: number): AnalysisRow[] {
  return getDb().getAllSync<AnalysisRow>(
    `SELECT * FROM analysis WHERE gameId = ? ORDER BY ply ASC`,
    [gameId]
  );
}

export function deleteAnalysis(gameId: number): void {
  getDb().runSync(`DELETE FROM analysis WHERE gameId = ?`, [gameId]);
}
