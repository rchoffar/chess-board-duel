import { create } from 'zustand';
import type { Move } from 'chess.js';
import * as Haptics from 'expo-haptics';
import { MoveDetector } from '../chess/MoveDetector';
import {
  createClock,
  startClock,
  switchClock,
  stopClock,
  isFlagged,
  type ClockState,
  type Color,
  type TimeControl,
} from '../chess/clock';
import { occupancyEquals, startingOccupancy, diffOccupancy, type Occupancy } from '../ble/protocol';
import { buildPgn } from '../utils/pgn';
import { createGame, deleteGame, finishGame, updateGameProgress } from '../db/games';
import { useBoardStore } from './useBoardStore';

export type GamePhase = 'idle' | 'setup' | 'playing' | 'finished';

export interface GameConfig {
  white: string;
  black: string;
  timeControl: TimeControl;
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
  moves: RecordedMove[];
  /** Squares that differ from the expected position while the board is wrong. */
  illegalSquares: string[];
  /** Squares still misplaced during initial setup. */
  setupSquares: string[];
  result: string | null;
  termination: string | null;
  gameId: number | null;

  startGame: (config: GameConfig) => void;
  resign: (color: Color) => void;
  agreeDraw: () => void;
  abortGame: () => void;
  /** Clock heartbeat from the UI; also detects flag fall. */
  tick: (now: number) => void;
  reset: () => void;
}

let detector: MoveDetector | null = null;
let startedAt = 0;
let unsubscribeFrames: (() => void) | null = null;

const INITIAL = {
  phase: 'idle' as GamePhase,
  config: null,
  clock: null,
  fen: null,
  moves: [],
  illegalSquares: [],
  setupSquares: [],
  result: null,
  termination: null,
  gameId: null,
};

export const useGameStore = create<GameState>((set, get) => {
  function board() {
    return useBoardStore.getState();
  }

  function handleSetupFrame(occ: Occupancy) {
    const mismatches = diffOccupancy(startingOccupancy(), occ);
    if (mismatches.length === 0) {
      board().setLeds([]);
      const now = Date.now();
      set({
        phase: 'playing',
        setupSquares: [],
        clock: startClock(createClock(get().config!.timeControl), 'w', now),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } else {
      set({ setupSquares: mismatches });
      board().setLeds(mismatches);
    }
  }

  function handlePlayingFrame(occ: Occupancy, receivedAt: number) {
    if (!detector) return;
    const event = detector.onFrame(occ, receivedAt);

    switch (event.type) {
      case 'move':
        onMoveCompleted(event.move, receivedAt);
        break;
      case 'illegal':
        if (!occupancySameSet(get().illegalSquares, event.mismatches)) {
          set({ illegalSquares: event.mismatches });
          board().setLeds(event.mismatches);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        }
        break;
      case 'match':
        if (get().illegalSquares.length > 0) {
          set({ illegalSquares: [] });
          board().setLeds([]);
        }
        break;
      case 'transient':
        break;
    }
  }

  function occupancySameSet(a: string[], b: string[]): boolean {
    return a.length === b.length && [...a].sort().join() === [...b].sort().join();
  }

  function onMoveCompleted(move: Move, now: number) {
    const state = get();
    if (!state.clock || !state.config || !detector) return;

    const nextClock = switchClock(state.clock, state.config.timeControl, now);
    const clockMs = move.color === 'w' ? nextClock.whiteMs : nextClock.blackMs;
    const moves = [...state.moves, { san: move.san, color: move.color as Color, clockMs }];

    if (state.illegalSquares.length > 0) board().setLeds([]);
    set({ clock: nextClock, moves, illegalSquares: [], fen: detector.chess.fen() });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    if (state.gameId) {
      const pgn = buildPgn(detector.chess, {
        white: state.config.white,
        black: state.config.black,
        startedAt,
        timeControl: state.config.timeControl,
        result: '*',
      });
      updateGameProgress(state.gameId, pgn, moves.length);
    }

    if (detector.chess.isGameOver()) {
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

    let pgn = '';
    if (detector) {
      pgn = buildPgn(detector.chess, {
        white: state.config.white,
        black: state.config.black,
        startedAt,
        timeControl: state.config.timeControl,
        result,
        termination,
      });
    }

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
      detector = new MoveDetector();
      startedAt = Date.now();
      const gameId = createGame({
        startedAt,
        white: config.white,
        black: config.black,
        timeControl: config.timeControl,
      });
      set({ ...INITIAL, phase: 'setup', config, gameId, fen: detector.chess.fen() });

      unsubscribeFrames = board().subscribeFrames((occ, receivedAt) => {
        const phase = get().phase;
        if (phase === 'setup') handleSetupFrame(occ);
        else if (phase === 'playing') handlePlayingFrame(occ, receivedAt);
      });

      // If the board already sits in the right position, start immediately.
      const last = board().lastOccupancy;
      if (last) handleSetupFrame(last);
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
      } else if (state.phase === 'playing') {
        endGame('*', 'Aborted', Date.now());
      }
      get().reset();
    },

    tick: (now) => {
      const state = get();
      if (state.phase !== 'playing' || !state.clock || !state.clock.running) return;
      const running = state.clock.running;
      if (isFlagged(state.clock, running, now)) {
        const result = running === 'w' ? '0-1' : '1-0';
        const winner = running === 'w' ? 'Black' : 'White';
        board().beep(880, 500);
        endGame(result, `${winner} wins on time`, now);
      }
    },

    reset: () => {
      unsubscribeFrames?.();
      unsubscribeFrames = null;
      detector = null;
      set(INITIAL);
    },
  };
});
