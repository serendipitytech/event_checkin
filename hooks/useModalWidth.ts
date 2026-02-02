/**
 * Lintnotes
 * - Purpose: Hook for calculating appropriate modal width based on device type.
 * - Exports: useModalWidth (hook)
 * - Major deps: hooks/useDeviceLayout, constants/responsive
 * - Side effects: None
 */
import { useDeviceLayout } from './useDeviceLayout';
import { MODAL_MAX_WIDTH } from '../constants/responsive';

/**
 * Returns the appropriate modal width for the current device.
 * On phone: full width minus padding (48px total)
 * On tablet: constrained to max width (500px) or screen width minus padding, whichever is smaller
 *
 * @param horizontalPadding - Total horizontal padding (default 48 = 24px each side)
 */
export const useModalWidth = (horizontalPadding: number = 48): number => {
  const { width, deviceType } = useDeviceLayout();

  const maxWidth = MODAL_MAX_WIDTH[deviceType];
  const availableWidth = width - horizontalPadding;

  return Math.min(availableWidth, maxWidth);
};

export default useModalWidth;
