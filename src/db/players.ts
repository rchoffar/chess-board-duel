import { getDb } from './db';

export interface Player {
  id: number;
  name: string;
  createdAt: number;
}

/** A player row plus the aggregate counters shown in list rows. */
export interface PlayerWithRecord extends Player {
  games: number;
  wins: number;
  draws: number;
  losses: number;
}

/**
 * Create a profile, or return the existing one with the same name
 * (case-insensitive) — quick-create from the new-game screen is idempotent.
 */
export function createPlayer(rawName: string): Player | null {
  const name = rawName.trim();
  if (!name) return null;
  const existing = getDb().getFirstSync<Player>(`SELECT * FROM players WHERE name = ?`, [name]);
  if (existing) return existing;
  const res = getDb().runSync(`INSERT INTO players (name, createdAt) VALUES (?, ?)`, [name, Date.now()]);
  return { id: Number(res.lastInsertRowId), name, createdAt: Date.now() };
}

export function getPlayer(id: number): Player | null {
  return getDb().getFirstSync<Player>(`SELECT * FROM players WHERE id = ?`, [id]);
}

export function renamePlayer(id: number, rawName: string): boolean {
  const name = rawName.trim();
  if (!name) return false;
  const clash = getDb().getFirstSync<Player>(`SELECT * FROM players WHERE name = ? AND id <> ?`, [name, id]);
  if (clash) return false;
  getDb().withTransactionSync(() => {
    getDb().runSync(`UPDATE players SET name = ? WHERE id = ?`, [name, id]);
    // Keep the denormalized name columns (used in PGN headers / history rows) in sync.
    getDb().runSync(`UPDATE games SET white = ? WHERE whiteId = ?`, [name, id]);
    getDb().runSync(`UPDATE games SET black = ? WHERE blackId = ?`, [name, id]);
  });
  return true;
}

/** Delete a profile only when it has no recorded games. */
export function deletePlayer(id: number): boolean {
  const used = getDb().getFirstSync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM games WHERE whiteId = ? OR blackId = ?`,
    [id, id]
  );
  if (used && used.n > 0) return false;
  getDb().runSync(`DELETE FROM players WHERE id = ?`, [id]);
  return true;
}

/** All profiles with their game count and finished-game record, most active first. */
export function listPlayersWithRecord(): PlayerWithRecord[] {
  return getDb().getAllSync<PlayerWithRecord>(`
    SELECT
      p.*,
      COUNT(g.id) AS games,
      COALESCE(SUM(CASE WHEN (g.whiteId = p.id AND g.result = '1-0') OR (g.blackId = p.id AND g.result = '0-1') THEN 1 ELSE 0 END), 0) AS wins,
      COALESCE(SUM(CASE WHEN g.result = '1/2-1/2' THEN 1 ELSE 0 END), 0) AS draws,
      COALESCE(SUM(CASE WHEN (g.whiteId = p.id AND g.result = '0-1') OR (g.blackId = p.id AND g.result = '1-0') THEN 1 ELSE 0 END), 0) AS losses
    FROM players p
    LEFT JOIN games g
      ON (g.whiteId = p.id OR g.blackId = p.id)
      AND g.whiteId <> g.blackId
    GROUP BY p.id
    ORDER BY games DESC, p.name COLLATE NOCASE ASC
  `);
}

/** Profiles ordered for pickers: most recently used first, then alphabetical. */
export function listPlayers(): Player[] {
  return getDb().getAllSync<Player>(`
    SELECT p.* FROM players p
    LEFT JOIN games g ON g.whiteId = p.id OR g.blackId = p.id
    GROUP BY p.id
    ORDER BY MAX(g.startedAt) DESC, p.name COLLATE NOCASE ASC
  `);
}
