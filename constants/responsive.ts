/**
 * Lintnotes
 * - Purpose: Shared breakpoints, grid configurations, and scaling factors for responsive iPad layout.
 * - Exports: BREAKPOINTS, GRID_COLUMNS, SPACING_SCALE, FONT_SCALE, TOUCH_TARGET, Layout type
 * - Major deps: None (pure constants)
 * - Side effects: None
 */

export type DeviceType = 'phone' | 'tablet';
export type Orientation = 'portrait' | 'landscape';
export type Layout = 'phone' | 'tablet-portrait' | 'tablet-landscape';

/**
 * Breakpoint thresholds for device detection.
 * Tablet is defined as width >= 768 (standard iPad portrait width).
 */
export const BREAKPOINTS = {
  tablet: 768,
} as const;

/**
 * Number of columns for attendee grid based on layout.
 */
export const GRID_COLUMNS: Record<Layout, number> = {
  phone: 1,
  'tablet-portrait': 2,
  'tablet-landscape': 4,
};

/**
 * Spacing multiplier for padding/margins on larger screens.
 */
export const SPACING_SCALE: Record<DeviceType, number> = {
  phone: 1,
  tablet: 1.25,
};

/**
 * Font size multiplier for larger screens.
 */
export const FONT_SCALE: Record<DeviceType, number> = {
  phone: 1,
  tablet: 1.1,
};

/**
 * Minimum touch target sizes (in points) per Apple HIG.
 */
export const TOUCH_TARGET: Record<DeviceType, number> = {
  phone: 44,
  tablet: 48,
};

/**
 * Swipe gesture thresholds (in pixels).
 */
export const SWIPE_THRESHOLD: Record<DeviceType, number> = {
  phone: 72,
  tablet: 100,
};

/**
 * Modal maximum widths.
 */
export const MODAL_MAX_WIDTH: Record<DeviceType, number> = {
  phone: 9999, // No constraint on phone (uses screen width - padding)
  tablet: 500,
};

/**
 * Card dimensions for grid layout.
 */
export const CARD_DIMENSIONS = {
  minHeight: 120,
  padding: {
    phone: 12,
    tablet: 16,
  },
  gap: {
    phone: 8,
    tablet: 12,
  },
} as const;
