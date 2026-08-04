# Chessnut Local

iOS-first Expo app that turns a Chessnut Air+ electronic chess board into a local two-player game station: chess clock, move validation with LED feedback, and PGN recording/export (chess.com-compatible).

## Commands

- `npm test` — jest unit tests (protocol codec, move detection, clock, PGN)
- `npm run typecheck` — `tsc --noEmit`
- `npx expo run:ios --device` — dev build on a real iPhone (**required**: BLE does not work in Expo Go or the simulator)

## Architecture

- `src/app/` — expo-router routes. Root layout mounts fonts + `EnvironmentBackground` exactly ONCE; every screen must keep a transparent background or the environment won't show through.
- `src/ble/protocol.ts` — pure Chessnut byte codec (board frames, LED commands, battery). No BLE imports; fully unit-tested. Board frames encode 64 squares × 4-bit piece codes, wire order h8→a1, low nibble first.
- `src/ble/ChessnutBoard.ts` — BLE transport (react-native-ble-plx): scan by name "Chessnut", subscribe to both notify characteristics, write `21 01 00` to enable real-time mode. LED writes throttled to ≥200 ms.
- `src/chess/MoveDetector.ts` — the core: the board reports occupancy, not moves. Diffs each frame against a chess.js instance; a position reachable by exactly one legal move is that move; a stable unexplained position (500 ms debounce) is illegal → LEDs light the mismatched squares and the clock does not switch.
- `src/chess/clock.ts` — pure Fischer clock (`remainingMs` + `turnStartedAt`, no tick drift).
- `src/store/` — zustand: `useBoardStore` (connection, battery, frame fan-out), `useGameStore` (setup → playing → finished orchestration, autosaves PGN to sqlite on every move).
- `src/db/games.ts` — expo-sqlite repository.
- `src/design-system/` + `src/components/ui/` — ported from the proker app (`/Users/remy/Perso/proker`), dark scheme only. Styling idiom: static tokens imported into `StyleSheet.create`, only `colors` via `useTheme()` inline.

## Conventions

- Keep protocol/game logic pure and unit-tested; side effects (BLE, sqlite, haptics) live in stores.
- Numbers use `fontVariant: ['tabular-nums']` (clocks, results, move lists).
- Buttons are inline `TouchableOpacity`: primary = `colors.accentBright` background + `#0A0A0F` text, radius 16.
