import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeepAwake } from 'expo-keep-awake';
import * as Clipboard from 'expo-clipboard';
import { Flag, Handshake, X, Copy, AlertTriangle } from 'lucide-react-native';
import { GlassCard } from '../components/ui/GlassCard';
import { ChessboardView } from '../components/chess/ChessboardView';
import { ClockDisplay } from '../components/chess/ClockDisplay';
import { MoveList } from '../components/chess/MoveList';
import { fontFamily, fontSize, radius, spacing } from '../design-system/theme';
import { useTheme } from '../design-system/ThemeProvider';
import { useGameStore } from '../store/useGameStore';
import { remainingMs } from '../chess/clock';
import { getGame } from '../db/games';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export default function GameScreen() {
  useKeepAwake();
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const phase = useGameStore((s) => s.phase);
  const config = useGameStore((s) => s.config);
  const clock = useGameStore((s) => s.clock);
  const fen = useGameStore((s) => s.fen);
  const moves = useGameStore((s) => s.moves);
  const illegalSquares = useGameStore((s) => s.illegalSquares);
  const setupSquares = useGameStore((s) => s.setupSquares);
  const result = useGameStore((s) => s.result);
  const termination = useGameStore((s) => s.termination);
  const gameId = useGameStore((s) => s.gameId);
  const tick = useGameStore((s) => s.tick);
  const resign = useGameStore((s) => s.resign);
  const agreeDraw = useGameStore((s) => s.agreeDraw);
  const abortGame = useGameStore((s) => s.abortGame);
  const reset = useGameStore((s) => s.reset);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (phase !== 'playing') return;
    const interval = setInterval(() => {
      const t = Date.now();
      setNow(t);
      tick(t);
    }, 100);
    return () => clearInterval(interval);
  }, [phase, tick]);

  if (phase === 'idle' || !config) {
    return null;
  }

  const whiteMs = clock ? remainingMs(clock, 'w', now) : 0;
  const blackMs = clock ? remainingMs(clock, 'b', now) : 0;
  const lastMoveSan = moves.length > 0 ? moves[moves.length - 1].san : null;

  const confirmResign = () => {
    const sideToMove = clock?.running === 'b' ? 'b' : 'w';
    const name = sideToMove === 'w' ? config.white : config.black;
    Alert.alert('Resign', `${name} resigns the game?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Resign', style: 'destructive', onPress: () => resign(sideToMove) },
    ]);
  };

  const confirmDraw = () => {
    Alert.alert('Draw', 'Both players agree to a draw?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Agree draw', onPress: () => agreeDraw() },
    ]);
  };

  const confirmExit = () => {
    if (phase === 'finished') {
      reset();
      router.back();
      return;
    }
    Alert.alert('Leave game', 'The game will be aborted.', [
      { text: 'Stay', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: () => {
          abortGame();
          router.back();
        },
      },
    ]);
  };

  const copyPgn = async () => {
    if (!gameId) return;
    const record = getGame(gameId);
    if (record?.pgn) {
      await Clipboard.setStringAsync(record.pgn);
      Alert.alert('Copied', 'PGN copied — paste it into chess.com to analyse.');
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.md }]}>
      <View style={styles.topBar}>
        <TouchableOpacity
          style={[styles.iconBtn, { backgroundColor: colors.neutralTileBg }]}
          onPress={confirmExit}
          activeOpacity={0.7}
        >
          <X size={18} color={colors.textSecondary} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={[styles.topTitle, { color: colors.textSecondary }]}>
          {config.white} vs {config.black}
        </Text>
        <View style={styles.iconBtn} />
      </View>

      <ClockDisplay name={config.black} remainingMs={blackMs} active={clock?.running === 'b'} flipped />

      <View style={styles.boardWrap}>
        <ChessboardView
          fen={fen ?? START_FEN}
          errorSquares={phase === 'setup' ? setupSquares : illegalSquares}
        />
        {phase === 'setup' && (
          <View style={[styles.banner, { backgroundColor: colors.neutralTileBg }]}>
            <Text style={[styles.bannerText, { color: colors.textSecondary }]}>
              Place all pieces in the starting position
              {setupSquares.length > 0 ? ` — ${setupSquares.length} square${setupSquares.length > 1 ? 's' : ''} to fix` : ''}
            </Text>
          </View>
        )}
        {phase === 'playing' && illegalSquares.length > 0 && (
          <View style={[styles.banner, { backgroundColor: 'rgba(229, 72, 77, 0.16)' }]}>
            <AlertTriangle size={14} color={colors.loss} strokeWidth={2} />
            <Text style={[styles.bannerText, { color: colors.loss }]}>
              Illegal position — put the lit pieces back
            </Text>
          </View>
        )}
        {phase === 'playing' && illegalSquares.length === 0 && lastMoveSan && (
          <View style={[styles.banner, { backgroundColor: colors.accentTint }]}>
            <Text style={[styles.bannerText, { color: colors.accent }]}>
              {Math.ceil(moves.length / 2)}. {lastMoveSan}
            </Text>
          </View>
        )}
      </View>

      <ClockDisplay name={config.white} remainingMs={whiteMs} active={clock?.running === 'w'} />

      {phase === 'finished' ? (
        <GlassCard variant="dark" style={styles.resultCard}>
          <Text style={[styles.resultText, { color: colors.onDarkPrimary }]}>{result}</Text>
          <Text style={[styles.terminationText, { color: colors.onDarkSecondary }]}>{termination}</Text>
          <View style={styles.resultActions}>
            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.accentBright }]} onPress={copyPgn} activeOpacity={0.85}>
              <Copy size={16} color="#0A0A0F" strokeWidth={2} />
              <Text style={styles.primaryBtnText}>Copy PGN</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryBtn, { borderColor: colors.onDarkHairline }]}
              onPress={() => {
                reset();
                router.back();
              }}
              activeOpacity={0.85}
            >
              <Text style={[styles.secondaryBtnText, { color: colors.onDarkPrimary }]}>Done</Text>
            </TouchableOpacity>
          </View>
        </GlassCard>
      ) : (
        <View style={styles.bottom}>
          <View style={styles.movesWrap}>
            <MoveList moves={moves} follow />
          </View>
          {phase === 'playing' && (
            <View style={styles.controls}>
              <TouchableOpacity style={[styles.controlBtn, { backgroundColor: colors.neutralTileBg }]} onPress={confirmDraw} activeOpacity={0.8}>
                <Handshake size={16} color={colors.textSecondary} strokeWidth={2} />
                <Text style={[styles.controlText, { color: colors.textSecondary }]}>Draw</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.controlBtn, { backgroundColor: colors.neutralTileBg }]} onPress={confirmResign} activeOpacity={0.8}>
                <Flag size={16} color={colors.loss} strokeWidth={2} />
                <Text style={[styles.controlText, { color: colors.loss }]}>Resign</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topTitle: {
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
  boardWrap: {
    gap: spacing.sm,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  bannerText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.semibold,
  },
  bottom: {
    flex: 1,
    gap: spacing.md,
  },
  movesWrap: {
    flex: 1,
  },
  controls: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  controlBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
  },
  controlText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.bold,
  },
  resultCard: {
    marginTop: 'auto',
  },
  resultText: {
    fontSize: fontSize['2xl'],
    fontFamily: fontFamily.bold,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  terminationText: {
    fontSize: fontSize.base,
    fontFamily: fontFamily.medium,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  resultActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.base,
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
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
  },
  secondaryBtnText: {
    fontSize: fontSize.base,
    fontFamily: fontFamily.semibold,
  },
});
