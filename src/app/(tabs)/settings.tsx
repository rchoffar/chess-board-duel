import { View, Text, StyleSheet, ScrollView, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { GlassCard } from '../../components/ui/GlassCard';
import { SectionLabel } from '../../components/ui/SectionLabel';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { fontFamily, fontSize, spacing } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';
import { useSettingsStore, MOVE_CONFIRM_OPTIONS } from '../../store/useSettingsStore';
import { useIsActiveTab } from '../../hooks/useIsActiveTab';

const enter = (delay: number) => FadeInDown.delay(delay).springify().damping(18).stiffness(140);

export default function SettingsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const isActive = useIsActiveTab();

  const moveConfirmMs = useSettingsStore((s) => s.moveConfirmMs);
  const allowTakeBack = useSettingsStore((s) => s.allowTakeBack);
  const beepOnCheck = useSettingsStore((s) => s.beepOnCheck);
  const boardSounds = useSettingsStore((s) => s.boardSounds);
  const setMoveConfirmMs = useSettingsStore((s) => s.setMoveConfirmMs);
  const setAllowTakeBack = useSettingsStore((s) => s.setAllowTakeBack);
  const setBeepOnCheck = useSettingsStore((s) => s.setBeepOnCheck);
  const setBoardSounds = useSettingsStore((s) => s.setBoardSounds);

  if (!isActive) return <View style={styles.screen} />;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg, paddingBottom: 120 }]}
      showsVerticalScrollIndicator={false}
    >
      <Animated.View entering={enter(0)}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Settings</Text>
      </Animated.View>

      <Animated.View entering={enter(60)}>
        <SectionLabel style={styles.sectionLabel}>Move detection</SectionLabel>
        <GlassCard>
          <Text style={[styles.settingTitle, { color: colors.textPrimary }]}>Confirmation delay</Text>
          <Text style={[styles.settingSub, { color: colors.textTertiary }]}>
            A piece must rest on its square this long before the move is recorded. Raise it if
            sliding pieces records squares you passed through.
          </Text>
          <View style={styles.control}>
            <SegmentedControl
              options={MOVE_CONFIRM_OPTIONS.map((ms) => ({ key: String(ms), label: `${ms / 1000}s` }))}
              value={String(moveConfirmMs)}
              onChange={(key) => setMoveConfirmMs(Number(key))}
            />
          </View>
          <View style={[styles.divider, { backgroundColor: colors.hairline }]} />
          <View style={styles.switchRow}>
            <View style={styles.switchInfo}>
              <Text style={[styles.settingTitle, { color: colors.textPrimary }]}>Allow take back</Text>
              <Text style={[styles.settingSub, { color: colors.textTertiary }]}>
                A quick recapture confirms the capture immediately, without waiting for the
                confirmation delay.
              </Text>
            </View>
            <Switch
              value={allowTakeBack}
              onValueChange={setAllowTakeBack}
              trackColor={{ true: colors.accent, false: colors.neutralTileBg }}
              thumbColor="#FFFFFF"
            />
          </View>
        </GlassCard>
      </Animated.View>

      <Animated.View entering={enter(120)}>
        <SectionLabel style={styles.sectionLabel}>Sounds</SectionLabel>
        <GlassCard>
          <View style={styles.switchRow}>
            <View style={styles.switchInfo}>
              <Text style={[styles.settingTitle, { color: colors.textPrimary }]}>Board sounds</Text>
              <Text style={[styles.settingSub, { color: colors.textTertiary }]}>
                The board buzzes on connection, game start and time out.
              </Text>
            </View>
            <Switch
              value={boardSounds}
              onValueChange={setBoardSounds}
              trackColor={{ true: colors.accent, false: colors.neutralTileBg }}
              thumbColor="#FFFFFF"
            />
          </View>
          <View style={[styles.divider, { backgroundColor: colors.hairline }]} />
          <View style={styles.switchRow}>
            <View style={styles.switchInfo}>
              <Text style={[styles.settingTitle, { color: colors.textPrimary }]}>Beep on check</Text>
              <Text style={[styles.settingSub, { color: colors.textTertiary }]}>
                The board beeps when a move gives check.
              </Text>
            </View>
            <Switch
              value={beepOnCheck}
              onValueChange={setBeepOnCheck}
              trackColor={{ true: colors.accent, false: colors.neutralTileBg }}
              thumbColor="#FFFFFF"
            />
          </View>
        </GlassCard>
      </Animated.View>
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
  settingTitle: {
    fontSize: fontSize.base,
    fontFamily: fontFamily.semibold,
  },
  settingSub: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    lineHeight: 18,
    marginTop: 2,
  },
  control: {
    marginTop: spacing.md,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  switchInfo: {
    flex: 1,
  },
  divider: {
    height: 1,
    marginVertical: spacing.md,
  },
});
