import { View, Text, StyleSheet, TouchableOpacity, Alert, Share, ScrollView } from 'react-native';
import { useMemo } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { Chess } from 'chess.js';
import { ChevronLeft, Copy, Share2, Trash2 } from 'lucide-react-native';
import { GlassCard } from '../../components/ui/GlassCard';
import { SectionLabel } from '../../components/ui/SectionLabel';
import { MoveList } from '../../components/chess/MoveList';
import { fontFamily, fontSize, radius, spacing } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';
import { getGame, deleteGame } from '../../db/games';
import { timeControlLabel } from '../../chess/clock';

export default function GameDetailScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const game = useMemo(() => getGame(Number(id)), [id]);

  const moves = useMemo(() => {
    if (!game?.pgn) return [];
    try {
      const chess = new Chess();
      chess.loadPgn(game.pgn);
      return chess.history().map((san) => ({ san }));
    } catch {
      return [];
    }
  }, [game]);

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
        <TouchableOpacity
          style={[styles.iconBtn, { backgroundColor: colors.neutralTileBg }]}
          onPress={confirmDelete}
          activeOpacity={0.7}
        >
          <Trash2 size={16} color={colors.loss} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <GlassCard variant="dark">
        <Text style={[styles.players, { color: colors.onDarkPrimary }]}>
          {game.white} vs {game.black}
        </Text>
        <Text style={[styles.result, { color: colors.accentBright }]}>{game.result === '*' ? 'Unfinished' : game.result}</Text>
        {game.termination && (
          <Text style={[styles.meta, { color: colors.onDarkSecondary }]}>{game.termination}</Text>
        )}
        <Text style={[styles.meta, { color: colors.onDarkTertiary }]}>
          {new Date(game.startedAt).toLocaleString()} ·{' '}
          {timeControlLabel({ baseMinutes: game.baseMinutes, incrementSeconds: game.incrementSeconds })}
        </Text>
        <View style={styles.actions}>
          <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.accentBright }]} onPress={copyPgn} activeOpacity={0.85}>
            <Copy size={16} color="#0A0A0F" strokeWidth={2} />
            <Text style={styles.primaryBtnText}>Copy PGN</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.secondaryBtn, { borderColor: colors.onDarkHairline }]} onPress={sharePgn} activeOpacity={0.85}>
            <Share2 size={16} color={colors.onDarkPrimary} strokeWidth={2} />
            <Text style={[styles.secondaryBtnText, { color: colors.onDarkPrimary }]}>Share</Text>
          </TouchableOpacity>
        </View>
      </GlassCard>

      <SectionLabel style={styles.sectionLabel}>Moves</SectionLabel>
      <GlassCard>
        <MoveList moves={moves} />
      </GlassCard>

      <SectionLabel style={styles.sectionLabel}>PGN</SectionLabel>
      <GlassCard>
        <Text style={[styles.pgn, { color: colors.textSecondary }]} selectable>
          {game.pgn || 'No moves recorded.'}
        </Text>
      </GlassCard>
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
    justifyContent: 'space-between',
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  players: {
    fontSize: fontSize.xl,
    fontFamily: fontFamily.bold,
  },
  result: {
    fontSize: fontSize['2xl'],
    fontFamily: fontFamily.bold,
    fontVariant: ['tabular-nums'],
    marginTop: spacing.xs,
  },
  meta: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    marginTop: spacing.xs,
  },
  actions: {
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
  sectionLabel: {
    marginTop: spacing.sm,
  },
  pgn: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    lineHeight: 20,
  },
});
