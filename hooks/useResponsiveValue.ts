/**
 * Lintnotes
 * - Purpose: Hook for selecting values based on current device layout (responsive value picker).
 * - Exports: useResponsiveValue (hook), ResponsiveValues type
 * - Major deps: hooks/useDeviceLayout, constants/responsive
 * - Side effects: None (derived from useDeviceLayout)
 */
import { useDeviceLayout } from './useDeviceLayout';
import type { Layout, DeviceType } from '../constants/responsive';

/**
 * Configuration object for responsive values.
 * Can specify values by exact layout or by device type.
 */
export type ResponsiveValues<T> = {
  phone: T;
  tabletPortrait?: T;
  tabletLandscape?: T;
  tablet?: T; // Fallback for both tablet orientations
};

/**
 * Hook that returns the appropriate value based on current device layout.
 *
 * @example
 * const columns = useResponsiveValue({ phone: 1, tabletPortrait: 2, tabletLandscape: 4 });
 *
 * @example
 * const padding = useResponsiveValue({ phone: 12, tablet: 16 });
 */
export const useResponsiveValue = <T>(values: ResponsiveValues<T>): T => {
  const { layout } = useDeviceLayout();

  switch (layout) {
    case 'tablet-landscape':
      return values.tabletLandscape ?? values.tablet ?? values.phone;
    case 'tablet-portrait':
      return values.tabletPortrait ?? values.tablet ?? values.phone;
    case 'phone':
    default:
      return values.phone;
  }
};

/**
 * Non-hook version for use in StyleSheet.create or outside components.
 * Requires layout to be passed explicitly.
 */
export const getResponsiveValue = <T>(
  values: ResponsiveValues<T>,
  layout: Layout
): T => {
  switch (layout) {
    case 'tablet-landscape':
      return values.tabletLandscape ?? values.tablet ?? values.phone;
    case 'tablet-portrait':
      return values.tabletPortrait ?? values.tablet ?? values.phone;
    case 'phone':
    default:
      return values.phone;
  }
};

/**
 * Hook that returns scaled value based on device type.
 * Useful for spacing and font sizes.
 *
 * @example
 * const fontSize = useScaledValue(16, { phone: 1, tablet: 1.1 });
 */
export const useScaledValue = (
  baseValue: number,
  scale: Record<DeviceType, number>
): number => {
  const { deviceType } = useDeviceLayout();
  return baseValue * scale[deviceType];
};

export default useResponsiveValue;
