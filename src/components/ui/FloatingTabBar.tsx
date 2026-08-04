import { useCallback } from 'react';
import { View, TouchableOpacity, StyleSheet, Platform, type LayoutChangeEvent } from 'react-native';
import { BlurView } from 'expo-blur';
import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
  withSpring,
  interpolate,
  Easing,
} from 'react-native-reanimated';

const DOT_SIZE = 4;
const HIGHLIGHT_TIMING = { duration: 180, easing: Easing.out(Easing.quad) };
const DOT_SPRING = { damping: 20, stiffness: 280 };

function TabBarButton({
  icon,
  isFocused,
  onPress,
}: {
  icon: React.ReactNode;
  isFocused: boolean;
  onPress: () => void;
}) {
  const focus = useDerivedValue(() => withTiming(isFocused ? 1 : 0, HIGHLIGHT_TIMING), [isFocused]);

  const highlightStyle = useAnimatedStyle(() => ({
    opacity: focus.value,
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(focus.value, [0, 1], [1, 1.06]) }],
  }));

  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.tab}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityState={{ selected: isFocused }}
    >
      <View style={styles.iconWrap}>
        <Animated.View style={[styles.iconHighlight, highlightStyle]} />
        <Animated.View style={iconStyle}>{icon}</Animated.View>
      </View>
    </TouchableOpacity>
  );
}

type FloatingTabBarProps = BottomTabBarProps;

export function FloatingTabBar({ state, descriptors, navigation }: FloatingTabBarProps) {
  const insets = useSafeAreaInsets();
  const bottom = insets.bottom > 0 ? insets.bottom + 8 : 20;

  const containerWidth = useSharedValue(0);
  const routeCount = state.routes.length;
  const activeIndex = useDerivedValue(() => withSpring(state.index, DOT_SPRING), [state.index]);

  const onTabsLayout = useCallback(
    (event: LayoutChangeEvent) => {
      containerWidth.value = event.nativeEvent.layout.width;
    },
    [containerWidth]
  );

  const dotStyle = useAnimatedStyle(() => {
    const tabWidth = containerWidth.value / routeCount;
    return {
      transform: [
        { translateX: activeIndex.value * tabWidth + (tabWidth - DOT_SIZE) / 2 },
      ],
    };
  });

  return (
    <View style={[styles.wrapper, { bottom }]} pointerEvents="box-none">
      <View style={styles.pill}>
        {Platform.OS === 'ios' ? (
          <BlurView intensity={24} tint="dark" style={StyleSheet.absoluteFill} />
        ) : (
          <View style={styles.androidBg} />
        )}
        <View style={styles.tint} />
        <View style={styles.border} />

        <View style={styles.row}>
          <View style={styles.tabs} onLayout={onTabsLayout}>
            {state.routes.map((route: { key: string; name: string }, index: number) => {
              const isFocused = state.index === index;
              const { options } = descriptors[route.key];

              const onPress = () => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!isFocused && !event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              };

              const icon = options.tabBarIcon?.({
                focused: isFocused,
                color: isFocused ? '#FFFFFF' : 'rgba(255, 255, 255, 0.50)',
                size: 22,
              });

              return (
                <TabBarButton key={route.key} icon={icon} isFocused={isFocused} onPress={onPress} />
              );
            })}
          </View>
        </View>

        <Animated.View style={[styles.activeDot, dotStyle]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 20,
    right: 20,
  },
  pill: {
    height: 68,
    borderRadius: 9999,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  androidBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(16, 17, 22, 0.94)',
  },
  tint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(16, 17, 22, 0.55)',
  },
  border: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabs: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 9999,
    backgroundColor: 'rgba(255, 255, 255, 0.13)',
  },
  activeDot: {
    // iconWrap (40) is centered in the 68-tall pill (top 14, bottom 54);
    // this sits just below it with a small gap
    position: 'absolute',
    top: 56,
    left: 0,
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: '#FFFFFF',
  },
});
