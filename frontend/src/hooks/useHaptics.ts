/**
 * Hook for haptic feedback on mobile devices
 * Uses the Vibration API when available
 *
 * @example
 * ```tsx
 * const haptics = useHaptics();
 *
 * // Light tap feedback
 * <button onClick={() => { haptics.tap(); doAction(); }}>Tap</button>
 *
 * // Success feedback after operation
 * haptics.success();
 *
 * // Error feedback
 * haptics.error();
 *
 * // Selection feedback (very light)
 * haptics.select();
 * ```
 */
export function useHaptics() {
  const vibrate = (pattern: number | number[] = 10) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  };

  return {
    /** Light tap feedback - 10ms */
    tap: () => vibrate(10),
    /** Success feedback - double pulse */
    success: () => vibrate([10, 50, 10]),
    /** Error feedback - longer pulse */
    error: () => vibrate([50, 30, 50]),
    /** Selection feedback - very light 5ms */
    select: () => vibrate(5),
  };
}
