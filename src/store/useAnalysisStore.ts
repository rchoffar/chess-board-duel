import { create } from 'zustand';
import { evalPosition, initEngine, stopCurrentSearch, thermalState, type PositionEval } from '../chess/engine';
import { judgeGame, type Judgment } from '../chess/judgment';
import { gameAccuracy } from '../chess/accuracy';
import { getAnalysis, saveAnalysis } from '../db/analysis';
import type { Score } from '../chess/evalUtils';

const BATCH_DEPTH = 16;
const BATCH_DEPTH_HOT = 10;
const LIVE_DEPTH = 18;
const SAVE_EVERY = 10;

// Bumped when a batch analysis starts so queued live evals cancel instead of
// head-blocking the batch behind slow depth-18 searches.
let liveGeneration = 0;

interface AnalysisState {
  gameId: number | null;
  running: boolean;
  progress: { done: number; total: number };
  /** Position evals, index = ply (0 = start position, i = after i moves). */
  evals: (PositionEval | null)[];
  /** Judgment per move, index = 0-based ply of the move. */
  judgments: Judgment[];
  /** Lichess-formula accuracy per player, 0-100; null until analysis is complete. */
  accuracies: { white: number; black: number } | null;
  /** True when every position of the loaded game has a stored eval. */
  complete: boolean;
  /** Loaded game is Chess960 — evals run with UCI_Chess960 set. */
  chess960: boolean;
  error: string | null;

  /** Load stored analysis for a game (fens/playedUcis describe the full game). */
  load: (gameId: number, fens: string[], playedUcis: string[], chess960?: boolean) => void;
  /** Full game-review pass; persists results. */
  analyzeGame: (gameId: number, fens: string[], playedUcis: string[]) => Promise<void>;
  /** Evaluate a single ply on demand (live scrubbing); cached in memory. */
  evalPly: (ply: number, fen: string) => Promise<void>;
  clear: () => void;
}

function rowsToScore(cp: number | null, mate: number | null): Score {
  return mate !== null ? { mate } : { cp: cp ?? 0 };
}

function computeJudgments(evals: (PositionEval | null)[], playedUcis: string[]): Judgment[] {
  if (evals.some((e) => e === null)) return [];
  const scores = evals.map((e) => e!.score);
  const bestUcis = evals.slice(0, -1).map((e) => e!.bestUci);
  const fens = evals.map((e) => e!.fen);
  return judgeGame({ positionScores: scores, bestUcis, playedUcis, fens });
}

export const useAnalysisStore = create<AnalysisState>((set, get) => ({
  gameId: null,
  running: false,
  progress: { done: 0, total: 0 },
  evals: [],
  judgments: [],
  accuracies: null,
  complete: false,
  chess960: false,
  error: null,

  load: (gameId, fens, playedUcis, chess960 = false) => {
    const rows = getAnalysis(gameId);
    const evals: (PositionEval | null)[] = new Array(fens.length).fill(null);
    for (const row of rows) {
      if (row.ply < fens.length) {
        evals[row.ply] = {
          fen: fens[row.ply],
          depth: row.depth,
          score: rowsToScore(row.cp, row.mate),
          bestUci: row.bestUci,
          pv: row.pv ? row.pv.split(' ') : [],
        };
      }
    }
    const complete = evals.length > 0 && evals.every((e) => e !== null);
    set({
      gameId,
      evals,
      judgments: complete ? computeJudgments(evals, playedUcis) : [],
      accuracies: complete ? gameAccuracy(evals.map((e) => e!.score)) : null,
      complete,
      chess960,
      running: false,
      progress: { done: 0, total: 0 },
      error: null,
    });
  },

  analyzeGame: async (gameId, fens, playedUcis) => {
    if (get().running) return;
    set({ running: true, error: null, progress: { done: 0, total: fens.length } });
    try {
      await initEngine();
      // Preempt live scrubbing evals: skip the queued ones and abandon the
      // in-flight one so the batch isn't head-blocked behind depth-18 searches.
      liveGeneration++;
      stopCurrentSearch();
      const evals: (PositionEval | null)[] = [...get().evals];
      const persist = () =>
        saveAnalysis(
          gameId,
          evals.flatMap((e, ply) =>
            e
              ? [{
                  ply,
                  depth: e.depth,
                  cp: e.score.cp ?? null,
                  mate: e.score.mate ?? null,
                  bestUci: e.bestUci,
                  pv: e.pv.join(' '),
                }]
              : []
          )
        );
      for (let ply = 0; ply < fens.length; ply++) {
        if (get().gameId !== gameId) return; // screen switched games
        set({ progress: { done: ply, total: fens.length } });
        if (!evals[ply] || evals[ply]!.depth < BATCH_DEPTH) {
          // Back off when the phone runs hot (2 = serious, 3 = critical).
          const depth = thermalState() >= 2 ? BATCH_DEPTH_HOT : BATCH_DEPTH;
          evals[ply] = await evalPosition(fens[ply], depth, undefined, get().chess960);
        }
        set({ evals: [...evals], progress: { done: ply + 1, total: fens.length } });
        // Persist as we go so leaving mid-analysis doesn't lose the work.
        if ((ply + 1) % SAVE_EVERY === 0) persist();
      }

      persist();
      set({
        judgments: computeJudgments(evals, playedUcis),
        accuracies: gameAccuracy(evals.map((e) => e!.score)),
        complete: true,
        running: false,
      });
    } catch (e) {
      set({ running: false, error: e instanceof Error ? e.message : String(e) });
    }
  },

  evalPly: async (ply, fen) => {
    const state = get();
    if (state.evals[ply] || state.running) return;
    const generation = liveGeneration;
    try {
      await initEngine();
      stopCurrentSearch(); // abandon any previous live search
      const result = await evalPosition(
        fen,
        LIVE_DEPTH,
        () => generation !== liveGeneration,
        state.chess960
      );
      const evals = [...get().evals];
      if (ply < evals.length && !evals[ply]) {
        evals[ply] = result;
        set({ evals });
      }
    } catch {
      // live eval is best-effort
    }
  },

  clear: () => {
    stopCurrentSearch();
    set({
      gameId: null,
      running: false,
      progress: { done: 0, total: 0 },
      evals: [],
      judgments: [],
      accuracies: null,
      complete: false,
      chess960: false,
      error: null,
    });
  },
}));
