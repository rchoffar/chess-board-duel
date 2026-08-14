/**
 * Chessnut Air/Air+/Pro BLE protocol codec — pure functions, no BLE dependency.
 *
 * Protocol cross-verified against:
 * - github.com/chessnutech/EasyLinkSDK (official, same bytes over USB-HID)
 * - github.com/staubsauger/ChessnutPy
 * - github.com/rmarabini/chessnutair
 * - github.com/ecrucru/chessnut-connector
 */

export const CHESSNUT_UUIDS = {
  boardService: '1b7e8261-2877-41c3-b46e-cf057c562023',
  boardNotify: '1b7e8262-2877-41c3-b46e-cf057c562023',
  opsService: '1b7e8271-2877-41c3-b46e-cf057c562023',
  write: '1b7e8272-2877-41c3-b46e-cf057c562023',
  miscNotify: '1b7e8273-2877-41c3-b46e-cf057c562023',
} as const;

export const COMMANDS = {
  enableRealtime: Uint8Array.from([0x21, 0x01, 0x00]),
  queryBattery: Uint8Array.from([0x29, 0x01, 0x00]),
  ledsOff: Uint8Array.from([0x0a, 0x08, 0, 0, 0, 0, 0, 0, 0, 0]),
} as const;

/** Squares indexed 0..63 = a1..h8 (a1=0, b1=1, …, h1=7, a2=8, …, h8=63), matching chess.js Ox88 order when flattened. */
export type SquareIndex = number;

/**
 * Piece codes as sent by the board, one nibble per square.
 * Lowercase = black, uppercase = white, null = empty.
 */
const NIBBLE_TO_PIECE: (string | null)[] = [
  null, // 0 empty
  'q', // 1 black queen
  'k', // 2 black king
  'b', // 3 black bishop
  'p', // 4 black pawn
  'n', // 5 black knight
  'R', // 6 white rook
  'P', // 7 white pawn
  'r', // 8 black rook
  'B', // 9 white bishop
  'N', // 10 white knight
  'Q', // 11 white queen
  'K', // 12 white king
  null,
  null,
  null,
];

/** 64 entries, index 0 = a1 … 63 = h8; value = piece letter (FEN style) or null. */
export type Occupancy = (string | null)[];

export function toHex(data: Uint8Array): string {
  return Array.from(data, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function fromHex(hex: string): Uint8Array {
  const clean = hex.replace(/\s+/g, '');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export const BOARD_FRAME_HEADER = [0x01, 0x24] as const;
export const BOARD_FRAME_LENGTH = 38;

export function isBoardFrame(data: Uint8Array): boolean {
  return data.length >= 34 && data[0] === 0x01 && data[1] === 0x24;
}

/**
 * Parse a 38-byte board-state frame into an occupancy array.
 *
 * The board sends 32 data bytes (offset 2), two squares per byte, starting at
 * h8 and walking h→a along each rank, rank 8 down to rank 1. The LOW nibble of
 * each byte is the first square of the pair.
 */
export function parseBoardFrame(data: Uint8Array): Occupancy {
  if (!isBoardFrame(data)) {
    throw new Error(`Not a board frame: ${toHex(data)}`);
  }
  const occupancy: Occupancy = new Array(64).fill(null);
  for (let i = 0; i < 32; i++) {
    const byte = data[2 + i];
    // Wire order: index 0 = h8 (square 63), 1 = g8 (62), … 63 = a1 (0)
    const firstWireIndex = 2 * i;
    occupancy[63 - firstWireIndex] = NIBBLE_TO_PIECE[byte & 0x0f];
    occupancy[63 - (firstWireIndex + 1)] = NIBBLE_TO_PIECE[byte >> 4];
  }
  return occupancy;
}

/** Algebraic name ("e4") for a 0..63 square index. */
export function squareName(index: SquareIndex): string {
  const file = 'abcdefgh'[index % 8];
  const rank = Math.floor(index / 8) + 1;
  return `${file}${rank}`;
}

/** 0..63 square index for an algebraic name ("e4"). */
export function squareIndex(name: string): SquareIndex {
  const file = name.charCodeAt(0) - 97; // 'a'
  const rank = Number(name[1]) - 1;
  return rank * 8 + file;
}

/**
 * Build the LED command: `0A 08` + 8 bytes, one per rank starting at rank 8.
 * Within each byte, file a = 0x80 (MSB) … file h = 0x01 (LSB).
 * Each write replaces the whole LED state.
 */
export function buildLedCommand(squares: string[]): Uint8Array {
  const payload = new Uint8Array(8);
  for (const name of squares) {
    const idx = squareIndex(name);
    const file = idx % 8;
    const rank = Math.floor(idx / 8) + 1;
    payload[8 - rank] |= 0x80 >> file;
  }
  return Uint8Array.from([0x0a, 0x08, ...payload]);
}

export interface BatteryStatus {
  percent: number;
  charging: boolean;
}

/** Parse a `2A 02 <pct> <charging>` battery notification, or null if not one. */
export function parseBatteryNotification(data: Uint8Array): BatteryStatus | null {
  if (data.length < 3 || data[0] !== 0x2a) return null;
  return {
    percent: Math.min(100, data[2]),
    charging: data.length > 3 ? data[3] === 1 : false,
  };
}

/** Occupancy of the standard chess starting position. */
export function startingOccupancy(): Occupancy {
  const occ: Occupancy = new Array(64).fill(null);
  const back = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
  for (let f = 0; f < 8; f++) {
    occ[f] = back[f].toUpperCase(); // rank 1, white
    occ[8 + f] = 'P'; // rank 2
    occ[48 + f] = 'p'; // rank 7
    occ[56 + f] = back[f]; // rank 8, black
  }
  return occ;
}

/** Squares (algebraic) where two occupancies differ. */
export function diffOccupancy(a: Occupancy, b: Occupancy): string[] {
  const out: string[] = [];
  for (let i = 0; i < 64; i++) {
    if (a[i] !== b[i]) out.push(squareName(i));
  }
  return out;
}

export function occupancyEquals(a: Occupancy, b: Occupancy): boolean {
  for (let i = 0; i < 64; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Rotate an occupancy 180° (square i ↔ 63-i). Used when the players set up
 * the game with white on the board's "black side": physical frames are
 * rotated into logical coordinates and LED squares back into physical ones.
 */
export function rotateOccupancy(occ: Occupancy): Occupancy {
  return [...occ].reverse();
}

/** The 180°-rotated counterpart of a square name ("e2" → "d7"). */
export function rotateSquare(name: string): string {
  return squareName(63 - squareIndex(name));
}
