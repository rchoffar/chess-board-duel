import { formatBarScore, MATE_CP } from '../evalUtils';

describe('formatBarScore', () => {
  it('formats centipawns as unsigned pawns with one decimal', () => {
    expect(formatBarScore({ cp: 120 })).toBe('1.2');
    expect(formatBarScore({ cp: -120 })).toBe('1.2');
    expect(formatBarScore({ cp: 0 })).toBe('0.0');
  });

  it('drops the decimal at 10 pawns and above', () => {
    expect(formatBarScore({ cp: 1530 })).toBe('15');
    expect(formatBarScore({ cp: -1000 })).toBe('10');
  });

  it('formats mate scores unsigned', () => {
    expect(formatBarScore({ mate: 5 })).toBe('M5');
    expect(formatBarScore({ mate: -3 })).toBe('M3');
  });

  it('shows "#" for delivered checkmate', () => {
    expect(formatBarScore({ mate: 0 })).toBe('#');
    expect(formatBarScore({ cp: MATE_CP })).toBe('#');
    expect(formatBarScore({ cp: -MATE_CP })).toBe('#');
  });
});
