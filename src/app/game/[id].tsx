import { View, Text, StyleSheet, TouchableOpacity, Alert, Share, ScrollView } from 'react-native';
import { useEffect, useMemo, useCallback } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { ChevronLeft, Copy, Share2, Trash2, Sparkles } from 'lucide-react-native';
import { GameReplay } from '../../components/chess/GameReplay';
import { fontFamily, fontSize, radius, spacing } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';
import { getGame, deleteGame, timeControlsOf } from '../../db/games';
import { timeControlsLabel } from '../../chess/clock';
import { parseGamePgn, uciForMove, type ParsedGame } from '../../utils/pgn';
import { useAnalysisStore } from '../../store/useAnalysisStore';
import { useEngine } from '../../chess/useEngine';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export default function GameDetailScreen() {
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

  const evals = useAnalysisStore((s) => s.evals);
  const complete = useAnalysisStore((s) => s.complete);
  const running = useAnalysisStore((s) => s.running);

  const chess960 = parsed.variant === 'chess960';
  useEffect(() => {
    useAnalysisStore.getState().load(gameIdNum, fens, playedUcis, chess960);
    return () => {
      useAnalysisStore.getState().clear();
    };
  }, [gameIdNum, fens, playedUcis, chess960]);

  // Live eval while scrubbing (skipped once fully analysed or while reviewing).
  const onPlyChange = useCallback(
    (ply: number) => {
      const state = useAnalysisStore.getState();
      if (!state.complete && !state.running && fens[ply]) {
        state.evalPly(ply, fens[ply]);
      }
    },
    [fens]
  );

  if (!game) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + spacing.lg }]}>
        <Text style={{ color: colors.textSecondary, fontFamily: fontFamily.medium }}>Game not found.</Text>
      </View>
    );
  }

  const copyPgn = async () => {
    await Clipboard.setStringAsync(game.pgn);
    Alert.alert('Copied', 'PGN copied — paste it into chess.com to analyse.');
  };

  const sharePgn = () => {
    Share.share({ message: game.pgn }).catch(() => {});
  };

  const confirmDelete = () => {
    Alert.alert('Delete game', 'This game will be permanently deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteGame(game.id);
          router.back();
        },
      },
    ]);
  };

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
        <View style={styles.headerCenter}>
          <Text style={[styles.players, { color: colors.textPrimary }]} numberOfLines={1}>
            {game.white} vs {game.black}
          </Text>
          <Text style={[styles.meta, { color: colors.textTertiary }]}>
            {game.result === '*' ? 'Unfinished' : game.result}
            {game.termination ? ` · ${game.termination}` : ''} ·{' '}
            {timeControlsLabel(timeControlsOf(game))}
            {game.variant === 'chess960' ? ' · Chess960' : ''}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.iconBtn, { backgroundColor: colors.neutralTileBg }]}
          onPress={confirmDelete}
          activeOpacity={0.7}
        >
          <Trash2 size={16} color={colors.loss} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      {replayMoves.length > 0 && (
        <TouchableOpacity
          style={[styles.reviewBtn, { backgroundColor: colors.accentTint, borderColor: colors.accent }]}
          onPress={() => router.push(`/game/review/${game.id}`)}
          disabled={running}
          activeOpacity={0.85}
        >
          <Sparkles size={16} color={colors.accent} strokeWidth={2} />
          <Text style={[styles.reviewBtnText, { color: colors.accent }]}>
            {complete ? 'Game review' : 'Analyse game'}
          </Text>
        </TouchableOpacity>
      )}

      <View style={styles.actions}>
        <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.accentBright }]} onPress={copyPgn} activeOpacity={0.85}>
          <Copy size={16} color="#0A0A0F" strokeWidth={2} />
          <Text style={styles.primaryBtnText}>Copy PGN</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.secondaryBtn, { borderColor: colors.hairline }]} onPress={sharePgn} activeOpacity={0.85}>
          <Share2 size={16} color={colors.textPrimary} strokeWidth={2} />
          <Text style={[styles.secondaryBtnText, { color: colors.textPrimary }]}>Share</Text>
        </TouchableOpacity>
      </View>

      <GameReplay replayMoves={replayMoves} startFen={parsed.startFen} evals={evals} onPlyChange={onPlyChange} />
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
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  players: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.bold,
  },
  meta: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
  },
  reviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
  },
  reviewBtnText: {
    fontSize: fontSize.base,
    fontFamily: fontFamily.bold,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
  },
  primaryBtnText: {
    color: '#0A0A0F',
    fontSize: fontSize.base,
    fontFamily: fontFamily.bold,
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
  },
  secondaryBtnText: {
    fontSize: fontSize.base,
    fontFamily: fontFamily.semibold,
  },
});
