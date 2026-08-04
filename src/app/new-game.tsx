import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { SectionLabel } from '../components/ui/SectionLabel';
import { Stepper } from '../components/ui/Stepper';
import { fontFamily, fontSize, radius, spacing } from '../design-system/theme';
import { useTheme } from '../design-system/ThemeProvider';
import { useGameStore } from '../store/useGameStore';
import type { TimeControl } from '../chess/clock';

const PRESETS: { label: string; tc: TimeControl }[] = [
  { label: '3+2', tc: { baseMinutes: 3, incrementSeconds: 2 } },
  { label: '5+0', tc: { baseMinutes: 5, incrementSeconds: 0 } },
  { label: '5+3', tc: { baseMinutes: 5, incrementSeconds: 3 } },
  { label: '10+5', tc: { baseMinutes: 10, incrementSeconds: 5 } },
  { label: '15+10', tc: { baseMinutes: 15, incrementSeconds: 10 } },
  { label: '30+0', tc: { baseMinutes: 30, incrementSeconds: 0 } },
];

export default function NewGameScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const startGame = useGameStore((s) => s.startGame);

  const [baseMinutes, setBaseMinutes] = useState(10);
  const [incrementSeconds, setIncrementSeconds] = useState(5);
  const [white, setWhite] = useState('');
  const [black, setBlack] = useState('');

  const isPresetActive = (tc: TimeControl) =>
    tc.baseMinutes === baseMinutes && tc.incrementSeconds === incrementSeconds;

  const start = () => {
    startGame({
      white: white.trim() || 'White',
      black: black.trim() || 'Black',
      timeControl: { baseMinutes, incrementSeconds },
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

        <SectionLabel style={styles.label}>Time control</SectionLabel>
        <View style={styles.presets}>
          {PRESETS.map(({ label, tc }) => {
            const active = isPresetActive(tc);
            return (
              <TouchableOpacity
                key={label}
                style={[
                  styles.preset,
                  { backgroundColor: active ? colors.accentTint : colors.neutralTileBg },
                  active && { borderColor: colors.accent, borderWidth: 1 },
                ]}
                onPress={() => {
                  setBaseMinutes(tc.baseMinutes);
                  setIncrementSeconds(tc.incrementSeconds);
                }}
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
            value={baseMinutes}
            min={1}
            max={120}
            onDecrement={() => setBaseMinutes((v) => Math.max(1, v - 1))}
            onIncrement={() => setBaseMinutes((v) => Math.min(120, v + 1))}
          />
          <Stepper
            label="Increment (s)"
            value={incrementSeconds}
            min={0}
            max={60}
            onDecrement={() => setIncrementSeconds((v) => Math.max(0, v - 1))}
            onIncrement={() => setIncrementSeconds((v) => Math.min(60, v + 1))}
          />
        </View>

        <SectionLabel style={styles.label}>Players</SectionLabel>
        <View style={styles.fields}>
          <TextInput
            style={[styles.field, { backgroundColor: colors.surface.fieldBg, borderColor: colors.surface.fieldBorder, color: colors.textPrimary }]}
            placeholder="White player"
            placeholderTextColor={colors.textTertiary}
            value={white}
            onChangeText={setWhite}
            returnKeyType="next"
          />
          <TextInput
            style={[styles.field, { backgroundColor: colors.surface.fieldBg, borderColor: colors.surface.fieldBorder, color: colors.textPrimary }]}
            placeholder="Black player"
            placeholderTextColor={colors.textTertiary}
            value={black}
            onChangeText={setBlack}
            returnKeyType="done"
          />
        </View>

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
  fields: {
    gap: spacing.sm,
  },
  field: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    fontSize: fontSize.md,
    fontFamily: fontFamily.medium,
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
