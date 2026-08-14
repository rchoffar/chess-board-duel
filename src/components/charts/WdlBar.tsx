import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';
import { fontFamily, fontSize, spacing } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';

interface WdlBarProps {
  wins: number;
  draws: number;
  losses: number;
  height?: number;
  /** Counts under the bar ("4W · 1D · 2L" with color dots). */
  showLegend?: boolean;
  /** 'dark' when the bar sits on a dark glass card. */
  tone?: 'light' | 'dark';
}

/** Stacked win/draw/loss bar. Renders nothing with zero games. */
export function WdlBar({ wins, draws, losses, height = 10, showLegend = true, tone = 'light' }: WdlBarProps) {
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  const total = wins + draws + losses;

  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = reducedMotion
      ? 1
      : withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) });
  }, [reducedMotion, progress]);

  const trackStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  if (total === 0) return null;

  const segments = [
    { key: 'w', count: wins, color: colors.accent },
    { key: 'd', count: draws, color: colors.neutralChart },
    { key: 'l', count: losses, color: colors.loss },
  ].filter((s) => s.count > 0);

  const legend = [
    { key: 'w', label: `${wins}W`, color: colors.accent },
    { key: 'd', label: `${draws}D`, color: colors.neutralChart },
    { key: 'l', label: `${losses}L`, color: colors.loss },
  ];

  return (
    <View style={styles.wrap}>
      <View style={{ height }}>
        <Animated.View style={[styles.track, trackStyle]}>
          {segments.map((s) => (
            <View key={s.key} style={[styles.segment, { flex: s.count, backgroundColor: s.color }]} />
          ))}
        </Animated.View>
      </View>
      {showLegend && (
        <View style={styles.legend}>
          {legend.map((item) => (
            <View key={item.key} style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: item.color }]} />
              <Text
                style={[
                  styles.legendText,
                  { color: tone === 'dark' ? colors.onDarkSecondary : colors.textSecondary },
                ]}
              >
                {item.label}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  track: {
    height: '100%',
    flexDirection: 'row',
    gap: 2,
  },
  segment: {
    borderRadius: 3,
  },
  legend: {
    flexDirection: 'row',
    gap: spacing.base,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.semibold,
    fontVariant: ['tabular-nums'],
  },
});
