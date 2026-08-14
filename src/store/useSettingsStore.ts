import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import Storage from 'expo-sqlite/kv-store';

interface SettingsState {
  /** How long a new position must stay stable before the move is recorded (ms). */
  moveConfirmMs: number;
  /** Commit a pending capture immediately when the opponent recaptures on the same square, instead of waiting out the confirmation delay. */
  allowTakeBack: boolean;
  /** Beep the board when a move gives check. */
  beepOnCheck: boolean;
  /** Buzz the board on connect, game start and flag fall. */
  boardSounds: boolean;
  setMoveConfirmMs: (ms: number) => void;
  setAllowTakeBack: (on: boolean) => void;
  setBeepOnCheck: (on: boolean) => void;
  setBoardSounds: (on: boolean) => void;
}

export const MOVE_CONFIRM_OPTIONS = [200, 400, 600, 800] as const;

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      moveConfirmMs: 400,
      allowTakeBack: true,
      beepOnCheck: true,
      boardSounds: true,
      setMoveConfirmMs: (moveConfirmMs) => set({ moveConfirmMs }),
      setAllowTakeBack: (allowTakeBack) => set({ allowTakeBack }),
      setBeepOnCheck: (beepOnCheck) => set({ beepOnCheck }),
      setBoardSounds: (boardSounds) => set({ boardSounds }),
    }),
    {
      name: 'settings',
      storage: createJSONStorage(() => Storage),
    }
  )
);
