import { View, Text, StyleSheet } from 'react-native';
import { useMemo } from 'react';
import { fontFamily } from '../../design-system/theme';
import { squareIndex } from '../../ble/protocol';

// The board must read as a physical object regardless of the app theme
// (same principle as proker's playing-card tokens) — warm wood tones.
const LIGHT_SQUARE = '#E8DCC7';
const DARK_SQUARE = '#A98862';
const LAST_MOVE_TINT = 'rgba(23, 229, 138, 0.38)';
const ILLEGAL_TINT = 'rgba(229, 72, 77, 0.55)';
const COORD_ON_LIGHT = 'rgba(90, 70, 50, 0.55)';
const COORD_ON_DARK = 'rgba(255, 248, 235, 0.55)';

const GLYPHS: Record<string, string> = {
  k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟',
};

interface Piece {
  glyph: string;
  isWhite: boolean;
}

/** piece placement field of a FEN → 64-array indexed a1..h8 */
function piecesFromFen(fen: string): (Piece | null)[] {
  const out: (Piece | null)[] = new Array(64).fill(null);
  const placement = fen.split(' ')[0];
  let rank = 7;
  let file = 0;
  for (const ch of placement) {
    if (ch === '/') {
      rank--;
      file = 0;
    } else if (ch >= '1' && ch <= '8') {
      file += Number(ch);
    } else {
      out[rank * 8 + file] = {
        glyph: GLYPHS[ch.toLowerCase()],
        isWhite: ch === ch.toUpperCase(),
      };
      file++;
    }
  }
  return out;
}

interface ChessboardViewProps {
  fen: string;
  /** Highlighted as the last move (from/to squares). */
  lastMove?: { from: string; to: string } | null;
  /** Squares lit red (wrong position / setup mismatches). */
  errorSquares?: string[];
}

export function ChessboardView({ fen, lastMove, errorSquares = [] }: ChessboardViewProps) {
  const pieces = useMemo(() => piecesFromFen(fen), [fen]);
  const errorSet = useMemo(() => new Set(errorSquares.map(squareIndex)), [errorSquares]);
  const lastMoveSet = useMemo(
    () => new Set(lastMove ? [squareIndex(lastMove.from), squareIndex(lastMove.to)] : []),
    [lastMove]
  );

  // Render ranks 8 -> 1 (white at the bottom).
  const ranks = [7, 6, 5, 4, 3, 2, 1, 0];
  const files = [0, 1, 2, 3, 4, 5, 6, 7];

  return (
    <View style={styles.board}>
      {ranks.map((rank) => (
        <View key={rank} style={styles.rank}>
          {files.map((file) => {
            const index = rank * 8 + file;
            const isLight = (rank + file) % 2 === 1;
            const piece = pieces[index];
            return (
              <View
                key={file}
                style={[styles.square, { backgroundColor: isLight ? LIGHT_SQUARE : DARK_SQUARE }]}
              >
                {lastMoveSet.has(index) && <View style={[styles.overlay, { backgroundColor: LAST_MOVE_TINT }]} />}
                {errorSet.has(index) && <View style={[styles.overlay, { backgroundColor: ILLEGAL_TINT }]} />}
                {file === 0 && (
                  <Text style={[styles.coord, styles.rankCoord, { color: isLight ? COORD_ON_LIGHT : COORD_ON_DARK }]}>
                    {rank + 1}
                  </Text>
                )}
                {rank === 0 && (
                  <Text style={[styles.coord, styles.fileCoord, { color: isLight ? COORD_ON_LIGHT : COORD_ON_DARK }]}>
                    {'abcdefgh'[file]}
                  </Text>
                )}
                {piece && (
                  <Text
                    style={[
                      styles.piece,
                      piece.isWhite ? styles.whitePiece : styles.blackPiece,
                    ]}
                    allowFontScaling={false}
                  >
                    {piece.glyph}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  board: {
    aspectRatio: 1,
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  rank: {
    flex: 1,
    flexDirection: 'row',
  },
  square: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  piece: {
    fontSize: 26,
    lineHeight: 32,
  },
  whitePiece: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(20, 22, 32, 0.85)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  blackPiece: {
    color: '#1A1C22',
    textShadowColor: 'rgba(255, 255, 255, 0.25)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  coord: {
    position: 'absolute',
    fontSize: 8,
    fontFamily: fontFamily.semibold,
  },
  rankCoord: {
    top: 2,
    left: 3,
  },
  fileCoord: {
    bottom: 2,
    right: 3,
  },
});
