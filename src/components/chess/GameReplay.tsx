import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useEffect, useState, useCallback, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import { ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight, Play, Pause } from 'lucide-react-native';
import { GlassCard } from '../ui/GlassCard';
import { SectionLabel } from '../ui/SectionLabel';
import { ChessboardView } from './ChessboardView';
import { MoveList } from './MoveList';
import { EvalBar } from './EvalBar';
import { fontFamily, fontSize, radius, spacing } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';
import { uciPvToSan } from '../../chess/evalUtils';
import { animationForStep, type MoveAnimationSpec } from '../../chess/moveAnimation';
import type { PositionEval } from '../../chess/engine';
import type { Judgment } from '../../chess/judgment';
import type { ReplayMove } from '../../utils/pgn';

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const AUTOPLAY_INTERVAL_MS = 1200;

interface GameReplayProps {
  /** Replayed plies (each move has before/after FENs), from parseGamePgn. */
  replayMoves: ReplayMove[];
  /** Start position shown before any move (zero-move Chess960 games). */
  startFen?: string;
  /** Position evals, index = ply (0 = start). Enables the eval bar + best line. */
  evals?: (PositionEval | null)[];
  /** Judgment per move; also drives the on-board badge when showBadges is set. */
  judgments?: Judgment[];
  /** Show the chess.com-style judgment badge on the destination square. */
  showBadges?: boolean;
  /** Called whenever the displayed ply changes (0 = start position). */
  onPlyChange?: (ply: number) => void;
}

interface ReplayPosition {
  ply: number;
  anim: MoveAnimationSpec | null;
}

export function GameReplay({
  replayMoves,
  startFen,
  evals,
  judgments,
  showBadges = false,
  onPlyChange,
}: GameReplayProps) {
  const { colors } = useTheme();
  const [pos, setPos] = useState<ReplayPosition>({ ply: 0, anim: null });
  const [playing, setPlaying] = useState(false);
  const totalPlies = replayMoves.length;
  const animKey = useRef(0);
  const ply = pos.ply;

  // Single-ply steps slide the moved piece(s); jumps snap.
  const stepTo = useCallback(
    (current: number, target: number): ReplayPosition => {
      const next = Math.max(0, Math.min(totalPlies, target));
      const delta = next - current;
      if (Math.abs(delta) !== 1) return { ply: next, anim: null };
      const move = replayMoves[delta === 1 ? next - 1 : current - 1];
      return {
        ply: next,
        anim: { segments: animationForStep(move, delta as 1 | -1), key: ++animKey.current },
      };
    },
    [replayMoves, totalPlies]
  );

  const goTo = useCallback(
    (target: number, stopAutoplay = true) => {
      setPos((p) => stepTo(p.ply, target));
      if (stopAutoplay) setPlaying(false);
      Haptics.selectionAsync().catch(() => {});
    },
    [stepTo]
  );

  useEffect(() => {
    onPlyChange?.(ply);
  }, [ply, onPlyChange]);

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      setPos((current) => {
        if (current.ply >= totalPlies) {
          setPlaying(false);
          return current;
        }
        return stepTo(current.ply, current.ply + 1);
      });
    }, AUTOPLAY_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [playing, totalPlies, stepTo]);

  const currentMove = ply > 0 ? replayMoves[ply - 1] : null;
  const fen = currentMove ? currentMove.after : (replayMoves[0]?.before ?? startFen ?? START_FEN);
  const currentEval = evals?.[ply] ?? null;
  const currentJudgment = ply > 0 ? judgments?.[ply - 1] : undefined;

  const bestLineSan =
    currentEval && currentEval.pv.length > 0
      ? uciPvToSan(currentEval.fen, currentEval.pv.slice(0, 6)).join(' ')
      : null;

  // Engine best move from the displayed position (promotion char dropped).
  const bestArrow = currentEval?.bestUci
    ? { from: currentEval.bestUci.slice(0, 2), to: currentEval.bestUci.slice(2, 4) }
    : null;

  const controlColor = (disabled: boolean) => (disabled ? colors.textTertiary : colors.textPrimary);

  return (
    <View style={styles.container}>
      <View style={styles.boardRow}>
        {evals && <EvalBar score={currentEval?.score ?? null} />}
        <View style={styles.boardWrap}>
          <ChessboardView
            fen={fen}
            lastMove={currentMove ? { from: currentMove.from, to: currentMove.to } : null}
            badge={
              showBadges && currentMove && currentJudgment
                ? { square: currentMove.to, judgment: currentJudgment }
                : null
            }
            arrow={bestArrow}
            animateMove={pos.anim}
          />
        </View>
      </View>

      {bestLineSan && (
        <Text style={[styles.evalLine, { color: colors.textSecondary }]} numberOfLines={1}>
          {bestLineSan}
        </Text>
      )}

      <View style={styles.replayBar}>
        <TouchableOpacity
          style={[styles.replayBtn, { backgroundColor: colors.neutralTileBg }]}
          onPress={() => goTo(0)}
          disabled={ply === 0}
          activeOpacity={0.7}
        >
          <ChevronsLeft size={18} color={controlColor(ply === 0)} strokeWidth={2} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.replayBtn, { backgroundColor: colors.neutralTileBg }]}
          onPress={() => goTo(ply - 1)}
          disabled={ply === 0}
          activeOpacity={0.7}
        >
          <ChevronLeft size={18} color={controlColor(ply === 0)} strokeWidth={2} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.replayBtn, styles.playBtn, { backgroundColor: colors.accentTint }]}
          onPress={() => {
            if (!playing && ply >= totalPlies) setPos({ ply: 0, anim: null });
            setPlaying((p) => !p);
          }}
          disabled={totalPlies === 0}
          activeOpacity={0.7}
        >
          {playing ? (
            <Pause size={18} color={colors.accent} strokeWidth={2} />
          ) : (
            <Play size={18} color={totalPlies === 0 ? colors.textTertiary : colors.accent} strokeWidth={2} />
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.replayBtn, { backgroundColor: colors.neutralTileBg }]}
          onPress={() => goTo(ply + 1)}
          disabled={ply >= totalPlies}
          activeOpacity={0.7}
        >
          <ChevronRight size={18} color={controlColor(ply >= totalPlies)} strokeWidth={2} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.replayBtn, { backgroundColor: colors.neutralTileBg }]}
          onPress={() => goTo(totalPlies)}
          disabled={ply >= totalPlies}
          activeOpacity={0.7}
        >
          <ChevronsRight size={18} color={controlColor(ply >= totalPlies)} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <Text style={[styles.plyLabel, { color: colors.textTertiary }]}>
        {ply === 0
          ? 'Starting position'
          : `${Math.ceil(ply / 2)}${ply % 2 === 1 ? '.' : '…'} ${currentMove?.san} — move ${ply} of ${totalPlies}`}
      </Text>

      <SectionLabel style={styles.sectionLabel}>Moves</SectionLabel>
      <GlassCard>
        <MoveList
          moves={replayMoves.map((m) => ({ san: m.san }))}
          selectedIndex={ply > 0 ? ply - 1 : undefined}
          onSelectMove={(index) => goTo(index + 1)}
          judgments={judgments && judgments.length > 0 ? judgments : undefined}
        />
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  boardRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  boardWrap: {
    flex: 1,
  },
  evalLine: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  replayBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  replayBtn: {
    width: 48,
    height: 40,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtn: {
    width: 56,
  },
  plyLabel: {
    textAlign: 'center',
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
    fontVariant: ['tabular-nums'],
  },
  sectionLabel: {
    marginTop: spacing.xs,
  },
});
