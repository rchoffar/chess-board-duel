import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Bluetooth, BluetoothConnected, BatteryMedium, Swords, ChevronRight } from 'lucide-react-native';
import { GlassCard } from '../../components/ui/GlassCard';
import { SectionLabel } from '../../components/ui/SectionLabel';
import { fontFamily, fontSize, radius, spacing } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';
import { useBoardStore } from '../../store/useBoardStore';
import { useFocusAnimKey } from '../../hooks/useFocusAnimKey';
import { listGames, type GameRecord } from '../../db/games';
import { timeControlLabel } from '../../chess/clock';

const enter = (delay: number) => FadeInDown.delay(delay).springify().damping(18).stiffness(140);

export default function HomeScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const animKey = useFocusAnimKey();

  const status = useBoardStore((s) => s.status);
  const deviceName = useBoardStore((s) => s.deviceName);
  const battery = useBoardStore((s) => s.battery);
  const error = useBoardStore((s) => s.error);
  const connect = useBoardStore((s) => s.connect);
  const disconnect = useBoardStore((s) => s.disconnect);

  const [recentGames, setRecentGames] = useState<GameRecord[]>([]);
  useFocusEffect(
    useCallback(() => {
      setRecentGames(listGames().slice(0, 3));
    }, [])
  );

  const connected = status === 'connected';
  const busy = status === 'scanning' || status === 'connecting';

  return (
    <ScrollView
      key={animKey}
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg, paddingBottom: 120 }]}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View entering={enter(0)}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Play</Text>
      </Animated.View>

      <Animated.View entering={enter(60)}>
        <SectionLabel style={styles.sectionLabel}>Board</SectionLabel>
        <GlassCard variant="dark">
          <View style={styles.connectionRow}>
            <View style={[styles.iconTile, { backgroundColor: connected ? colors.accentTint : colors.neutralTileBg }]}>
              {connected ? (
                <BluetoothConnected size={20} color={colors.accent} strokeWidth={2} />
              ) : (
                <Bluetooth size={20} color={colors.onDarkSecondary} strokeWidth={2} />
              )}
            </View>
            <View style={styles.connectionInfo}>
              <Text style={[styles.connectionTitle, { color: colors.onDarkPrimary }]}>
                {connected ? (deviceName ?? 'Chessnut board') : busy ? (status === 'scanning' ? 'Searching…' : 'Connecting…') : 'Not connected'}
              </Text>
              {connected && battery ? (
                <View style={styles.batteryRow}>
                  <BatteryMedium size={14} color={colors.onDarkSecondary} strokeWidth={2} />
                  <Text style={[styles.batteryText, { color: colors.onDarkSecondary }]}>
                    {battery.percent}%{battery.charging ? ' · charging' : ''}
                  </Text>
                </View>
              ) : (
                <Text style={[styles.connectionSub, { color: colors.onDarkSecondary }]}>
                  {busy ? 'Make sure the board is on' : error ?? 'Turn on your Chessnut board'}
                </Text>
              )}
            </View>
            <TouchableOpacity
              style={[styles.connectBtn, connected ? { borderColor: colors.onDarkHairline, borderWidth: 1 } : { backgroundColor: colors.accentBright }]}
              onPress={() => (connected ? disconnect() : connect().catch(() => {}))}
              disabled={busy}
              activeOpacity={0.8}
            >
              <Text style={[styles.connectBtnText, { color: connected ? colors.onDarkPrimary : '#0A0A0F' }]}>
                {connected ? 'Disconnect' : busy ? '…' : 'Connect'}
              </Text>
            </TouchableOpacity>
          </View>
        </GlassCard>
      </Animated.View>

      <Animated.View entering={enter(120)}>
        <TouchableOpacity
          activeOpacity={0.85}
          disabled={!connected}
          onPress={() => router.push('/new-game')}
          style={!connected && styles.disabled}
        >
          <GlassCard variant="dark">
            <View style={styles.ctaRow}>
              <View style={[styles.iconTile, { backgroundColor: colors.accentTint }]}>
                <Swords size={20} color={colors.accent} strokeWidth={2} />
              </View>
              <View style={styles.connectionInfo}>
                <Text style={[styles.ctaTitle, { color: colors.onDarkPrimary }]}>New game</Text>
                <Text style={[styles.connectionSub, { color: colors.onDarkSecondary }]}>
                  {connected ? 'Two players, over the board' : 'Connect the board first'}
                </Text>
              </View>
              <ChevronRight size={20} color={colors.onDarkTertiary} strokeWidth={2} />
            </View>
          </GlassCard>
        </TouchableOpacity>
      </Animated.View>

      {recentGames.length > 0 && (
        <Animated.View entering={enter(180)}>
          <SectionLabel style={styles.sectionLabel}>Recent games</SectionLabel>
          <View style={styles.recentList}>
            {recentGames.map((game) => (
              <TouchableOpacity key={game.id} activeOpacity={0.8} onPress={() => router.push(`/game/${game.id}`)}>
                <GlassCard padding={0}>
                  <View style={styles.recentRow}>
                    <View style={styles.connectionInfo}>
                      <Text style={[styles.recentTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                        {game.white} vs {game.black}
                      </Text>
                      <Text style={[styles.connectionSub, { color: colors.textTertiary }]}>
                        {new Date(game.startedAt).toLocaleDateString()} · {timeControlLabel({ baseMinutes: game.baseMinutes, incrementSeconds: game.incrementSeconds })}
                      </Text>
                    </View>
                    <Text style={[styles.recentResult, { color: colors.accent }]}>{game.result}</Text>
                  </View>
                </GlassCard>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>
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
    gap: spacing.lg,
  },
  title: {
    fontSize: fontSize.display,
    fontFamily: fontFamily.display,
    letterSpacing: -1,
  },
  sectionLabel: {
    marginBottom: spacing.sm,
  },
  connectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectionInfo: {
    flex: 1,
    gap: 2,
  },
  connectionTitle: {
    fontSize: fontSize.base,
    fontFamily: fontFamily.semibold,
  },
  ctaTitle: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.bold,
  },
  connectionSub: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
  },
  batteryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  batteryText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.medium,
    fontVariant: ['tabular-nums'],
  },
  connectBtn: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
  },
  connectBtnText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.bold,
  },
  disabled: {
    opacity: 0.5,
  },
  recentList: {
    gap: spacing.md,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  recentTitle: {
    fontSize: fontSize.base,
    fontFamily: fontFamily.semibold,
  },
  recentResult: {
    fontSize: fontSize.base,
    fontFamily: fontFamily.bold,
    fontVariant: ['tabular-nums'],
  },
});
