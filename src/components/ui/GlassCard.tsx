import { View, StyleSheet, ViewStyle, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { radius, shadow } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';

type Variant = 'light' | 'dark';

interface GlassCardProps {
  children: React.ReactNode;
  variant?: Variant;
  style?: ViewStyle;
  padding?: number;
}

export function GlassCard({ children, variant = 'light', style, padding = 16 }: GlassCardProps) {
  const { scheme, colors } = useTheme();

  if (variant === 'dark') {
    return (
      <View style={[styles.darkBase, { borderColor: colors.surface.darkGlassBorder }, styles.overflow, { padding }, style]}>
        <LinearGradient
          colors={['#20222A', '#101116']}
          start={{ x: 0.15, y: 0 }}
          end={{ x: 0.85, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.darkBorder, { borderColor: colors.surface.darkGlassBorder }]} />
        <View style={styles.inner}>{children}</View>
      </View>
    );
  }

  if (Platform.OS === 'ios') {
    return (
      <View style={[styles.lightBase, { borderColor: colors.surface.lightGlassBorder }, styles.overflow, { padding }, style]}>
        <BlurView intensity={28} tint={scheme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        <View style={[styles.lightTint, { backgroundColor: colors.surface.lightGlassBg }]} />
        <View style={[styles.lightBorder, { borderColor: colors.surface.lightGlassBorder }]} />
        <View style={styles.inner}>{children}</View>
      </View>
    );
  }

  return (
    <View style={[styles.lightBase, { borderColor: colors.surface.lightGlassBorder, backgroundColor: colors.surface.sheetBg }, { padding }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  lightBase: {
    borderRadius: radius.xl,
    borderWidth: 1,
    ...shadow.light,
  },
  lightTint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  darkBase: {
    borderRadius: radius['2xl'],
    borderWidth: 1,
    ...shadow.dark,
  },
  overflow: {
    overflow: 'hidden',
  },
  inner: {},
  lightBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radius.xl,
    borderWidth: 1,
  },
  darkBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radius['2xl'],
    borderWidth: 1,
  },
});
