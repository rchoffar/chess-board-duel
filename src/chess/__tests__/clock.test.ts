import {
  createClock,
  startClock,
  switchClock,
  stopClock,
  remainingMs,
  isFlagged,
  formatClock,
  timeControlTag,
  timeControlLabel,
  type TimeControl,
} from '../clock';

const TC: TimeControl = { baseMinutes: 5, incrementSeconds: 3 };

describe('clock', () => {
  it('creates both sides with base time, not running', () => {
    const c = createClock(TC);
    expect(c.whiteMs).toBe(300_000);
    expect(c.blackMs).toBe(300_000);
    expect(c.running).toBeNull();
  });

  it('counts down only the running side', () => {
    let c = startClock(createClock(TC), 'w', 1000);
    expect(remainingMs(c, 'w', 6000)).toBe(295_000);
    expect(remainingMs(c, 'b', 6000)).toBe(300_000);
  });

  it('banks time + increment and switches side on move completion', () => {
    let c = startClock(createClock(TC), 'w', 0);
    c = switchClock(c, TC, 10_000); // white used 10s
    expect(c.whiteMs).toBe(293_000); // 300 - 10 + 3
    expect(c.running).toBe('b');
    expect(remainingMs(c, 'b', 15_000)).toBe(295_000);
  });

  it('alternates correctly over several moves', () => {
    let c = startClock(createClock(TC), 'w', 0);
    c = switchClock(c, TC, 5000); // white -5s +3s
    c = switchClock(c, TC, 12_000); // black -7s +3s
    c = switchClock(c, TC, 14_000); // white -2s +3s
    expect(c.whiteMs).toBe(299_000);
    expect(c.blackMs).toBe(296_000);
    expect(c.running).toBe('b');
  });

  it('flags when time runs out and clamps at zero', () => {
    let c = startClock(createClock(TC), 'w', 0);
    expect(isFlagged(c, 'w', 299_999)).toBe(false);
    expect(isFlagged(c, 'w', 300_000)).toBe(true);
    expect(remainingMs(c, 'w', 400_000)).toBe(0);
  });

  it('stops and banks elapsed time', () => {
    let c = startClock(createClock(TC), 'w', 0);
    c = stopClock(c, 60_000);
    expect(c.whiteMs).toBe(240_000);
    expect(c.running).toBeNull();
    // time no longer advances
    expect(remainingMs(c, 'w', 120_000)).toBe(240_000);
  });

  it('formats times', () => {
    expect(formatClock(300_000)).toBe('5:00');
    expect(formatClock(59_000)).toBe('0:59');
    expect(formatClock(9_400)).toBe('0:09.4');
    expect(formatClock(0)).toBe('0:00.0');
    expect(formatClock(-5)).toBe('0:00.0');
    expect(formatClock(61_500)).toBe('1:02'); // ceils to whole seconds
  });

  it('renders PGN tag and label', () => {
    expect(timeControlTag(TC)).toBe('300+3');
    expect(timeControlLabel(TC)).toBe('5+3');
    expect(timeControlTag({ baseMinutes: 10, incrementSeconds: 0 })).toBe('600+0');
  });
});
