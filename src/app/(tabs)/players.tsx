import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput } from 'react-native';
import { useCallback, useState } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Plus, Check, ChevronRight } from 'lucide-react-native';
import { GlassCard } from '../../components/ui/GlassCard';
import { PlayerAvatar } from '../../components/players/PlayerAvatar';
import { fontFamily, fontSize, radius, spacing } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';
import { createPlayer, listPlayersWithRecord, type PlayerWithRecord } from '../../db/players';
import { useIsActiveTab } from '../../hooks/useIsActiveTab';

const enter = (delay: number) => FadeInDown.delay(delay).springify().damping(18).stiffness(140);

export default function PlayersScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [players, setPlayers] = useState<PlayerWithRecord[]>([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  const isActive = useIsActiveTab();
  const reload = useCallback(() => setPlayers(listPlayersWithRecord()), []);
  useFocusEffect(reload);

  const submit = () => {
    if (createPlayer(name)) {
      setName('');
      setCreating(false);
      reload();
    }
  };

  if (!isActive) return <View style={styles.screen} />;

  return (
    <View style={styles.screen}>
      <FlatList
        data={players}
        keyExtractor={(p) => String(p.id)}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg, paddingBottom: 120 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <Animated.View entering={enter(0)}>
            <View style={styles.headerRow}>
              <Text style={[styles.title, { color: colors.textPrimary }]}>Players</Text>
              <TouchableOpacity
                style={[styles.addBtn, { backgroundColor: creating ? colors.accentTint : colors.neutralTileBg }]}
                onPress={() => setCreating((v) => !v)}
                activeOpacity={0.7}
              >
                <Plus size={20} color={creating ? colors.accent : colors.textSecondary} strokeWidth={2} />
              </TouchableOpacity>
            </View>
            {creating && (
              <View style={styles.createRow}>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: colors.surface.fieldBg,
                      borderColor: colors.surface.fieldBorder,
                      color: colors.textPrimary,
                    },
                  ]}
                  placeholder="Player name"
                  placeholderTextColor={colors.textTertiary}
                  value={name}
                  onChangeText={setName}
                  onSubmitEditing={submit}
                  returnKeyType="done"
                  autoFocus
                />
                <TouchableOpacity
                  style={[styles.confirmBtn, { backgroundColor: colors.accentBright }, !name.trim() && styles.confirmBtnDisabled]}
                  onPress={submit}
                  disabled={!name.trim()}
                  activeOpacity={0.85}
                >
                  <Check size={18} color="#0A0A0F" strokeWidth={2.5} />
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>
        }
        ListEmptyComponent={
          <Animated.View entering={enter(60)}>
            <GlassCard>
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No players yet</Text>
              <Text style={[styles.emptySub, { color: colors.textTertiary }]}>
                Create profiles to track win rates, head-to-head records and form over time.
              </Text>
            </GlassCard>
          </Animated.View>
        }
        renderItem={({ item, index }) => {
          const winPct = item.games > 0 ? Math.round((item.wins / item.games) * 100) : null;
          return (
            <Animated.View entering={enter(Math.min(index, 8) * 40 + 60)}>
              <TouchableOpacity activeOpacity={0.8} onPress={() => router.push(`/player/${item.id}`)}>
                <GlassCard padding={0}>
                  <View style={styles.row}>
                    <PlayerAvatar name={item.name} />
                    <View style={styles.info}>
                      <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={[styles.meta, { color: colors.textTertiary }]}>
                        {item.games === 0
                          ? 'No games yet'
                          : `${item.games} game${item.games > 1 ? 's' : ''} · ${item.wins}W ${item.draws}D ${item.losses}L`}
                      </Text>
                    </View>
                    {winPct != null && (
                      <Text style={[styles.winPct, { color: colors.accent }]}>{winPct}%</Text>
                    )}
                    <ChevronRight size={18} color={colors.textTertiary} strokeWidth={2} />
                  </View>
                </GlassCard>
              </TouchableOpacity>
            </Animated.View>
          );
        }}
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: fontSize.display,
    fontFamily: fontFamily.display,
    letterSpacing: -1,
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    fontSize: fontSize.md,
    fontFamily: fontFamily.medium,
  },
  confirmBtn: {
    width: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnDisabled: {
    opacity: 0.4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: fontSize.base,
    fontFamily: fontFamily.semibold,
  },
  meta: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    fontVariant: ['tabular-nums'],
  },
  winPct: {
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
