import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Alert } from 'react-native';
import { useCallback, useMemo, useState } from 'react';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ChevronLeft, Pencil, Trash2, Check } from 'lucide-react-native';
import { GlassCard } from '../../components/ui/GlassCard';
import { GlowBlob } from '../../components/ui/GlowBlob';
import { SectionLabel } from '../../components/ui/SectionLabel';
import { AnimatedNumber } from '../../components/ui/AnimatedNumber';
import { MetricGauge } from '../../components/ui/MetricGauge';
import { WdlBar } from '../../components/charts/WdlBar';
import { FormDots } from '../../components/charts/FormDots';
import { PlayerAvatar } from '../../components/players/PlayerAvatar';
import { fontFamily, fontSize, radius, spacing } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';
import { deletePlayer, getPlayer, renamePlayer, type Player } from '../../db/players';
import { listGamesForPlayer, type GameRecord } from '../../db/games';
import { computePlayerStats, winRate, scoreRate, type Tally } from '../../chess/stats';

const enter = (delay: number) => FadeInDown.delay(delay).springify().damping(18).stiffness(140);

function pct(value: number | null): string {
  return value == null ? '—' : `${Math.round(value)}%`;
}

function ColorGaugeCard({ label, tally }: { label: string; tally: Tally }) {
  const { colors } = useTheme();
  const rate = winRate(tally);
  return (
    <GlassCard style={styles.halfCard} padding={18}>
      <View style={styles.gaugeCardInner}>
        <SectionLabel>{label}</SectionLabel>
        <View style={styles.gaugeWrap}>
          <MetricGauge
            value={rate ?? 0}
            centerLabel={pct(rate)}
            color={rate == null ? colors.neutralChart : colors.accent}
          />
        </View>
        <Text style={[styles.gaugeCaption, { color: colors.textTertiary }]}>
          {tally.games === 0 ? 'No games' : `${tally.games} game${tally.games > 1 ? 's' : ''}`}
        </Text>
      </View>
    </GlassCard>
  );
}

