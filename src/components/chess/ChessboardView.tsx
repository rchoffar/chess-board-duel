import { View, Text, StyleSheet, type LayoutChangeEvent } from 'react-native';
import { useEffect, useMemo, useState, useCallback } from 'react';
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  useReducedMotion,
  runOnJS,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { G, Path, Polygon } from 'react-native-svg';
import { SvgCss } from 'react-native-svg/css';
import { fontFamily } from '../../design-system/theme';
import { squareIndex } from '../../ble/protocol';
import { PIECE_SVGS } from './pieceSvgs';
import { JUDGMENT_META, type Judgment } from '../../chess/judgment';
import { buildArrow, squareTopLeft } from './arrowGeometry';
import type { AnimationSegment, MoveAnimationSpec } from '../../chess/moveAnimation';

// The board must read as a physical object regardless of the app theme
// (same principle as proker's playing-card tokens) — warm wood tones.
const LIGHT_SQUARE = '#E8DCC7';
const DARK_SQUARE = '#A98862';
const LAST_MOVE_TINT = 'rgba(23, 229, 138, 0.38)';
const ILLEGAL_TINT = 'rgba(229, 72, 77, 0.55)';
const COORD_ON_LIGHT = 'rgba(90, 70, 50, 0.55)';
const COORD_ON_DARK = 'rgba(255, 248, 235, 0.55)';
// Same green as the "best" judgment badge — semantically the best move.
const ARROW_COLOR = JUDGMENT_META.best.color;

/** piece placement field of a FEN → 64-array indexed a1..h8 of FEN piece letters */
function piecesFromFen(fen: string): (string | null)[] {
  const out: (string | null)[] = new Array(64).fill(null);
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
      out[rank * 8 + file] = ch;
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
  /** Judgment badge on a square (game review), chess.com style. */
  badge?: { square: string; judgment: Judgment } | null;
  /** Which color is drawn at the bottom edge (default white). */
  orientation?: 'white' | 'black';
  /** Engine best move, drawn as an arrow (L-shaped for knights). */
  arrow?: { from: string; to: string } | null;
  /** Slide these pieces into place (replay stepping). Omit for a static board. */
  animateMove?: MoveAnimationSpec | null;
}

/** One piece sliding from seg.from to seg.to, driven by the shared progress. */
function FloatingPiece({
  seg,
  squareSize,
  orientation,
  progress,
}: {
  seg: AnimationSegment;
  squareSize: number;
  orientation: 'white' | 'black';
  progress: SharedValue<number>;
}) {
  const from = squareTopLeft(seg.from, squareSize, orientation);
  const to = squareTopLeft(seg.to, squareSize, orientation);
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: (to.x - from.x) * progress.value },
      { translateY: (to.y - from.y) * progress.value },
    ],
  }));
  const pieceSize = squareSize * 0.92;
  return (
    <Animated.View
      style={[
        styles.floatingPiece,
        { left: from.x, top: from.y, width: squareSize, height: squareSize },
        style,
      ]}
    >
      <SvgCss key={seg.piece} xml={PIECE_SVGS[seg.piece]} width={pieceSize} height={pieceSize} />
    </Animated.View>
  );
}

