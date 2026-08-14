import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { SectionLabel } from '../components/ui/SectionLabel';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { Stepper } from '../components/ui/Stepper';
import { PlayerSelector } from '../components/players/PlayerSelector';
import { fontFamily, fontSize, radius, spacing } from '../design-system/theme';
import { useTheme } from '../design-system/ThemeProvider';
import { useGameStore } from '../store/useGameStore';
import { createPlayer, listPlayers, type Player } from '../db/players';
import { listGames } from '../db/games';
import type { Variant } from '../chess/chess960';
import type { TimeControl } from '../chess/clock';

const PRESETS: { label: string; tc: TimeControl }[] = [
  { label: '3+2', tc: { baseMinutes: 3, incrementSeconds: 2 } },
  { label: '5+0', tc: { baseMinutes: 5, incrementSeconds: 0 } },
  { label: '5+3', tc: { baseMinutes: 5, incrementSeconds: 3 } },
  { label: '10+5', tc: { baseMinutes: 10, incrementSeconds: 5 } },
  { label: '15+10', tc: { baseMinutes: 15, incrementSeconds: 10 } },
  { label: '30+0', tc: { baseMinutes: 30, incrementSeconds: 0 } },
];

type ClockMode = 'same' | 'perPlayer';

function TimeControlEditor({
  value,
  onChange,
}: {
  value: TimeControl;
  onChange: (tc: TimeControl) => void;
}) {
  const { colors } = useTheme();
  const isActive = (tc: TimeControl) =>
    tc.baseMinutes === value.baseMinutes && tc.incrementSeconds === value.incrementSeconds;

  return (
    <View style={styles.editor}>
      <View style={styles.presets}>
        {PRESETS.map(({ label, tc }) => {
          const active = isActive(tc);
          return (
            <TouchableOpacity
              key={label}
              style={[
                styles.preset,
                { backgroundColor: active ? colors.accentTint : colors.neutralTileBg },
                active && { borderColor: colors.accent, borderWidth: 1 },
              ]}
              onPress={() => onChange({ ...tc })}
              activeOpacity={0.8}
            >
              <Text style={[styles.presetText, { color: active ? colors.accent : colors.textSecondary }]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.steppers}>
        <Stepper
          label="Minutes"
          value={value.baseMinutes}
          min={1}
          max={120}
          onDecrement={() =>
            onChange({ ...value, baseMinutes: Math.max(1, value.baseMinutes - 1) })
          }
          onIncrement={() =>
            onChange({ ...value, baseMinutes: Math.min(120, value.baseMinutes + 1) })
          }
        />
        <Stepper
          label="Increment (s)"
          value={value.incrementSeconds}
          min={0}
          max={60}
          onDecrement={() =>
            onChange({ ...value, incrementSeconds: Math.max(0, value.incrementSeconds - 1) })
          }
          onIncrement={() =>
            onChange({ ...value, incrementSeconds: Math.min(60, value.incrementSeconds + 1) })
          }
        />
      </View>
    </View>
  );
}

export default function NewGameScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const startGame = useGameStore((s) => s.startGame);

  const [variant, setVariant] = useState<Variant>('standard');
  const [clockMode, setClockMode] = useState<ClockMode>('same');
  const [whiteTc, setWhiteTc] = useState<TimeControl>({ baseMinutes: 10, incrementSeconds: 5 });
  const [blackTc, setBlackTc] = useState<TimeControl>({ baseMinutes: 10, incrementSeconds: 5 });
  const [players, setPlayers] = useState<Player[]>(() => listPlayers());

  // Preselect the pairing of the most recent game.
  const lastGame = useMemo(() => listGames()[0] ?? null, []);
  const [whiteId, setWhiteId] = useState<number | null>(
    lastGame?.whiteId != null && players.some((p) => p.id === lastGame.whiteId) ? lastGame.whiteId : null
  );
  const [blackId, setBlackId] = useState<number | null>(
    lastGame?.blackId != null && players.some((p) => p.id === lastGame.blackId) ? lastGame.blackId : null
  );

  const create = (name: string): Player | null => {
    const player = createPlayer(name);
    if (player && !players.some((p) => p.id === player.id)) {
      setPlayers((prev) => [player, ...prev]);
    }
    return player;
  };

  const nameOf = (id: number | null, fallback: string) =>
    players.find((p) => p.id === id)?.name ?? fallback;

  const setMode = (mode: ClockMode) => {
    // Entering per-player mode starts from the shared control.
    if (mode === 'perPlayer' && clockMode === 'same') setBlackTc({ ...whiteTc });
    setClockMode(mode);
  };

  const start = () => {
    startGame({
      white: nameOf(whiteId, 'White'),
      black: nameOf(blackId, 'Black'),
      whiteId,
      blackId,
      timeControls: { w: whiteTc, b: clockMode === 'perPlayer' ? blackTc : whiteTc },
      variant,
    });
    router.replace('/game');
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.surface.sheetBg }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>New game</Text>
          <TouchableOpacity
            style={[styles.closeBtn, { backgroundColor: colors.neutralTileBg }]}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <X size={18} color={colors.textSecondary} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        <SectionLabel style={styles.label}>Variant</SectionLabel>
        <SegmentedControl<Variant>
          options={[
            { key: 'standard', label: 'Standard' },
            { key: 'chess960', label: 'Chess960' },
          ]}
          value={variant}
          onChange={setVariant}
        />
        {variant === 'chess960' && (
          <Text style={[styles.hint, { color: colors.textTertiary }]}>
            Random start position — the app guides the setup with the board LEDs.
          </Text>
        )}

        <SectionLabel style={styles.label}>Time control</SectionLabel>
        <SegmentedControl<ClockMode>
          options={[
            { key: 'same', label: 'Same for both' },
            { key: 'perPlayer', label: 'Per player' },
          ]}
          value={clockMode}
          onChange={setMode}
        />

        {clockMode === 'same' ? (
          <TimeControlEditor value={whiteTc} onChange={setWhiteTc} />
        ) : (
          <>
            <SectionLabel style={styles.label}>White clock</SectionLabel>
            <TimeControlEditor value={whiteTc} onChange={setWhiteTc} />
            <SectionLabel style={styles.label}>Black clock</SectionLabel>
            <TimeControlEditor value={blackTc} onChange={setBlackTc} />
          </>
        )}

        <SectionLabel style={styles.label}>White</SectionLabel>
        <PlayerSelector players={players} selectedId={whiteId} onSelect={setWhiteId} onCreate={create} />

        <SectionLabel style={styles.label}>Black</SectionLabel>
        <PlayerSelector players={players} selectedId={blackId} onSelect={setBlackId} onCreate={create} />

        <TouchableOpacity
          style={[styles.startBtn, { backgroundColor: colors.accentBright }]}
          onPress={start}
          activeOpacity={0.85}
        >
          <Text style={styles.startBtnText}>Start game</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: fontSize.displaySheet,
    fontFamily: fontFamily.display,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    marginTop: spacing.md,
  },
  hint: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
  },
  editor: {
    gap: spacing.md,
  },
  presets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  preset: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.full,
  },
  presetText: {
    fontSize: fontSize.base,
    fontFamily: fontFamily.bold,
    fontVariant: ['tabular-nums'],
  },
  steppers: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  startBtn: {
    marginTop: spacing.xl,
    borderRadius: radius.md,
    paddingVertical: spacing.base,
    alignItems: 'center',
  },
  startBtnText: {
    color: '#0A0A0F',
    fontSize: fontSize.md,
    fontFamily: fontFamily.bold,
  },
});
