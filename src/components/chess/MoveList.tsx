import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { useEffect, useRef } from 'react';
import { fontFamily, fontSize, spacing } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';
import type { RecordedMove } from '../../store/useGameStore';

interface MoveListProps {
  moves: Pick<RecordedMove, 'san'>[];
  /** Auto-scroll to the latest move (for the live game screen). */
  follow?: boolean;
}

export function MoveList({ moves, follow = false }: MoveListProps) {
  const { colors } = useTheme();
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (follow && moves.length > 0) {
      scrollRef.current?.scrollToEnd({ animated: true });
    }
  }, [follow, moves.length]);

  const rows: { number: number; white?: string; black?: string }[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    rows.push({ number: i / 2 + 1, white: moves[i]?.san, black: moves[i + 1]?.san });
  }

  return (
    <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false}>
      {rows.length === 0 && (
        <Text style={[styles.empty, { color: colors.textTertiary }]}>No moves yet</Text>
      )}
      {rows.map((row) => (
        <View key={row.number} style={styles.row}>
          <Text style={[styles.number, { color: colors.textTertiary }]}>{row.number}.</Text>
          <Text style={[styles.san, { color: colors.textPrimary }]}>{row.white ?? ''}</Text>
          <Text style={[styles.san, { color: colors.textSecondary }]}>{row.black ?? ''}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    gap: spacing.md,
  },
  number: {
    width: 28,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
    fontVariant: ['tabular-nums'],
  },
  san: {
    flex: 1,
    fontSize: fontSize.base,
    fontFamily: fontFamily.semibold,
    fontVariant: ['tabular-nums'],
  },
  empty: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    paddingVertical: spacing.sm,
  },
});
