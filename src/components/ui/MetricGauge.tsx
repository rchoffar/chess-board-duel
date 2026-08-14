import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
  useReducedMotion,
} from 'react-native-reanimated';
import { fontFamily, fontSize } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface MetricGaugeProps {
  /** Sweep fraction 0-100. Caller is responsible for any clamping (e.g. ROI can exceed 100%). */
  value: number;
  /** Raw value shown in the center label, e.g. "+42%" or "61%". */
  centerLabel: string;
  color: string;
  size?: number;
  strokeWidth?: number;
}

export function MetricGauge({ value, centerLabel, color, size = 88, strokeWidth = 8 }: MetricGaugeProps) {
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));

  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = reducedMotion
      ? clamped
      : withTiming(clamped, { duration: 800, easing: Easing.out(Easing.cubic) });
  }, [clamped, reducedMotion, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value / 100),
  }));

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.hairline}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={[styles.centerOverlay, { width: size - strokeWidth * 4, height: size - strokeWidth * 4 }]}>
        <Text
          style={[styles.centerText, { color: colors.textPrimary }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.4}
        >
          {centerLabel}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerOverlay: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerText: {
    fontSize: fontSize.lg,
    fontFamily: fontFamily.extrabold,
    fontVariant: ['tabular-nums'],
  },
});
