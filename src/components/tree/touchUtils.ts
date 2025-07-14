/**
 * iOS Touch Context Menu Utilities
 * 
 * This module provides utilities for detecting iOS devices and implementing
 * touch-based context menu alternatives where native context menus aren't supported.
 */

/**
 * Detects if the current device is an iOS device
 * 
 * @returns {boolean} True if running on iOS, false otherwise
 */
export const isIOS = (): boolean => {
  // Check for iOS user agent strings
  const userAgent = navigator.userAgent.toLowerCase();
  const isIOSUserAgent = /iphone|ipad|ipod/.test(userAgent);
  
  // Additional check for iOS 13+ on iPad which may report as desktop
  const isIOSPlatform = /ipad/.test(userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  
  return isIOSUserAgent || isIOSPlatform;
};

/**
 * Detects if the device supports touch events
 * 
 * @returns {boolean} True if touch is supported, false otherwise
 */
export const isTouchDevice = (): boolean => {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
};

/**
 * Detects if the device supports native context menus
 * iOS Safari doesn't support the contextmenu event reliably
 * 
 * @returns {boolean} True if context menus are supported, false otherwise
 */
export const supportsContextMenu = (): boolean => {
  return !isIOS();
};

/**
 * Touch gesture state for detecting long press
 */
interface TouchGestureState {
  startTime: number;
  startPosition: { x: number; y: number };
  isLongPress: boolean;
  timeoutId: number | null;
}

/**
 * Configuration for touch gesture detection
 */
export interface TouchGestureConfig {
  /** Duration in milliseconds for long press detection (default: 500ms) */
  longPressDuration?: number;
  /** Maximum movement in pixels before canceling long press (default: 10px) */
  maxMovement?: number;
}

/**
 * Creates a touch gesture handler for iOS context menu alternative
 * 
 * This handler detects long press gestures and provides a context menu alternative
 * for iOS devices that don't support native context menus.
 * 
 * @param onLongPress - Callback function to execute on long press
 * @param config - Configuration options for gesture detection
 * @returns Object with touch event handlers
 */
export const createTouchGestureHandler = (
  onLongPress: (event: TouchEvent) => void,
  config: TouchGestureConfig = {}
) => {
  const { longPressDuration = 500, maxMovement = 10 } = config;
  
  let gestureState: TouchGestureState | null = null;

  const handleTouchStart = (event: TouchEvent) => {
    // Only handle if this is a single touch and we're on iOS
    if (event.touches.length !== 1 || !isIOS()) {
      return;
    }

    const touch = event.touches[0];
    
    // Clear any existing gesture state
    if (gestureState?.timeoutId) {
      clearTimeout(gestureState.timeoutId);
    }

    // Initialize gesture state
    gestureState = {
      startTime: Date.now(),
      startPosition: { x: touch.clientX, y: touch.clientY },
      isLongPress: false,
      timeoutId: null
    };

    // Set up long press timeout
    gestureState.timeoutId = window.setTimeout(() => {
      if (gestureState) {
        gestureState.isLongPress = true;
        // Add haptic feedback on supported devices
        if ('vibrate' in navigator) {
          navigator.vibrate(50);
        }
        onLongPress(event);
      }
    }, longPressDuration);
  };

  const handleTouchMove = (event: TouchEvent) => {
    if (!gestureState || event.touches.length !== 1) {
      return;
    }

    const touch = event.touches[0];
    const deltaX = touch.clientX - gestureState.startPosition.x;
    const deltaY = touch.clientY - gestureState.startPosition.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // Cancel long press if movement exceeds threshold
    if (distance > maxMovement && gestureState.timeoutId) {
      clearTimeout(gestureState.timeoutId);
      gestureState.timeoutId = null;
    }
  };

  const handleTouchEnd = (event: TouchEvent) => {
    if (!gestureState) {
      return;
    }

    // Clean up timeout if it exists
    if (gestureState.timeoutId) {
      clearTimeout(gestureState.timeoutId);
    }

    // If this was a long press, prevent the default touch behavior
    if (gestureState.isLongPress) {
      event.preventDefault();
    }

    // Reset gesture state
    gestureState = null;
  };

  const handleTouchCancel = () => {
    if (gestureState?.timeoutId) {
      clearTimeout(gestureState.timeoutId);
    }
    gestureState = null;
  };

  return {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
    onTouchCancel: handleTouchCancel
  };
};