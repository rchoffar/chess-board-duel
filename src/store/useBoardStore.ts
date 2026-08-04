import { create } from 'zustand';
import { ChessnutBoard, type BoardStatus } from '../ble/ChessnutBoard';
import type { BatteryStatus, Occupancy } from '../ble/protocol';

type FrameListener = (occupancy: Occupancy, receivedAt: number) => void;

interface BoardState {
  status: BoardStatus;
  deviceName: string | null;
  battery: BatteryStatus | null;
  error: string | null;
  /** Latest physical position seen, kept even while no game is running. */
  lastOccupancy: Occupancy | null;

  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  setLeds: (squares: string[]) => void;
  beep: (frequency?: number, durationMs?: number) => void;
  /** Live board frames for the game engine. Returns an unsubscribe function. */
  subscribeFrames: (listener: FrameListener) => () => void;
}

const frameListeners = new Set<FrameListener>();

let board: ChessnutBoard;

export const useBoardStore = create<BoardState>((set, get) => {
  board = new ChessnutBoard({
    onStatus: (status, deviceName) =>
      set({ status, deviceName: deviceName ?? (status === 'idle' ? null : get().deviceName) }),
    onFrame: (occupancy, receivedAt) => {
      set({ lastOccupancy: occupancy });
      for (const listener of frameListeners) listener(occupancy, receivedAt);
    },
    onBattery: (battery) => set({ battery }),
    onError: (error) => set({ error }),
  });

  return {
    status: 'idle',
    deviceName: null,
    battery: null,
    error: null,
    lastOccupancy: null,

    connect: async () => {
      set({ error: null });
      try {
        await board.connect();
      } catch (e) {
        set({ error: e instanceof Error ? e.message : String(e) });
        throw e;
      }
    },

    disconnect: () => board.disconnect(),
    setLeds: (squares) => board.setLeds(squares),
    beep: (frequency, durationMs) => void board.beep(frequency, durationMs),

    subscribeFrames: (listener) => {
      frameListeners.add(listener);
      return () => frameListeners.delete(listener);
    },
  };
});
