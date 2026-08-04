import {
  parseBoardFrame,
  buildLedCommand,
  parseBatteryNotification,
  startingOccupancy,
  diffOccupancy,
  occupancyEquals,
  squareName,
  squareIndex,
  isBoardFrame,
  fromHex,
  toHex,
} from '../protocol';

// Starting position as the board sends it: wire order h8..a8, h7..a7, …, h1..a1,
// low nibble = first square of each pair. Piece codes:
// q=1 k=2 b=3 p=4 n=5 R=6 P=7 r=8 B=9 N=a Q=b K=c
const START_FRAME = fromHex(
  '0124' +
    '58233185' + // rank 8: r n b k q b n r (wire h→a)
    '44444444' + // rank 7: pawns
    '00000000' +
    '00000000' +
    '00000000' +
    '00000000' +
    '77777777' + // rank 2: Pawns
    'a6c99b6a' + // rank 1: R N B K Q B N R (wire h→a)
    'deadbeef' // timestamp (ignored)
);

describe('parseBoardFrame', () => {
  it('parses the starting position', () => {
    expect(parseBoardFrame(START_FRAME)).toEqual(startingOccupancy());
  });

  it('maps specific squares correctly', () => {
    const occ = parseBoardFrame(START_FRAME);
    expect(occ[squareIndex('a1')]).toBe('R');
    expect(occ[squareIndex('e1')]).toBe('K');
    expect(occ[squareIndex('d1')]).toBe('Q');
    expect(occ[squareIndex('e8')]).toBe('k');
    expect(occ[squareIndex('d8')]).toBe('q');
    expect(occ[squareIndex('h8')]).toBe('r');
    expect(occ[squareIndex('e4')]).toBeNull();
  });

  it('rejects non-board frames', () => {
    expect(isBoardFrame(fromHex('230100'))).toBe(false);
    expect(() => parseBoardFrame(fromHex('230100'))).toThrow();
  });

  it('parses an empty board', () => {
    const empty = new Uint8Array(38);
    empty[0] = 0x01;
    empty[1] = 0x24;
    expect(parseBoardFrame(empty)).toEqual(new Array(64).fill(null));
  });
});

describe('buildLedCommand', () => {
  it('turns all LEDs off with no squares', () => {
    expect(toHex(buildLedCommand([]))).toBe('0a080000000000000000');
  });

  it('lights e2 and e4 (reference example from chessnut docs)', () => {
    expect(toHex(buildLedCommand(['e2', 'e4']))).toBe('0a080000000008000800');
  });

  it('uses a=0x80 … h=0x01 within a rank byte, rank 8 first', () => {
    expect(toHex(buildLedCommand(['a8']))).toBe('0a088000000000000000');
    expect(toHex(buildLedCommand(['h8']))).toBe('0a080100000000000000');
    expect(toHex(buildLedCommand(['a1']))).toBe('0a080000000000000080');
    expect(toHex(buildLedCommand(['h1']))).toBe('0a080000000000000001');
  });

  it('combines squares on the same rank', () => {
    expect(toHex(buildLedCommand(['a1', 'h1']))).toBe('0a080000000000000081');
  });
});

describe('parseBatteryNotification', () => {
  it('parses percent and charging flag', () => {
    expect(parseBatteryNotification(fromHex('2a026401'))).toEqual({ percent: 100, charging: true });
    expect(parseBatteryNotification(fromHex('2a023200'))).toEqual({ percent: 50, charging: false });
  });

  it('returns null for other notifications', () => {
    expect(parseBatteryNotification(fromHex('230100'))).toBeNull();
  });
});

describe('square helpers', () => {
  it('round-trips names and indices', () => {
    expect(squareName(0)).toBe('a1');
    expect(squareName(63)).toBe('h8');
    expect(squareIndex('e4')).toBe(28);
    for (let i = 0; i < 64; i++) {
      expect(squareIndex(squareName(i))).toBe(i);
    }
  });
});

describe('occupancy helpers', () => {
  it('diffs occupancies', () => {
    const a = startingOccupancy();
    const b = startingOccupancy();
    b[squareIndex('e2')] = null;
    b[squareIndex('e4')] = 'P';
    expect(diffOccupancy(a, b).sort()).toEqual(['e2', 'e4']);
    expect(occupancyEquals(a, b)).toBe(false);
    expect(occupancyEquals(a, startingOccupancy())).toBe(true);
  });
});