export function ChessboardView({
  fen,
  lastMove,
  errorSquares = [],
  badge,
  orientation = 'white',
  arrow,
  animateMove,
}: ChessboardViewProps) {
  const pieces = useMemo(() => piecesFromFen(fen), [fen]);
  const errorSet = useMemo(() => new Set(errorSquares.map(squareIndex)), [errorSquares]);
  const lastMoveSet = useMemo(
    () => new Set(lastMove ? [squareIndex(lastMove.from), squareIndex(lastMove.to)] : []),
    [lastMove]
  );

  const [squareSize, setSquareSize] = useState(0);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    setSquareSize(event.nativeEvent.layout.width / 8);
  }, []);
  const pieceSize = squareSize * 0.92;

  const reducedMotion = useReducedMotion();
  const [activeAnim, setActiveAnim] = useState<MoveAnimationSpec | null>(null);
  const progress = useSharedValue(1);

  const finishAnim = useCallback((key: number) => {
    // Only clear if a faster step hasn't already replaced this run.
    setActiveAnim((current) => (current?.key === key ? null : current));
  }, []);

  const animKey = animateMove?.key;
  useEffect(() => {
    if (!animateMove || animKey === undefined || reducedMotion || squareSize <= 0) {
      setActiveAnim(null);
      return;
    }
    setActiveAnim(animateMove);
    progress.value = 0;
    progress.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.cubic) }, (finished) => {
      if (finished) runOnJS(finishAnim)(animKey);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animKey, reducedMotion, squareSize > 0]);

  // Landing squares stay empty in the grid while the floating copies slide in.
  const hiddenSquares = useMemo(
    () => new Set(activeAnim?.segments.map((s) => squareIndex(s.to)) ?? []),
    [activeAnim]
  );

  const arrowSpec = useMemo(
    () => (arrow && squareSize > 0 ? buildArrow(arrow.from, arrow.to, squareSize, orientation) : null),
    [arrow, squareSize, orientation]
  );

  // Row/column render order, top-left square first.
  const ranks = orientation === 'white' ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  const files = orientation === 'white' ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];

  return (
    <View style={styles.board} onLayout={onLayout}>
      {ranks.map((rank) => (
        <View key={rank} style={styles.rank}>
          {files.map((file) => {
            const index = rank * 8 + file;
            const isLight = (rank + file) % 2 === 1;
            const piece = pieces[index];
            const hasBadge = badge != null && squareIndex(badge.square) === index;
            return (
              <View
                key={file}
                style={[
                  styles.square,
                  { backgroundColor: isLight ? LIGHT_SQUARE : DARK_SQUARE },
                  // let the badge overflow above neighbouring squares
                  hasBadge && { zIndex: 1 },
                ]}
              >
                {lastMoveSet.has(index) && <View style={[styles.overlay, { backgroundColor: LAST_MOVE_TINT }]} />}
                {errorSet.has(index) && <View style={[styles.overlay, { backgroundColor: ILLEGAL_TINT }]} />}
                {file === files[0] && (
                  <Text style={[styles.coord, styles.rankCoord, { color: isLight ? COORD_ON_LIGHT : COORD_ON_DARK }]}>
                    {rank + 1}
                  </Text>
                )}
                {rank === ranks[7] && (
                  <Text style={[styles.coord, styles.fileCoord, { color: isLight ? COORD_ON_LIGHT : COORD_ON_DARK }]}>
                    {'abcdefgh'[file]}
                  </Text>
                )}
                {piece && pieceSize > 0 && !hiddenSquares.has(index) && (
                  // key forces a remount when the piece on this square changes:
                  // SvgCss does not reliably re-apply styles when only `xml` changes,
                  // which left captured squares showing the capturing piece in the
                  // captured piece's color.
                  <SvgCss key={piece} xml={PIECE_SVGS[piece]} width={pieceSize} height={pieceSize} />
                )}
                {badge && squareSize > 0 && hasBadge && (
                  <View
                    style={[
                      styles.badge,
                      {
                        width: squareSize * 0.42,
                        height: squareSize * 0.42,
                        borderRadius: squareSize * 0.21,
                        top: -squareSize * 0.08,
                        right: -squareSize * 0.06,
                        backgroundColor: JUDGMENT_META[badge.judgment].color,
                      },
                    ]}
                  >
                    <Text
                      style={[styles.badgeGlyph, { fontSize: squareSize * 0.2 }]}
                      allowFontScaling={false}
                    >
                      {JUDGMENT_META[badge.judgment].glyph}
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      ))}
      {arrow && arrowSpec && (
        <Animated.View
          key={`${arrow.from}${arrow.to}`}
          entering={FadeIn.duration(150)}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        >
          <Svg width={squareSize * 8} height={squareSize * 8}>
            {/* Group opacity so the shaft/head overlap doesn't double-darken. */}
            <G opacity={0.75}>
              <Path
                d={arrowSpec.shaft}
                stroke={ARROW_COLOR}
                strokeWidth={0.22 * squareSize}
                strokeLinejoin="round"
                strokeLinecap="butt"
                fill="none"
              />
              <Polygon points={arrowSpec.head} fill={ARROW_COLOR} />
            </G>
          </Svg>
        </Animated.View>
      )}
      {activeAnim && squareSize > 0 && (
        <View style={[StyleSheet.absoluteFill, styles.floatingLayer]} pointerEvents="none">
          {activeAnim.segments.map((seg) => (
            <FloatingPiece
              key={`${activeAnim.key}:${seg.to}`}
              seg={seg}
              squareSize={squareSize}
              orientation={orientation}
              progress={progress}
            />
          ))}
        </View>
      )}
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
  floatingLayer: {
    zIndex: 3,
  },
  floatingPiece: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.35,
    shadowRadius: 2,
    elevation: 3,
  },
  badgeGlyph: {
    color: '#FFFFFF',
    fontFamily: fontFamily.extrabold,
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
