import { View, Text, StyleSheet } from 'react-native';
import { fontFamily, fontSize, radius, spacing } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';
import { formatClock } from '../../chess/clock';
import { PlayerAvatar } from '../players/PlayerAvatar';

const LOW_TIME_MS = 30_000;

interface ClockDisplayProps {
  name: string;
  remainingMs: number;
  active: boolean;
  /** Side's own time control label, e.g. "10+5" — shown under the name. */
  subtitle?: string;
  /** Rotated 180° so the player across the table reads their own clock. */
  flipped?: boolean;
}

export function ClockDisplay({
  name,
  remainingMs,
  active,
  subtitle,
  flipped = false,
}: ClockDisplayProps) {
  const { colors } = useTheme();
  const lowTime = remainingMs <= LOW_TIME_MS;
  const timeColor = lowTime ? colors.loss : active ? colors.accent : colors.textPrimary;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.neutralTileBg, borderColor: colors.hairline },
        active && { borderColor: colors.accent, backgroundColor: colors.accentTint },
        // The whole row rotates as a unit, so avatar, name and time all read
        // correctly for the player across the table.
        flipped && styles.flipped,
      ]}
    >
      <PlayerAvatar name={name} size={36} />
      <View style={styles.identity}>
        <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
          {name}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
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
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.base,
  },
  flipped: {
    transform: [{ rotate: '180deg' }],
  },
  identity: {
    flex: 1,
    gap: 1,
  },
  name: {
    fontSize: fontSize.lg,
    fontFamily: fontFamily.bold,
  },
  subtitle: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.medium,
    fontVariant: ['tabular-nums'],
  },
  time: {
    fontSize: fontSize['2xl'],
    fontFamily: fontFamily.bold,
    fontVariant: ['tabular-nums'],
  },
});
