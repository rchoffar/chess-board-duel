export type Color = 'w' | 'b';

export interface TimeControl {
  /** Base time per player, in minutes. */
  baseMinutes: number;
  /** Fischer increment per move, in seconds. */
  incrementSeconds: number;
}

export interface ClockState {
  whiteMs: number;
  blackMs: number;
  /** Whose clock is counting down, or null when paused/not started. */
  running: Color | null;
  /** Timestamp (ms) when `running`'s turn started; null when paused. */
  turnStartedAt: number | null;
}

export function createClock(tc: TimeControl): ClockState {
  const base = tc.baseMinutes * 60_000;
  return { whiteMs: base, blackMs: base, running: null, turnStartedAt: null };
}

export function startClock(clock: ClockState, color: Color, now: number): ClockState {
  return { ...clock, running: color, turnStartedAt: now };
}

/** Remaining time for a side, accounting for the in-progress turn. */
export function remainingMs(clock: ClockState, color: Color, now: number): number {
  const base = color === 'w' ? clock.whiteMs : clock.blackMs;
  if (clock.running !== color || clock.turnStartedAt === null) return base;
  return Math.max(0, base - (now - clock.turnStartedAt));
}

/** True if `color` has run out of time. */
export function isFlagged(clock: ClockState, color: Color, now: number): boolean {
  return remainingMs(clock, color, now) <= 0;
}

/**
 * The running side completed a move: bank their remaining time, add the
 * increment, and start the opponent's clock.
 */
export function switchClock(clock: ClockState, tc: TimeControl, now: number): ClockState {
  if (clock.running === null || clock.turnStartedAt === null) return clock;
  const mover = clock.running;
  const banked = remainingMs(clock, mover, now) + tc.incrementSeconds * 1000;
  return {
    whiteMs: mover === 'w' ? banked : clock.whiteMs,
    blackMs: mover === 'b' ? banked : clock.blackMs,
    running: mover === 'w' ? 'b' : 'w',
    turnStartedAt: now,
  };
}

/** Stop the clock (game over / pause), banking the running side's elapsed time. */
export function stopClock(clock: ClockState, now: number): ClockState {
  if (clock.running === null || clock.turnStartedAt === null) {
    return { ...clock, running: null, turnStartedAt: null };
  }
  const banked = remainingMs(clock, clock.running, now);
  return {
    whiteMs: clock.running === 'w' ? banked : clock.whiteMs,
    blackMs: clock.running === 'b' ? banked : clock.blackMs,
    running: null,
    turnStartedAt: null,
  };
}

/** "5:03", "0:59", "0:09.4" under 10s. */
export function formatClock(ms: number): string {
  const clamped = Math.max(0, ms);
  if (clamped < 10_000) {
    return `0:0${Math.floor(clamped / 1000)}.${Math.floor((clamped % 1000) / 100)}`;
  }
  const totalSeconds = Math.ceil(clamped / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** PGN TimeControl tag value, e.g. "300+3". */
export function timeControlTag(tc: TimeControl): string {
  return `${tc.baseMinutes * 60}+${tc.incrementSeconds}`;
}

/** Human label, e.g. "5+3". */
export function timeControlLabel(tc: TimeControl): string {
  return `${tc.baseMinutes}+${tc.incrementSeconds}`;
}
