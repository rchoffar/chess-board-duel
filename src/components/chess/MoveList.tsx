import { ScrollView, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useEffect, useRef } from 'react';
import { fontFamily, fontSize, radius, spacing } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';
import type { RecordedMove } from '../../store/useGameStore';
import { JUDGMENT_META, type Judgment } from '../../chess/judgment';

interface MoveListProps {
  moves: Pick<RecordedMove, 'san'>[];
  /** Auto-scroll to the latest move (for the live game screen). */
  follow?: boolean;
  /** 0-based ply index of the highlighted move (replay mode). */
  selectedIndex?: number;
  /** Tap a move to jump to it (replay mode). Receives the 0-based ply index. */
  onSelectMove?: (index: number) => void;
  /** Engine judgments per move (analysis mode). */
  judgments?: Judgment[];
}

export function MoveList({ moves, follow = false, selectedIndex, onSelectMove, judgments }: MoveListProps) {
  const { colors } = useTheme();
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (follow && moves.length > 0) {
      scrollRef.current?.scrollToEnd({ animated: true });
    }
  }, [follow, moves.length]);

  const rows: { number: number; whiteIndex: number }[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    rows.push({ number: i / 2 + 1, whiteIndex: i });
  }

  const renderSan = (index: number) => {
    const move = moves[index];
    if (!move) return <View style={styles.san} />;
    const selected = selectedIndex === index;
    const judgment = judgments?.[index];
    const meta = judgment ? JUDGMENT_META[judgment] : null;
    const text = (
      <Text
        style={[
          styles.sanText,
          { color: selected ? colors.accent : index % 2 === 0 ? colors.textPrimary : colors.textSecondary },
          selected && styles.sanTextSelected,
        ]}
      >
        {move.san}
        {meta && <Text style={[styles.judgment, { color: meta.color }]}> {meta.glyph}</Text>}
      </Text>
    );
    if (!onSelectMove) return <View style={styles.san}>{text}</View>;
    return (
      <TouchableOpacity
        style={[styles.san, selected && { backgroundColor: colors.accentTint, borderRadius: radius.sm }]}
        onPress={() => onSelectMove(index)}
        activeOpacity={0.7}
      >
        {text}
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false}>
      {rows.length === 0 && (
        <Text style={[styles.empty, { color: colors.textTertiary }]}>No moves yet</Text>
      )}
      {rows.map((row) => (
        <View key={row.number} style={styles.row}>
          <Text style={[styles.number, { color: colors.textTertiary }]}>{row.number}.</Text>
          {renderSan(row.whiteIndex)}
          {renderSan(row.whiteIndex + 1)}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
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
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  sanText: {
    fontSize: fontSize.base,
    fontFamily: fontFamily.semibold,
    fontVariant: ['tabular-nums'],
  },
  sanTextSelected: {
    fontFamily: fontFamily.bold,
  },
  judgment: {
    fontFamily: fontFamily.extrabold,
  },
  empty: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    paddingVertical: spacing.sm,
  },
});
