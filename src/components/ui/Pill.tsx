import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { fontFamily, fontSize, radius } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';

interface PillProps {
  label: string;
  tone?: 'neutral' | 'accent';
  style?: ViewStyle;
}

export function Pill({ label, tone = 'neutral', style }: PillProps) {
  const { colors } = useTheme();
  const isAccent = tone === 'accent';

  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: isAccent ? colors.accentTint : colors.neutralTileBg },
        style,
      ]}
    >
      <Text style={[styles.text, { color: isAccent ? colors.accent : colors.textTertiary }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  text: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.semibold,
  },
});
