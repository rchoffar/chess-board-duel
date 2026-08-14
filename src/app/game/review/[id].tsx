import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useEffect, useMemo } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ChevronLeft } from 'lucide-react-native';
import { GlassCard } from '../../../components/ui/GlassCard';
import { SectionLabel } from '../../../components/ui/SectionLabel';
import { MetricGauge } from '../../../components/ui/MetricGauge';
import { AnimatedNumber } from '../../../components/ui/AnimatedNumber';
import { GameReplay } from '../../../components/chess/GameReplay';
import { fontFamily, fontSize, spacing } from '../../../design-system/theme';
import { useTheme } from '../../../design-system/ThemeProvider';
import { getGame } from '../../../db/games';
import { parseGamePgn, uciForMove, type ParsedGame } from '../../../utils/pgn';
import { useAnalysisStore } from '../../../store/useAnalysisStore';
import { useEngine } from '../../../chess/useEngine';
import { judgmentCounts, JUDGMENT_META, JUDGMENT_ORDER } from '../../../chess/judgment';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const enter = (delay: number) => FadeInDown.delay(delay).springify().damping(18).stiffness(140);

export default function GameReviewScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const gameIdNum = Number(id);

  useEngine();

  const game = useMemo(() => getGame(gameIdNum), [gameIdNum]);

  const parsed: ParsedGame = useMemo(() => {
    const fallback: ParsedGame = {
      variant: game?.variant ?? 'standard',
      startFen: game?.startFen ?? START_FEN,
      startEngineFen: game?.startFen ?? START_FEN,
      moves: [],
    };
    if (!game?.pgn) return fallback;
    try {
      return parseGamePgn(game.pgn, {
        variant: game.variant,
        startFen: game.startFen ?? undefined,
      });
    } catch {
      return fallback;
    }
  }, [game]);
  const replayMoves = parsed.moves;

  // Engine-side FENs: castling rights intact for Stockfish (UCI_Chess960).
  const fens = useMemo(
    () => [parsed.startEngineFen, ...replayMoves.map((m) => m.afterEngine)],
    [parsed, replayMoves]
  );
  const playedUcis = useMemo(() => replayMoves.map(uciForMove), [replayMoves]);

  const analysis = useAnalysisStore();

  // The detail screen usually loaded this game already; make sure, then analyse.
  const chess960 = parsed.variant === 'chess960';
  useEffect(() => {
    const store = useAnalysisStore.getState();
    if (store.gameId !== gameIdNum) {
      store.load(gameIdNum, fens, playedUcis, chess960);
    }
    if (!useAnalysisStore.getState().complete && fens.length > 1) {
      store.analyzeGame(gameIdNum, fens, playedUcis);
    }
    // Deliberately no clear() on unmount: the detail screen below keeps using
    // the store, and an in-flight analysis is allowed to finish in background.
  }, [gameIdNum, fens, playedUcis, chess960]);

  if (!game) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + spacing.lg }]}>
        <Text style={{ color: colors.textSecondary, fontFamily: fontFamily.medium }}>Game not found.</Text>
      </View>
    );
  }

  const counts = analysis.complete ? judgmentCounts(analysis.judgments) : null;
  const progressPct =
    analysis.progress.total > 0 ? (analysis.progress.done / analysis.progress.total) * 100 : 0;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.xl }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.topBar}>
        <TouchableOpacity
          style={[styles.iconBtn, { backgroundColor: colors.neutralTileBg }]}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <ChevronLeft size={18} color={colors.textSecondary} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={[styles.topTitle, { color: colors.textSecondary }]} numberOfLines={1}>
          {game.white} vs {game.black}
        </Text>
        <View style={styles.iconBtn} />
      </View>

      <Animated.View entering={enter(0)}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Game review</Text>
      </Animated.View>

      {!analysis.complete ? (
        <Animated.View entering={enter(60)}>
          <GlassCard variant="dark" style={styles.loaderCard}>
            <MetricGauge
              value={progressPct}
              centerLabel={`${Math.round(progressPct)}%`}
              color={colors.accentBright}
              size={120}
              strokeWidth={10}
            />
            <Text style={[styles.loaderTitle, { color: colors.onDarkPrimary }]}>
              {analysis.error ? 'Analysis failed' : 'Analysing your game'}
            </Text>
            <Text style={[styles.loaderSub, { color: colors.onDarkSecondary }]}>
              {analysis.error
                ? analysis.error
                : analysis.progress.total > 0
                  ? `Position ${Math.min(analysis.progress.done + 1, analysis.progress.total)} of ${analysis.progress.total} · Stockfish runs on this phone`
                  : 'Starting engine…'}
            </Text>
          </GlassCard>
        </Animated.View>
      ) : (
        <>
          <Animated.View entering={enter(60)}>
            <SectionLabel style={styles.sectionLabel}>Summary</SectionLabel>
            <GlassCard>
              <View style={styles.summaryHeader}>
                <View style={styles.summaryIconCell} />
                <Text style={[styles.summaryLabelCell, { color: colors.textTertiary }]} />
                <Text style={[styles.summaryCount, { color: colors.textSecondary }]} numberOfLines={1}>
                  {game.white}
                </Text>
                <Text style={[styles.summaryCount, { color: colors.textSecondary }]} numberOfLines={1}>
                  {game.black}
                </Text>
              </View>
              {analysis.accuracies && (
                <>
                  <View style={styles.summaryRow}>
                    <View style={styles.summaryIconCell} />
                    <Text style={[styles.summaryLabelCell, { color: colors.textPrimary }]}>Accuracy</Text>
                    <AnimatedNumber
                      value={analysis.accuracies.white}
                      decimals={1}
                      style={[styles.accuracyValue, { color: colors.accent }]}
                    />
                    <AnimatedNumber
                      value={analysis.accuracies.black}
                      decimals={1}
                      style={[styles.accuracyValue, { color: colors.accent }]}
                    />
                  </View>
                  <View style={[styles.divider, { backgroundColor: colors.hairline }]} />
                </>
              )}
              {JUDGMENT_ORDER.map((judgment) => {
                const meta = JUDGMENT_META[judgment];
                const row = counts![judgment];
                return (
                  <View key={judgment} style={styles.summaryRow}>
                    <View style={[styles.summaryBadge, { backgroundColor: meta.color }]}>
                      <Text style={styles.summaryBadgeGlyph} allowFontScaling={false}>
                        {meta.glyph}
                      </Text>
                    </View>
                    <Text style={[styles.summaryLabelCell, { color: colors.textPrimary }]}>{meta.label}</Text>
                    <Text
                      style={[
                        styles.summaryCount,
                        { color: row.white > 0 ? meta.color : colors.textTertiary },
                      ]}
                    >
                      {row.white}
                    </Text>
                    <Text
                      style={[
                        styles.summaryCount,
                        { color: row.black > 0 ? meta.color : colors.textTertiary },
                      ]}
                    >
                      {row.black}
                    </Text>
                  </View>
                );
              })}
            </GlassCard>
          </Animated.View>

          <Animated.View entering={enter(120)}>
            <GameReplay
              replayMoves={replayMoves}
              startFen={parsed.startFen}
              evals={analysis.evals}
              judgments={analysis.judgments}
              showBadges
            />
          </Animated.View>
        </>
      )}
    </ScrollView>
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  topTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: fontSize.sm,
    fontFamily: fontFamily.semibold,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: fontSize.displaySheet,
    fontFamily: fontFamily.display,
  },
  loaderCard: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing['2xl'],
  },
  loaderTitle: {
    fontSize: fontSize.lg,
    fontFamily: fontFamily.semibold,
  },
  loaderSub: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  sectionLabel: {
    marginBottom: spacing.sm,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingBottom: spacing.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xs + 1,
  },
  summaryIconCell: {
    width: 24,
  },
  summaryBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryBadgeGlyph: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: fontFamily.extrabold,
  },
  summaryLabelCell: {
    flex: 1,
    fontSize: fontSize.base,
    fontFamily: fontFamily.medium,
  },
  summaryCount: {
    width: 64,
    textAlign: 'center',
    fontSize: fontSize.base,
    fontFamily: fontFamily.bold,
    fontVariant: ['tabular-nums'],
  },
  accuracyValue: {
    width: 64,
    textAlign: 'center',
    fontSize: fontSize.lg,
    fontFamily: fontFamily.extrabold,
    fontVariant: ['tabular-nums'],
  },
  divider: {
    height: 1,
    marginVertical: spacing.sm,
  },
});
