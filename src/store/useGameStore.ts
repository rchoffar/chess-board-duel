import { create } from 'zustand';
import { Chess } from 'chess.js';
import * as Haptics from 'expo-haptics';
import { MoveDetector, occupancyFromChess, type DetectedMove } from '../chess/MoveDetector';
import {
  castlingStateFromFen,
  chess960Fen,
  randomChess960Index,
  withCastlingField,
  type Variant,
} from '../chess/chess960';
import {
  createClock,
  startClock,
  switchClock,
  stopClock,
  isFlagged,
  type ClockState,
  type Color,
  type PlayerTimeControls,
} from '../chess/clock';
import {
  diffOccupancy,
  rotateOccupancy,
  rotateSquare,
  type Occupancy,
} from '../ble/protocol';
import { buildPgn } from '../utils/pgn';
import { createGame, deleteGame, finishGame, updateGameProgress } from '../db/games';
import { useBoardStore } from './useBoardStore';
import { useSettingsStore } from './useSettingsStore';

export type GamePhase = 'idle' | 'setup' | 'ready' | 'playing' | 'undoing' | 'finished';

export interface GameConfig {
  white: string;
  black: string;
  whiteId: number | null;
  blackId: number | null;
  timeControls: PlayerTimeControls;
  variant: Variant;
}

export interface RecordedMove {
  san: string;
  color: Color;
  /** Mover's remaining clock time after the move (increment included), ms. */
  clockMs: number;
}

interface GameState {
  phase: GamePhase;
  config: GameConfig | null;
  clock: ClockState | null;
  fen: string | null;
  /** Chess960 start position (KQkq X-FEN); null for standard games. */
  startFen: string | null;
  moves: RecordedMove[];
  /** Squares that differ from the expected position while the board is wrong. */
  illegalSquares: string[];
  /** Squares still misplaced during initial setup. */
  setupSquares: string[];
  /** Squares still misplaced while restoring the position after an undo. */
  undoSquares: string[];
  result: string | null;
  termination: string | null;
  gameId: number | null;
  /**
   * True when the players set up white on the board's "black side": physical
   * frames are rotated 180° into logical coordinates, LED squares rotated
   * back, and the game screen mirrors (clocks swapped, board drawn black-side
   * down) so everything sits in front of the right player.
   */
  flipped: boolean;

  startGame: (config: GameConfig) => void;
  /** Start the clock once the board is set up (phase 'ready'). */
  beginPlay: () => void;
  resign: (color: Color) => void;
  agreeDraw: () => void;
  abortGame: () => void;
  /**
   * Take back the last move: pauses the clock and waits (phase 'undoing') for
   * the physical board to be restored to the previous position before resuming.
   */
  undoMove: () => void;
  /** Clock heartbeat from the UI; also detects flag fall. */
  tick: (now: number) => void;
  reset: () => void;
}

let detector: MoveDetector | null = null;
let startedAt = 0;
let unsubscribeFrames: (() => void) | null = null;
// The board streams frames on changes but may stay quiet while the position is
// stable — this timer re-feeds the last frame so time-based decisions (move
// confirmation, illegal-position debounce) still fire.
let refeedTimer: ReturnType<typeof setTimeout> | null = null;
let lastOcc: Occupancy | null = null;
// Paused clock snapshot taken just before each move, so an undo can restore
// the exact pre-move times (switchClock is lossy: it banks elapsed time and
// adds the increment).
let clockHistory: ClockState[] = [];

function clearRefeed() {
  if (refeedTimer) {
    clearTimeout(refeedTimer);
    refeedTimer = null;
  }
}

const INITIAL = {
  phase: 'idle' as GamePhase,
  config: null,
  clock: null,
  fen: null,
  startFen: null,
  moves: [],
  illegalSquares: [],
  setupSquares: [],
  undoSquares: [],
  result: null,
  termination: null,
  gameId: null,
  flipped: false,
};

