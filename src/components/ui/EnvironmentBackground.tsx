import { StyleSheet, useWindowDimensions } from 'react-native';
import { Canvas, Rect, RadialGradient, LinearGradient, vec } from '@shopify/react-native-skia';
import { useTheme } from '../../design-system/ThemeProvider';

/**
 * Full-screen layered gradient — the room behind the frosted glass.
 * True radial gradients via Skia (warm top-left, cool top-right, warm floor)
 * over a linear base — RN has no native radial-gradient primitive otherwise.
 * Same structure in both schemes, different (light vs dark) palette.
 */
export function EnvironmentBackground() {
  const { scheme } = useTheme();
  const { width, height } = useWindowDimensions();
  const maxDim = Math.max(width, height);

  const base = scheme === 'dark'
    ? ['#15161B', '#101114', '#0B0C0E']
    : ['#D7E0E9', '#E9E6DE', '#DCCFBE'];
  const topLeft = scheme === 'dark'
    ? ['rgba(60, 70, 92, 0.55)', 'rgba(60, 70, 92, 0)']
    : ['rgba(255, 253, 247, 0.95)', 'rgba(255, 253, 247, 0)'];
  const topRight = scheme === 'dark'
    ? ['rgba(35, 75, 62, 0.5)', 'rgba(35, 75, 62, 0)']
    : ['rgba(226, 236, 246, 0.9)', 'rgba(226, 236, 246, 0)'];
  const bottom = scheme === 'dark'
    ? ['rgba(70, 55, 42, 0.5)', 'rgba(70, 55, 42, 0)']
    : ['rgba(205, 192, 173, 0.9)', 'rgba(205, 192, 173, 0)'];

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Rect x={0} y={0} width={width} height={height}>
        <LinearGradient
          start={vec(width * 0.1, 0)}
          end={vec(width * 0.9, height)}
          colors={base}
        />
      </Rect>

      <Rect x={0} y={0} width={width} height={height}>
        <RadialGradient c={vec(width * 0.19, height * 0.04)} r={maxDim * 0.6} colors={topLeft} />
      </Rect>

      <Rect x={0} y={0} width={width} height={height}>
        <RadialGradient c={vec(width * 0.84, height * 0.03)} r={maxDim * 0.55} colors={topRight} />
      </Rect>

      <Rect x={0} y={0} width={width} height={height}>
        <RadialGradient c={vec(width * 0.5, height * 1.12)} r={maxDim * 0.75} colors={bottom} />
      </Rect>
    </Canvas>
  );
}
