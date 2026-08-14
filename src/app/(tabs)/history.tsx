import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { useCallback, useState } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Trophy, Minus, CircleDashed } from 'lucide-react-native';
import { GlassCard } from '../../components/ui/GlassCard';
import { fontFamily, fontSize, radius, spacing } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';
import { listGames, timeControlsOf, type GameRecord } from '../../db/games';
import { timeControlsLabel } from '../../chess/clock';
import { useIsActiveTab } from '../../hooks/useIsActiveTab';

const enter = (delay: number) => FadeInDown.delay(delay).springify().damping(18).stiffness(140);

function resultIcon(result: string, colors: Record<string, any>) {
  if (result === '1-0' || result === '0-1') return <Trophy size={18} color={colors.accent} strokeWidth={2} />;
  if (result === '1/2-1/2') return <Minus size={18} color={colors.textSecondary} strokeWidth={2} />;
  return <CircleDashed size={18} color={colors.textTertiary} strokeWidth={2} />;
}

export default function HistoryScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [games, setGames] = useState<GameRecord[]>([]);
  const isActive = useIsActiveTab();

  useFocusEffect(
    useCallback(() => {
      setGames(listGames());
    }, [])
  );

  if (!isActive) return <View style={styles.screen} />;

  return (
    <View style={styles.screen}>
      <FlatList
        data={games}
        keyExtractor={(g) => String(g.id)}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg, paddingBottom: 120 }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <Animated.View entering={enter(0)}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>History</Text>
          </Animated.View>
        }
        ListEmptyComponent={
          <Animated.View entering={enter(60)}>
            <GlassCard>
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No games yet</Text>
              <Text style={[styles.emptySub, { color: colors.textTertiary }]}>
                Games you play on the board are recorded here, ready to export to chess.com.
              </Text>
            </GlassCard>
          </Animated.View>
        }
        renderItem={({ item, index }) => (
          <Animated.View entering={enter(Math.min(index, 8) * 40 + 60)}>
            <TouchableOpacity activeOpacity={0.8} onPress={() => router.push(`/game/${item.id}`)}>
              <GlassCard padding={0}>
                <View style={styles.row}>
                  <View style={[styles.iconTile, { backgroundColor: item.result === '*' ? colors.neutralTileBg : colors.accentTint }]}>
                    {resultIcon(item.result, colors)}
                  </View>
                  <View style={styles.info}>
                    <Text style={[styles.players, { color: colors.textPrimary }]} numberOfLines={1}>
                      {item.white} vs {item.black}
                    </Text>
                    <Text style={[styles.meta, { color: colors.textTertiary }]}>
                      {new Date(item.startedAt).toLocaleDateString()} ·{' '}
                      {timeControlsLabel(timeControlsOf(item))} ·{' '}
                      {Math.ceil(item.moveCount / 2)} moves
                    </Text>
                  </View>
                  <Text style={[styles.result, { color: item.result === '*' ? colors.textTertiary : colors.accent }]}>
                    {item.result === '*' ? '—' : item.result}
                  </Text>
                </View>
              </GlassCard>
            </TouchableOpacity>
          </Animated.View>
        )}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
  },
  title: {
    fontSize: fontSize.display,
    fontFamily: fontFamily.display,
    letterSpacing: -1,
    marginBottom: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    gap: 2,
  },
  players: {
    fontSize: fontSize.base,
    fontFamily: fontFamily.semibold,
  },
  meta: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
  },
  result: {
    fontSize: fontSize.base,
    fontFamily: fontFamily.bold,
    fontVariant: ['tabular-nums'],
  },
  emptyTitle: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.semibold,
    marginBottom: spacing.xs,
  },
  emptySub: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    lineHeight: 18,
  },
});
