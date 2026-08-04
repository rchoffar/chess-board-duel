import { Text, StyleSheet, TextStyle, StyleProp } from 'react-native';
import { fontFamily, fontSize } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';

interface SectionLabelProps {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
  tone?: 'light' | 'dark';
}

export function SectionLabel({ children, style, tone = 'light' }: SectionLabelProps) {
  const { colors } = useTheme();
  return (
    <Text style={[styles.label, { color: tone === 'dark' ? colors.onDarkTertiary : colors.textTertiary }, style]}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.semibold,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
});
