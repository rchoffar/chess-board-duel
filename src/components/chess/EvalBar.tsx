import { useEffect } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';
import { fontFamily } from '../../design-system/theme';
import { formatBarScore, scoreToBarRatio, type Score } from '../../chess/evalUtils';

// Physical-object palette, matching the board.
const WHITE_FILL = '#F7F7F5';
const BLACK_FILL = '#1A1C22';

interface EvalBarProps {
  /** White-perspective score; null renders a neutral 50/50 bar. */
  score: Score | null;
}

export function EvalBar({ score }: EvalBarProps) {
  const reducedMotion = useReducedMotion();
  const ratio = score ? scoreToBarRatio(score) : 0.5;

  // Seeded at the current ratio so the bar doesn't sweep from 50% on mount.
  const fill = useSharedValue(ratio);
  useEffect(() => {
    fill.value = reducedMotion
      ? ratio
      : withTiming(ratio, { duration: 300, easing: Easing.out(Easing.cubic) });
  }, [ratio, reducedMotion, fill]);

  const fillStyle = useAnimatedStyle(() => ({
    height: `${fill.value * 100}%`,
  }));

  // The winning side's end of the bar always sits on that side's fill,
  // so the label color contrast holds by construction.
  const whiteAhead = ratio >= 0.5;

  return (
    <View style={styles.bar}>
      <Animated.View style={[styles.white, fillStyle]} />
      {score && (
        <Text
          style={[
            styles.label,
            whiteAhead ? styles.labelBottom : styles.labelTop,
            { color: whiteAhead ? BLACK_FILL : WHITE_FILL },
          ]}
          allowFontScaling={false}
        >
          {formatBarScore(score)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    width: 24,
    alignSelf: 'stretch',
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: BLACK_FILL,
  },
  white: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: WHITE_FILL,
  },
  label: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 9,
    fontFamily: fontFamily.bold,
    fontVariant: ['tabular-nums'],
  },
  labelBottom: {
    bottom: 3,
  },
  labelTop: {
    top: 3,
  },
});
