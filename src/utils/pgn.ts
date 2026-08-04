import { Chess } from 'chess.js';
import { timeControlTag, type TimeControl } from '../chess/clock';

export interface PgnMeta {
  white: string;
  black: string;
  startedAt: number;
  timeControl: TimeControl;
  result: string; // '1-0' | '0-1' | '1/2-1/2' | '*'
  termination?: string;
}

/** PGN date tag: YYYY.MM.DD */
function pgnDate(timestamp: number): string {
  const d = new Date(timestamp);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}.${mm}.${dd}`;
}

/**
 * Full PGN for a game — headers chess.com's importer understands, then the
 * movetext from chess.js.
 */
export function buildPgn(chess: Chess, meta: PgnMeta): string {
  const headers: [string, string][] = [
    ['Event', 'Local over-the-board game'],
    ['Site', 'Chessnut Local'],
    ['Date', pgnDate(meta.startedAt)],
    ['Round', '-'],
    ['White', meta.white || 'White'],
    ['Black', meta.black || 'Black'],
    ['Result', meta.result],
    ['TimeControl', timeControlTag(meta.timeControl)],
  ];
  if (meta.termination) headers.push(['Termination', meta.termination]);

  const headerText = headers.map(([k, v]) => `[${k} "${v}"]`).join('\n');

  // chess.js pgn() appends its own Result header value ("*") to the movetext;
  // strip headers and that marker, then terminate with the real result.
  let movetext = chess
    .pgn()
    .replace(/\[[^\]]*\]\n?/g, '')
    .trim()
    .replace(/(1-0|0-1|1\/2-1\/2|\*)$/, '')
    .trim();
  movetext = movetext ? `${movetext} ${meta.result}` : meta.result;

  return `${headerText}\n\n${movetext}\n`;
}
