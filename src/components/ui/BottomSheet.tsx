import { useEffect, useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Pressable,
  Platform,
  KeyboardAvoidingView,
  Dimensions,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { fontFamily, fontSize, spacing } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SLIDE_TIMING = { duration: 380, easing: Easing.bezier(0.22, 1, 0.36, 1) };
const FADE_TIMING = { duration: 200, easing: Easing.linear };

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxHeightRatio?: number;
  scrollable?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
}

export function BottomSheet({
  visible,
  onClose,
  title,
  children,
  footer,
  maxHeightRatio = 0.85,
  scrollable = true,
  contentContainerStyle,
}: BottomSheetProps) {
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- mount immediately so the enter animation below has a target to animate
      setMounted(true);
      translateY.value = withTiming(0, SLIDE_TIMING);
      backdropOpacity.value = withTiming(1, FADE_TIMING);
    } else {
      translateY.value = withTiming(SCREEN_HEIGHT, SLIDE_TIMING);
      backdropOpacity.value = withTiming(0, FADE_TIMING, (finished) => {
        if (finished) runOnJS(setMounted)(false);
      });
    }
  }, [visible, translateY, backdropOpacity]);

  const handleClose = useCallback(() => onClose(), [onClose]);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  if (!mounted) return null;

  const body = (
    <>
      <View style={[styles.handle, { backgroundColor: colors.hairline }]} />
      {title ? (
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
          <TouchableOpacity style={[styles.closeBtn, { backgroundColor: colors.neutralTileBg }]} onPress={handleClose} activeOpacity={0.7}>
            <X size={18} color={colors.textSecondary} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={[styles.closeBtnFloating, { backgroundColor: colors.neutralTileBg }]} onPress={handleClose} activeOpacity={0.7}>
          <X size={18} color={colors.textSecondary} strokeWidth={2} />
        </TouchableOpacity>
      )}

      {scrollable ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, contentContainerStyle]}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, contentContainerStyle]}>{children}</View>
      )}

      {footer ? (
        <View style={[styles.footer, { borderTopColor: colors.hairline, paddingBottom: Math.max(spacing.md, insets.bottom) }]}>
          {footer}
        </View>
      ) : null}
    </>
  );

  return (
    <Modal transparent visible animationType="none" onRequestClose={handleClose} statusBarTranslucent>
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={handleClose}>
            {Platform.OS === 'ios' && <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />}
            <View style={styles.backdropTint} />
          </Pressable>
        </Animated.View>

        <Animated.View style={[styles.sheet, { maxHeight: SCREEN_HEIGHT * maxHeightRatio }, sheetStyle]}>
          {Platform.OS === 'ios' ? (
            <BlurView intensity={40} tint={scheme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[styles.androidFallback, { backgroundColor: colors.surface.sheetBg }]} />
          )}
          <View style={[styles.sheetOverlay, { backgroundColor: colors.surface.sheetBg }]} />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.sheetInner}
          >
            {body}
          </KeyboardAvoidingView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdropTint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(18, 20, 28, 0.42)',
  },
  sheet: {
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    overflow: 'hidden',
  },
  androidFallback: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheetOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: Platform.OS === 'ios' ? 1 : 0,
  },
  sheetInner: {
    flexShrink: 1,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.md,
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
  closeBtnFloating: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.base,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  content: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.xl,
  },
  footer: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    borderTopWidth: 1,
  },
});
