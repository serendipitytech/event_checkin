/**
 * Lintnotes
 * - Purpose: Hook for detecting device type, orientation, and layout mode for responsive iPad support.
 * - Exports: useDeviceLayout (hook), getLayoutFromDimensions (utility)
 * - Major deps: React useWindowDimensions, constants/responsive
 * - Side effects: None (reactive to window dimension changes)
 */
import { useWindowDimensions } from 'react-native';
import {
  BREAKPOINTS,
  GRID_COLUMNS,
  type DeviceType,
  type Layout,
  type Orientation,
} from '../constants/responsive';
import { useFeatureFlag } from './useSettings';

export type DeviceLayoutInfo = {
  deviceType: DeviceType;
  orientation: Orientation;
  layout: Layout;
  width: number;
  height: number;
  isTablet: boolean;
  isLandscape: boolean;
  columns: number;
  iPadLayoutEnabled: boolean;
};

/**
 * Determines layout from screen dimensions.
 * Exported for testing and use outside React components.
 */
export const getLayoutFromDimensions = (
  width: number,
  height: number
): { deviceType: DeviceType; orientation: Orientation; layout: Layout } => {
  const isTablet = width >= BREAKPOINTS.tablet || height >= BREAKPOINTS.tablet;
  const isLandscape = width > height;

  const deviceType: DeviceType = isTablet ? 'tablet' : 'phone';
  const orientation: Orientation = isLandscape ? 'landscape' : 'portrait';

  let layout: Layout;
  if (!isTablet) {
    layout = 'phone';
  } else if (isLandscape) {
    layout = 'tablet-landscape';
  } else {
    layout = 'tablet-portrait';
  }

  return { deviceType, orientation, layout };
};

/**
 * Hook providing comprehensive device layout information.
 * Automatically updates when screen dimensions or orientation changes.
 * Respects the enableiPadLayout feature flag.
 */
export const useDeviceLayout = (): DeviceLayoutInfo => {
  const { width, height } = useWindowDimensions();
  const iPadLayoutEnabled = useFeatureFlag('enableiPadLayout');

  const { deviceType, orientation, layout } = getLayoutFromDimensions(width, height);

  // If iPad layout is disabled, treat everything as phone
  const effectiveDeviceType = iPadLayoutEnabled ? deviceType : 'phone';
  const effectiveLayout = iPadLayoutEnabled ? layout : 'phone';

  return {
    deviceType: effectiveDeviceType,
    orientation,
    layout: effectiveLayout,
    width,
    height,
    isTablet: effectiveDeviceType === 'tablet',
    isLandscape: orientation === 'landscape',
    columns: GRID_COLUMNS[effectiveLayout],
    iPadLayoutEnabled,
  };
};

export default useDeviceLayout;
