import { StyleSheet } from 'react-native';
import { Canvas, Rect, RadialGradient, vec } from '@shopify/react-native-skia';

interface GlowBlobProps {
  color?: string;
  size?: number;
  top?: number;
  right?: number;
}

/** A soft, edge-free radial glow (Skia radial gradient — a clipped linear gradient always shows a hard boundary). */
export function GlowBlob({ color = 'rgba(23, 229, 138, 0.4)', size = 260, top = -60, right = -70 }: GlowBlobProps) {
  return (
    <Canvas style={[styles.canvas, { width: size, height: size, top, right }]} pointerEvents="none">
      <Rect x={0} y={0} width={size} height={size}>
        <RadialGradient
          c={vec(size / 2, size / 2)}
          r={size / 2}
          colors={[color, 'rgba(0, 0, 0, 0)']}
        />
      </Rect>
    </Canvas>
  );
}

const styles = StyleSheet.create({
  canvas: {
    position: 'absolute',
  },
});
