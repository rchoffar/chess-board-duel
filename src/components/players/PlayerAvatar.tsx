import { View, Text, StyleSheet } from 'react-native';
import { fontFamily } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';

export function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((word) => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function PlayerAvatar({ name, size = 40 }: { name: string; size?: number }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.circle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.accentTint },
      ]}
    >
      <Text style={[styles.initials, { color: colors.accent, fontSize: size * 0.38 }]}>
        {initialsOf(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontFamily: fontFamily.bold,
  },
});