export const useGameStore = create<GameState>((set, get) => {
  function board() {
    return useBoardStore.getState();
  }

  /** Light LEDs for logical squares, translated to physical board squares. */
  function setLedsLogical(squares: string[]) {
    board().setLeds(get().flipped ? squares.map(rotateSquare) : squares);
  }

  function handleSetupFrame(occ: Occupancy) {
    if (!detector) return;
    // Either orientation is a valid start: white on the board's white side
    // (normal) or on its black side (flipped). Guide towards whichever the
    // players are closer to completing. The expected occupancy comes from the
    // game's own start position, so Chess960 back ranks are verified
    // piece-by-piece too (frames carry piece identity).
    const expected = occupancyFromChess(detector.chess);
    const normalMismatches = diffOccupancy(expected, occ);
    const rotatedMismatches = diffOccupancy(rotateOccupancy(expected), occ);

    if (normalMismatches.length === 0 || rotatedMismatches.length === 0) {
      const flipped = rotatedMismatches.length === 0 && normalMismatches.length > 0;
      board().setLeds([]);
      // Don't start the clock yet — wait for the players to tap "Start game".
      if (get().phase !== 'ready') {
        set({ phase: 'ready', setupSquares: [], flipped });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } else if (get().flipped !== flipped) {
        set({ flipped });
      }
      return;
    }

    // Position disturbed while waiting for start → back to setup guidance.
    if (get().phase === 'ready') {
      set({ phase: 'setup' });
    }

    // Physical squares that still need fixing, for the closer orientation.
    const physical =
      normalMismatches.length <= rotatedMismatches.length ? normalMismatches : rotatedMismatches;
    const logical =
      physical === normalMismatches ? physical : physical.map(rotateSquare);
    set({ setupSquares: logical, flipped: physical !== normalMismatches });
    board().setLeds(physical);
  }

  function handlePlayingFrame(physicalOcc: Occupancy, receivedAt: number) {
    if (!detector) return;
    clearRefeed();
    lastOcc = physicalOcc;
    const occ = get().flipped ? rotateOccupancy(physicalOcc) : physicalOcc;
    const event = detector.onFrame(occ, receivedAt);

    switch (event.type) {
      case 'move':
        onMoveCompleted(event.move, event.completedAt);
        // A recapture-commit leaves the recapture itself unexplained in this
        // same frame — evaluate it again against the advanced position.
        if (detector && get().phase === 'playing') {
          handlePlayingFrame(physicalOcc, receivedAt);
        }
        break;
      case 'illegal':
        if (!occupancySameSet(get().illegalSquares, event.mismatches)) {
          set({ illegalSquares: event.mismatches });
          setLedsLogical(event.mismatches);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        }
        break;
      case 'match':
        if (get().illegalSquares.length > 0) {
          set({ illegalSquares: [] });
          board().setLeds([]);
        }
        break;
      case 'pending':
      case 'transient':
        // Re-check after the settle window even if the board sends nothing.
        refeedTimer = setTimeout(() => {
          refeedTimer = null;
          if (get().phase === 'playing' && lastOcc) {
            handlePlayingFrame(lastOcc, Date.now());
          }
        }, detector.maxSettleMs);
        break;
    }
  }

  function handleUndoFrame(physicalOcc: Occupancy) {
    if (!detector) return;
    lastOcc = physicalOcc;
    const occ = get().flipped ? rotateOccupancy(physicalOcc) : physicalOcc;
    const mismatches = diffOccupancy(detector.expectedOccupancy, occ);

    if (mismatches.length === 0) {
      const clock = get().clock;
      board().setLeds([]);
      set({
        phase: 'playing',
        undoSquares: [],
        clock: clock ? startClock(clock, detector.chess.turn() as Color, Date.now()) : clock,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      if (useSettingsStore.getState().boardSounds) {
        board().beep(1400, 200);
      }
      return;
    }

    if (!occupancySameSet(get().undoSquares, mismatches)) {
      set({ undoSquares: mismatches });
      setLedsLogical(mismatches);
    }
  }

  function occupancySameSet(a: string[], b: string[]): boolean {
    return a.length === b.length && [...a].sort().join() === [...b].sort().join();
  }

  /** PGN for the current game from the recorded moves (survives 960 castles). */
  function gamePgn(
    moves: RecordedMove[],
    config: GameConfig,
    result: string,
    termination?: string
  ): string {
    return buildPgn(
      moves.map((m) => m.san),
      {
        white: config.white,
        black: config.black,
        startedAt,
        timeControls: config.timeControls,
        variant: config.variant,
        startFen: get().startFen ?? undefined,
        result,
        termination,
      }
    );
  }

  function onMoveCompleted(move: DetectedMove, now: number) {
    const state = get();
    if (!state.clock || !state.config || !detector) return;

    clockHistory.push(stopClock(state.clock, now));
    const nextClock = switchClock(state.clock, state.config.timeControls, now);
    const clockMs = move.color === 'w' ? nextClock.whiteMs : nextClock.blackMs;
    const moves = [...state.moves, { san: move.san, color: move.color as Color, clockMs }];

    if (state.illegalSquares.length > 0) board().setLeds([]);
    set({ clock: nextClock, moves, illegalSquares: [], fen: detector.chess.fen() });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    if (useSettingsStore.getState().beepOnCheck && detector.chess.inCheck()) {
      board().beep(1200, 200);
    }

    if (state.gameId) {
      updateGameProgress(state.gameId, gamePgn(moves, state.config, '*'), moves.length);
    }

    // In 960 mode chess.js runs without castling rights, so a position whose
    // only legal move is a castle would read as stalemate — check ours too.
    if (detector.chess.isGameOver() && detector.availableCastles().length === 0) {
      let result: string;
      let termination: string;
      if (detector.chess.isCheckmate()) {
        result = move.color === 'w' ? '1-0' : '0-1';
        termination = 'Checkmate';
      } else if (detector.chess.isStalemate()) {
        result = '1/2-1/2';
        termination = 'Stalemate';
      } else if (detector.chess.isThreefoldRepetition()) {
        result = '1/2-1/2';
        termination = 'Threefold repetition';
      } else if (detector.chess.isInsufficientMaterial()) {
        result = '1/2-1/2';
        termination = 'Insufficient material';
      } else {
        result = '1/2-1/2';
        termination = 'Draw';
      }
      endGame(result, termination, now);
    }
  }

  function endGame(result: string, termination: string, now: number) {
    const state = get();
    if (!state.config) return;
    const finalClock = state.clock ? stopClock(state.clock, now) : null;

    const pgn = detector ? gamePgn(state.moves, state.config, result, termination) : '';

    if (state.gameId) {
      finishGame(state.gameId, {
        endedAt: now,
        result,
        termination,
        pgn,
        moveCount: state.moves.length,
      });
    }

    board().setLeds([]);
    set({ phase: 'finished', result, termination, clock: finalClock });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }

  return {
    ...INITIAL,

    startGame: (config) => {
      get().reset();
      // Chess960 runs chess.js with castling '-' (it can't represent 960
      // castles); the detector's own castling state handles them instead.
      const startFen = config.variant === 'chess960' ? chess960Fen(randomChess960Index()) : null;
      detector = new MoveDetector(
        startFen ? new Chess(withCastlingField(startFen, '-')) : undefined,
        {
          moveConfirmMs: useSettingsStore.getState().moveConfirmMs,
          allowTakeBack: useSettingsStore.getState().allowTakeBack,
          castling: startFen ? castlingStateFromFen(startFen) : null,
        }
      );
      startedAt = Date.now();
      const gameId = createGame({
        startedAt,
        white: config.white,
        black: config.black,
        whiteId: config.whiteId,
        blackId: config.blackId,
        timeControls: config.timeControls,
        variant: config.variant,
        startFen,
      });
      set({ ...INITIAL, phase: 'setup', config, gameId, fen: detector.chess.fen(), startFen });

      unsubscribeFrames = board().subscribeFrames((occ, receivedAt) => {
        const phase = get().phase;
        if (phase === 'setup' || phase === 'ready') handleSetupFrame(occ);
        else if (phase === 'playing') handlePlayingFrame(occ, receivedAt);
        else if (phase === 'undoing') handleUndoFrame(occ);
      });

      // If the board already sits in the right position, start immediately.
      const last = board().lastOccupancy;
      if (last) handleSetupFrame(last);
    },

    beginPlay: () => {
      const state = get();
      if (state.phase !== 'ready' || !state.config) return;
      set({
        phase: 'playing',
        clock: startClock(createClock(state.config.timeControls), 'w', Date.now()),
      });
      if (useSettingsStore.getState().boardSounds) {
        board().beep(1400, 200);
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    },

    resign: (color) => {
      const result = color === 'w' ? '0-1' : '1-0';
      const winner = color === 'w' ? 'Black' : 'White';
      endGame(result, `${winner} wins by resignation`, Date.now());
    },

    agreeDraw: () => {
      endGame('1/2-1/2', 'Draw by agreement', Date.now());
    },

    abortGame: () => {
      const state = get();
      if (state.gameId && state.moves.length === 0) {
        // Nothing was played — drop the placeholder row.
        deleteGame(state.gameId);
      } else if (state.phase === 'playing' || state.phase === 'undoing') {
        endGame('*', 'Aborted', Date.now());
      }
      get().reset();
    },

    undoMove: () => {
      const state = get();
      if (
        (state.phase !== 'playing' && state.phase !== 'undoing') ||
        state.moves.length === 0 ||
        !detector ||
        !state.config
      ) {
        return;
      }
      const snapshot = clockHistory.pop();
      if (!snapshot || !detector.undo()) return; // lengths stay in lockstep with moves
      clearRefeed();
      const moves = state.moves.slice(0, -1);
      set({
        phase: 'undoing',
        moves,
        fen: detector.chess.fen(),
        clock: snapshot,
        illegalSquares: [],
        undoSquares: [],
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      if (state.gameId) {
        updateGameProgress(state.gameId, gamePgn(moves, state.config, '*'), moves.length);
      }
      // Light the squares to restore right away (the board may not send a new
      // frame until a piece moves); also resumes instantly if already matching.
      if (lastOcc) handleUndoFrame(lastOcc);
    },

    tick: (now) => {
      const state = get();
      if (state.phase !== 'playing' || !state.clock || !state.clock.running) return;
      const running = state.clock.running;
      if (isFlagged(state.clock, running, now)) {
        const result = running === 'w' ? '0-1' : '1-0';
        const winner = running === 'w' ? 'Black' : 'White';
        if (useSettingsStore.getState().boardSounds) {
          board().beep(880, 500);
        }
        endGame(result, `${winner} wins on time`, now);
      }
    },

    reset: () => {
      unsubscribeFrames?.();
      unsubscribeFrames = null;
      clearRefeed();
      lastOcc = null;
      detector = null;
      clockHistory = [];
      set(INITIAL);
    },
  };
});
