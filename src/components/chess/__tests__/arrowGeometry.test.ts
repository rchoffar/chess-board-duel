import { buildArrow, isKnightMove, squareCenter, squareTopLeft } from '../arrowGeometry';

const S = 40; // square size used across tests

describe('isKnightMove', () => {
  it.each([
    ['g1', 'f3'],
    ['b1', 'c3'],
    ['e4', 'd6'],
    ['e4', 'g5'],
  ])('detects %s-%s as a knight move', (from, to) => {
    expect(isKnightMove(from, to)).toBe(true);
  });

  it.each([
    ['e2', 'e4'], // straight push
    ['a1', 'h8'], // long diagonal
    ['e1', 'g1'], // castling king hop (df 2, dr 0)
    ['e2', 'e3'],
    ['d4', 'd4'],
  ])('rejects %s-%s', (from, to) => {
    expect(isKnightMove(from, to)).toBe(false);
  });
});

describe('squareTopLeft / squareCenter', () => {
  it('maps a1 with white orientation to the bottom-left', () => {
    expect(squareTopLeft('a1', S, 'white')).toEqual({ x: 0, y: 7 * S });
    expect(squareCenter('a1', S, 'white')).toEqual({ x: S / 2, y: 7.5 * S });
  });

  it('maps a1 with black orientation to the top-right', () => {
    expect(squareTopLeft('a1', S, 'black')).toEqual({ x: 7 * S, y: 0 });
    expect(squareCenter('a1', S, 'black')).toEqual({ x: 7.5 * S, y: S / 2 });
  });

  it('maps h8 with white orientation to the top-right', () => {
    expect(squareCenter('h8', S, 'white')).toEqual({ x: 7.5 * S, y: S / 2 });
  });

  it('is symmetric under orientation flip', () => {
    const white = squareCenter('c2', S, 'white');
    const black = squareCenter('c2', S, 'black');
    expect(white.x + black.x).toBe(8 * S);
    expect(white.y + black.y).toBe(8 * S);
  });
});

describe('buildArrow', () => {
  it('builds a straight two-point shaft for a straight move', () => {
    const spec = buildArrow('e2', 'e4', S, 'white');
    expect(spec.shaft.match(/L/g)).toHaveLength(1);
    // Vertical move on the e-file: x constant at e-file center; the start is
    // offset 0.38s toward the target, the shaft stops 0.32s short of the tip.
    const eCenter = squareCenter('e2', S, 'white').x;
    expect(spec.shaft).toBe(`M ${eCenter} ${6.5 * S - 0.38 * S} L ${eCenter} ${4.5 * S + 0.32 * S}`);
  });

  it('places the head tip on the destination center', () => {
    const spec = buildArrow('e2', 'e4', S, 'white');
    const tip = spec.head.split(' ')[0];
    const b = squareCenter('e4', S, 'white');
    expect(tip).toBe(`${b.x},${b.y}`);
  });

  it('bends knight arrows long-leg-first with two segments', () => {
    const spec = buildArrow('g1', 'f3', S, 'white');
    expect(spec.shaft.match(/L/g)).toHaveLength(2);
    // g1->f3: dr = 2 is the long leg, so the corner is (fileFrom, rankTo) = g3.
    const corner = squareCenter('g3', S, 'white');
    expect(spec.shaft).toContain(`L ${corner.x} ${corner.y}`);
  });

  it('uses (fileTo, rankFrom) as the corner when the file leg is long', () => {
    const spec = buildArrow('e4', 'g5', S, 'white');
    const corner = squareCenter('g4', S, 'white');
    expect(spec.shaft).toContain(`L ${corner.x} ${corner.y}`);
  });

  it('honors orientation', () => {
    const white = buildArrow('e2', 'e4', S, 'white');
    const black = buildArrow('e2', 'e4', S, 'black');
    expect(white.shaft).not.toBe(black.shaft);
  });
});
