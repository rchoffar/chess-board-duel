import { View, Text, StyleSheet } from 'react-native';
import { fontFamily, fontSize, spacing } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';
import type { Outcome } from '../../chess/stats';

interface FormDotsProps {
  /** Outcomes oldest → newest (see PlayerStats.form). */
  form: Outcome[];
  size?: number;
}

/** Recent-form chips (W/D/L letters, colored by outcome), newest on the right. */
export function FormDots({ form, size = 24 }: FormDotsProps) {
  const { colors } = useTheme();

  const styleFor = (outcome: Outcome) => {
    if (outcome === 'W') return { color: colors.accent, backgroundColor: colors.accentTint };
    if (outcome === 'L') return { color: colors.loss, backgroundColor: `${colors.loss}24` };
    return { color: colors.textSecondary, backgroundColor: colors.neutralTileBg };
  };

  return (
    <View style={styles.row}>
      {form.map((outcome, i) => {
        const s = styleFor(outcome);
        return (
          <View
            key={i}
            style={[styles.chip, { width: size, height: size, borderRadius: size / 3, backgroundColor: s.backgroundColor }]}
          >
            <Text style={[styles.letter, { color: s.color }]}>{outcome}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm - 2,
  },
  chip: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.bold,
  },
});
