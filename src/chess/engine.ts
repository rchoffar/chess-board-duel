import {
  startEngine,
  stopEngine,
  sendCommand,
  addOutputListener,
  getProcessStats,
  isRunning,
  parseInfoLine,
  parseBestMove,
} from '@og-nav/expo-stockfish';
import { toWhitePerspective, terminalScore, type Score } from './evalUtils';

export interface PositionEval {
  fen: string;
  depth: number;
  /** White-perspective score. */
  score: Score;
  /** Engine best move (UCI), null for game-over positions. */
  bestUci: string | null;
  /** Principal variation, UCI moves. */
  pv: string[];
}

const EVAL_TIMEOUT_MS = 60_000;

/** Thrown when a queued eval is cancelled before its search starts. */
export class EvalCancelledError extends Error {
  constructor() {
    super('Evaluation cancelled');
    this.name = 'EvalCancelledError';
  }
}

let started = false;
// Mirrors the engine's UCI_Chess960 option so it's only sent on change.
let chess960Mode = false;
// Single-flight: concurrent initEngine callers share one promise. A second
// native start() while the first is booting restarts the engine and drops
// queued commands, orphaning any in-flight `go`.
let initPromise: Promise<void> | null = null;
// The native engine is a singleton and searches must never overlap — all
// evalPosition calls are serialized through this promise chain.
let queue: Promise<unknown> = Promise.resolve();

export function initEngine(): Promise<void> {
  if (started && isRunning()) return Promise.resolve();
  if (!initPromise) {
    initPromise = (async () => {
      await startEngine();
      sendCommand('setoption name Threads value 2'); // leave headroom for BLE + UI
      sendCommand('setoption name Hash value 64');
      sendCommand('isready');
      started = true;
      chess960Mode = false; // engine default
    })().catch((e) => {
      initPromise = null;
      throw e;
    });
  }
  return initPromise;
}

export async function shutdownEngine(): Promise<void> {
  if (!started && !initPromise) return;
  started = false;
  chess960Mode = false;
  initPromise = null;
  await stopEngine().catch(() => {});
}

/** Ask the engine to abandon the current search (it still reports a bestmove). */
export function stopCurrentSearch(): void {
  if (started) sendCommand('stop');
}

/** Thermal state: 0=nominal, 1=fair, 2=serious, 3=critical. */
export function thermalState(): number {
  try {
    return getProcessStats().thermalState;
  } catch {
    return 0;
  }
}

/**
 * Evaluate one position to a fixed depth. Serialized: concurrent callers wait.
 * If `isCancelled` returns true by the time this call's turn arrives, the
 * search is skipped and the promise rejects with EvalCancelledError.
 */
export function evalPosition(
  fen: string,
  depth = 16,
  isCancelled?: () => boolean,
  chess960 = false
): Promise<PositionEval> {
  const run = queue.then(() => {
    if (isCancelled?.()) throw new EvalCancelledError();
    return evalPositionNow(fen, depth, chess960);
  });
  // Keep the chain alive even if a caller's eval fails.
  queue = run.catch(() => {});
  return run;
}

function evalPositionNow(fen: string, depth: number, chess960: boolean): Promise<PositionEval> {
  // Engine prints `bestmove (none)` on finished positions — synthesize instead.
  const terminal = terminalScore(fen);
  if (terminal) {
    return Promise.resolve({ fen, depth, score: terminal, bestUci: null, pv: [] });
  }
  if (!started) return Promise.reject(new Error('Engine not started'));

  const sideToMove = fen.split(' ')[1] === 'b' ? 'b' : 'w';

  return new Promise<PositionEval>((resolve, reject) => {
    let lastInfo: ReturnType<typeof parseInfoLine> = null;

    const timeout = setTimeout(() => {
      subscription.remove();
      reject(new Error(`Engine timed out on ${fen}`));
    }, EVAL_TIMEOUT_MS);

    const subscription = addOutputListener((line: string) => {
      if (line.startsWith('info ')) {
        const info = parseInfoLine(line);
        // Only keep scored main-line infos (multipv 1 or absent).
        if (info && (info.scoreCp !== undefined || info.scoreMate !== undefined) && (info.multipv ?? 1) === 1) {
          lastInfo = info;
        }
        return;
      }
      if (line.startsWith('bestmove')) {
        clearTimeout(timeout);
        subscription.remove();
        const best = parseBestMove(line);
        const raw: Score =
          lastInfo?.scoreMate !== undefined
            ? { mate: lastInfo.scoreMate }
            : { cp: lastInfo?.scoreCp ?? 0 };
        resolve({
          fen,
          depth: lastInfo?.depth ?? depth,
          score: toWhitePerspective(raw, sideToMove),
          bestUci: best?.uci ?? null,
          pv: lastInfo?.pv ?? [],
        });
      }
    });

    if (chess960 !== chess960Mode) {
      // Inside the serialized eval, so it can't race another search.
      sendCommand(`setoption name UCI_Chess960 value ${chess960}`);
      chess960Mode = chess960;
    }
    sendCommand(`position fen ${fen}`);
    sendCommand(`go depth ${depth}`);
  });
}
