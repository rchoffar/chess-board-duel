import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

/** Single shared connection; runs schema setup + migrations once per launch. */
export function getDb(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync('chessnut-local.db');
    migrate(db);
  }
  return db;
}

function migrate(database: SQLite.SQLiteDatabase): void {
  database.execSync(`
    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      startedAt INTEGER NOT NULL,
      endedAt INTEGER,
      white TEXT NOT NULL,
      black TEXT NOT NULL,
      baseMinutes INTEGER NOT NULL,
      incrementSeconds INTEGER NOT NULL,
      blackBaseMinutes INTEGER,
      blackIncrementSeconds INTEGER,
      variant TEXT NOT NULL DEFAULT 'standard',
      startFen TEXT,
      result TEXT NOT NULL DEFAULT '*',
      termination TEXT,
      moveCount INTEGER NOT NULL DEFAULT 0,
      pgn TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL COLLATE NOCASE UNIQUE,
      createdAt INTEGER NOT NULL
    );
  `);

  // v2: games reference player profiles. Backfill profiles from the free-text
  // names recorded before profiles existed.
  const gameCols = database.getAllSync<{ name: string }>(`PRAGMA table_info(games)`);
  if (!gameCols.some((c) => c.name === 'whiteId')) {
    database.withTransactionSync(() => {
      database.execSync(`
        ALTER TABLE games ADD COLUMN whiteId INTEGER REFERENCES players(id);
        ALTER TABLE games ADD COLUMN blackId INTEGER REFERENCES players(id);
      `);
      database.runSync(
        `INSERT OR IGNORE INTO players (name, createdAt)
         SELECT name, ? FROM (SELECT white AS name FROM games UNION SELECT black FROM games)
         WHERE TRIM(name) <> ''`,
        [Date.now()]
      );
      database.execSync(`
        UPDATE games SET whiteId = (SELECT id FROM players WHERE players.name = games.white) WHERE whiteId IS NULL;
        UPDATE games SET blackId = (SELECT id FROM players WHERE players.name = games.black) WHERE blackId IS NULL;
      `);
    });
  }

  // v3: per-player time controls (NULL black columns = same control as white)
  // and game variants (Chess960 stores its start FEN). Purely additive.
  if (!gameCols.some((c) => c.name === 'variant')) {
    database.execSync(`
      ALTER TABLE games ADD COLUMN blackBaseMinutes INTEGER;
      ALTER TABLE games ADD COLUMN blackIncrementSeconds INTEGER;
      ALTER TABLE games ADD COLUMN variant TEXT NOT NULL DEFAULT 'standard';
      ALTER TABLE games ADD COLUMN startFen TEXT;
    `);
  }
}
