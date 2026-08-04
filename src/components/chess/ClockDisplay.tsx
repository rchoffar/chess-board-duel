import { View, Text, StyleSheet } from 'react-native';
import { fontFamily, fontSize, radius, spacing } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';
import { formatClock } from '../../chess/clock';

const LOW_TIME_MS = 30_000;

interface ClockDisplayProps {
  name: string;
  remainingMs: number;
  active: boolean;
  /** Rotated 180° so the player across the table reads their own clock. */
  flipped?: boolean;
}

export function ClockDisplay({ name, remainingMs, active, flipped = false }: ClockDisplayProps) {
  const { colors } = useTheme();
  const lowTime = remainingMs <= LOW_TIME_MS;
  const timeColor = lowTime ? colors.loss : active ? colors.accent : colors.textPrimary;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.neutralTileBg, borderColor: colors.hairline },
        active && { borderColor: colors.accent, backgroundColor: colors.accentTint },
        flipped && styles.flipped,
      ]}
    >
      <Text style={[styles.name, { color: colors.textSecondary }]} numberOfLines={1}>
        {name}
      </Text>
      <Text style={[styles.time, { color: timeColor }]} allowFontScaling={false}>
        {formatClock(remainingMs)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
  },
  flipped: {
    transform: [{ rotate: '180deg' }],
  },
  name: {
    flex: 1,
    fontSize: fontSize.base,
    fontFamily: fontFamily.semibold,
    marginRight: spacing.md,
  },
  time: {
    fontSize: fontSize['2xl'],
    fontFamily: fontFamily.bold,
    fontVariant: ['tabular-nums'],
  },
});
