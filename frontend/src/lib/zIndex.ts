/**
 * Centralized z-index scale for consistent layering across the app.
 * This prevents z-index collisions that cause iOS Safari navigation issues.
 *
 * @module lib/zIndex
 */

export const Z_INDEX = {
  // Layer 1: Base content
  content: 0,

  // Layer 2: Elevated elements
  dropdown: 100,
  sticky: 200,

  // Layer 3: Overlays
  overlay: 300,
  sidebar: 400,

  // Layer 4: Fixed navigation
  bottomNav: 500,
  header: 510,

  // Layer 5: Modals (above navigation)
  modalOverlay: 590,
  modal: 600,

  // Layer 6: Tooltips & Popovers
  tooltip: 700,

  // Layer 7: Notifications & Toasts
  toast: 800,

  // Layer 8: Critical overlays
  criticalOverlay: 900,

  // Layer 9: iOS Install Instructions (maximum)
  iosInstall: 1000,
} as const;

export type ZIndexKey = keyof typeof Z_INDEX;