export default function PlayerDetailScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const playerId = Number(id);

  const [player, setPlayer] = useState<Player | null>(null);
  const [games, setGames] = useState<GameRecord[]>([]);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState('');

  const reload = useCallback(() => {
    setPlayer(getPlayer(playerId));
    setGames(listGamesForPlayer(playerId));
  }, [playerId]);
  useFocusEffect(reload);

  const stats = useMemo(() => computePlayerStats(games, playerId), [games, playerId]);
  const overallWin = winRate(stats.overall);
  const overallScore = scoreRate(stats.overall);

  const submitRename = () => {
    if (player && renamePlayer(player.id, draftName)) {
      setEditing(false);
      reload();
    }
  };

  const confirmDelete = () => {
    if (!player) return;
    Alert.alert('Delete player', `Remove the profile "${player.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          if (deletePlayer(player.id)) router.back();
        },
      },
    ]);
  };

  if (!player) return <View style={styles.screen} />;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md, paddingBottom: 120 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View entering={enter(0)}>
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: colors.neutralTileBg }]}
              onPress={() => router.back()}
              activeOpacity={0.7}
            >
              <ChevronLeft size={20} color={colors.textSecondary} strokeWidth={2} />
            </TouchableOpacity>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={[styles.iconBtn, { backgroundColor: editing ? colors.accentTint : colors.neutralTileBg }]}
                onPress={() => {
                  setDraftName(player.name);
                  setEditing((v) => !v);
                }}
                activeOpacity={0.7}
              >
                <Pencil size={16} color={editing ? colors.accent : colors.textSecondary} strokeWidth={2} />
              </TouchableOpacity>
              {games.length === 0 && (
                <TouchableOpacity
                  style={[styles.iconBtn, { backgroundColor: colors.neutralTileBg }]}
                  onPress={confirmDelete}
                  activeOpacity={0.7}
                >
                  <Trash2 size={16} color={colors.loss} strokeWidth={2} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={styles.identityRow}>
            <PlayerAvatar name={player.name} size={56} />
            {editing ? (
              <View style={styles.renameRow}>
                <TextInput
                  style={[
                    styles.renameInput,
                    {
                      backgroundColor: colors.surface.fieldBg,
                      borderColor: colors.surface.fieldBorder,
                      color: colors.textPrimary,
                    },
                  ]}
                  value={draftName}
                  onChangeText={setDraftName}
                  onSubmitEditing={submitRename}
                  returnKeyType="done"
                  autoFocus
                />
                <TouchableOpacity
                  style={[styles.confirmBtn, { backgroundColor: colors.accentBright }, !draftName.trim() && styles.confirmBtnDisabled]}
                  onPress={submitRename}
                  disabled={!draftName.trim()}
                  activeOpacity={0.85}
                >
                  <Check size={18} color="#0A0A0F" strokeWidth={2.5} />
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
                {player.name}
              </Text>
            )}
          </View>
        </Animated.View>

        {stats.overall.games === 0 ? (
          <Animated.View entering={enter(60)}>
            <GlassCard>
              <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No finished games yet</Text>
              <Text style={[styles.emptySub, { color: colors.textTertiary }]}>
                Statistics appear once {player.name} finishes a game on the board.
              </Text>
            </GlassCard>
          </Animated.View>
        ) : (
          <>
            <Animated.View entering={enter(60)}>
              <GlassCard variant="dark" padding={24}>
                <GlowBlob />
                <SectionLabel tone="dark">Win rate</SectionLabel>
                <AnimatedNumber
                  value={overallWin ?? 0}
                  formatFn={(v) => `${v.toFixed(0)}%`}
                  style={[styles.heroValue, { color: colors.accentBright }]}
                />
                <Text style={[styles.heroCaption, { color: colors.onDarkTertiary }]}>
                  {stats.overall.games} game{stats.overall.games > 1 ? 's' : ''} · score {pct(overallScore)}
                </Text>
                <View style={styles.heroBar}>
                  <WdlBar
                    wins={stats.overall.wins}
                    draws={stats.overall.draws}
                    losses={stats.overall.losses}
                    tone="dark"
                  />
                </View>
              </GlassCard>
            </Animated.View>

            <Animated.View entering={enter(120)} style={styles.gaugesRow}>
              <ColorGaugeCard label="As White" tally={stats.asWhite} />
              <ColorGaugeCard label="As Black" tally={stats.asBlack} />
            </Animated.View>

            {stats.form.length > 1 && (
              <Animated.View entering={enter(180)}>
                <GlassCard padding={20}>
                  <View style={styles.cardHeaderRow}>
                    <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Recent form</Text>
                    <SectionLabel>Last {stats.form.length}</SectionLabel>
                  </View>
                  <FormDots form={stats.form} />
                </GlassCard>
              </Animated.View>
            )}

            {stats.opponents.length > 0 && (
              <Animated.View entering={enter(240)}>
                <GlassCard padding={20}>
                  <View style={styles.cardHeaderRow}>
                    <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Head-to-head</Text>
                    <SectionLabel>By opponent</SectionLabel>
                  </View>
                  <View style={styles.opponentList}>
                    {stats.opponents.map((opp, i) => (
                      <View key={opp.opponentId}>
                        {i > 0 && <View style={[styles.divider, { backgroundColor: colors.hairline }]} />}
                        <View style={styles.opponentRow}>
                          <Text style={[styles.opponentName, { color: colors.textPrimary }]} numberOfLines={1}>
                            {opp.name}
                          </Text>
                          <Text style={[styles.opponentPct, { color: colors.accent }]}>
                            {pct(winRate(opp))}
                          </Text>
                        </View>
                        <WdlBar wins={opp.wins} draws={opp.draws} losses={opp.losses} height={6} />
                      </View>
                    ))}
                  </View>
                </GlassCard>
              </Animated.View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.base,
    marginBottom: spacing.sm,
  },
  name: {
    flex: 1,
    fontSize: fontSize.displaySheet,
    fontFamily: fontFamily.display,
  },
  renameRow: {
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  renameInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm + 2,
    fontSize: fontSize.md,
    fontFamily: fontFamily.medium,
  },
  confirmBtn: {
    width: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnDisabled: {
    opacity: 0.4,
  },
  heroValue: {
    fontSize: fontSize.display,
    fontFamily: fontFamily.extrabold,
    marginTop: spacing.sm,
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  heroCaption: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
    marginTop: spacing.xs,
    fontVariant: ['tabular-nums'],
  },
  heroBar: {
    marginTop: spacing.base,
  },
  gaugesRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  halfCard: {
    flex: 1,
  },
  gaugeCardInner: {
    alignItems: 'center',
  },
  gaugeWrap: {
    marginTop: spacing.sm,
  },
  gaugeCaption: {
    marginTop: spacing.sm,
    fontSize: fontSize.xs,
    fontFamily: fontFamily.medium,
    fontVariant: ['tabular-nums'],
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.bold,
  },
  opponentList: {
    gap: spacing.md,
  },
  divider: {
    height: 1,
    marginBottom: spacing.md,
  },
  opponentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  opponentName: {
    flex: 1,
    fontSize: fontSize.base,
    fontFamily: fontFamily.semibold,
  },
  opponentPct: {
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
