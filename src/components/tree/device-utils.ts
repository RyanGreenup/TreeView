/**
 * iOS Device Detection and Touch Utilities
 * 
 * Provides utilities for detecting iOS devices and handling touch events
 * to work around the lack of context menu support on iOS devices.
 */

/**
 * Detects if the current device is an iOS device (iPhone, iPad, iPod)
 * Uses both user agent detection and touch capability detection for reliability
 */
export const isIOSDevice = (): boolean => {
  // Primary detection: Check user agent for iOS devices
  const userAgent = navigator.userAgent.toLowerCase();
  const isIOSUserAgent = /iphone|ipad|ipod/.test(userAgent);
  
  // Secondary detection: Check for iOS-specific features
  const isIOSPlatform = /iphone|ipad|ipod/.test(navigator.platform?.toLowerCase() || '');
  
  // Additional check for newer iOS devices that might not be caught by user agent
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const isWebKit = /webkit/.test(userAgent);
  
  return isIOSUserAgent || isIOSPlatform || (isTouchDevice && isWebKit && !userAgent.includes('android'));
};

/**
 * Configuration for iOS touch context menu behavior
 */
export interface IOSTouchConfig {
  /** Duration in milliseconds for long press to trigger context menu */
  longPressDuration: number;
  /** Maximum movement allowed during long press (in pixels) */
  maxMovement: number;
  /** Whether to provide haptic feedback on long press */
  hapticFeedback: boolean;
}

export const defaultIOSTouchConfig: IOSTouchConfig = {
  longPressDuration: 500, // 500ms long press
  maxMovement: 10, // 10px movement tolerance
  hapticFeedback: true
};

/**
 * Touch event state for tracking long press gestures
 */
interface TouchState {
  startTime: number;
  startX: number;
  startY: number;
  timeoutId: number | null;
  isLongPress: boolean;
}

/**
 * Creates iOS-compatible touch event handlers for context menu activation
 * 
 * @param onContextMenu - Callback function to trigger when context menu should be shown
 * @param config - Configuration options for touch behavior
 * @returns Object containing touch event handlers
 */
export const createIOSTouchHandlers = (
  onContextMenu: (event: TouchEvent) => void,
  config: IOSTouchConfig = defaultIOSTouchConfig
) => {
  let touchState: TouchState = {
    startTime: 0,
    startX: 0,
    startY: 0,
    timeoutId: null,
    isLongPress: false
  };

  const cleanup = () => {
    if (touchState.timeoutId) {
      clearTimeout(touchState.timeoutId);
      touchState.timeoutId = null;
    }
    touchState.isLongPress = false;
  };

  const handleTouchStart = (event: TouchEvent) => {
    // Only handle single touch
    if (event.touches.length !== 1) {
      cleanup();
      return;
    }

    const touch = event.touches[0];
    touchState.startTime = Date.now();
    touchState.startX = touch.clientX;
    touchState.startY = touch.clientY;
    touchState.isLongPress = false;

    // Set timeout for long press detection
    touchState.timeoutId = window.setTimeout(() => {
      touchState.isLongPress = true;
      
      // Provide haptic feedback if supported and enabled
      if (config.hapticFeedback && navigator.vibrate) {
        navigator.vibrate(50); // Short vibration
      }
      
      // Trigger context menu
      onContextMenu(event);
    }, config.longPressDuration);
  };

  const handleTouchMove = (event: TouchEvent) => {
    if (!touchState.timeoutId || event.touches.length !== 1) {
      cleanup();
      return;
    }

    const touch = event.touches[0];
    const deltaX = Math.abs(touch.clientX - touchState.startX);
    const deltaY = Math.abs(touch.clientY - touchState.startY);

    // Cancel long press if movement exceeds threshold
    if (deltaX > config.maxMovement || deltaY > config.maxMovement) {
      cleanup();
    }
  };

  const handleTouchEnd = (event: TouchEvent) => {
    cleanup();
    
    // Prevent default click behavior if this was a long press
    if (touchState.isLongPress) {
      event.preventDefault();
    }
  };

  const handleTouchCancel = (event: TouchEvent) => {
    cleanup();
  };

  return {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
    onTouchCancel: handleTouchCancel
  };
};

/**
 * Utility function to create a unified context menu handler that works on both
 * desktop (right-click) and iOS (long-press) devices
 * 
 * @param callback - Function to call when context menu should be triggered
 * @param config - Optional configuration for iOS touch behavior
 * @returns Object with event handlers for both mouse and touch events
 */
export const createUnifiedContextMenuHandlers = (
  callback: (event: MouseEvent | TouchEvent) => void,
  config?: IOSTouchConfig
) => {
  const isIOS = isIOSDevice();
  
  // Standard context menu handler for desktop
  const handleContextMenu = (event: MouseEvent) => {
    event.preventDefault();
    callback(event);
  };

  // iOS touch handlers
  const iosTouchHandlers = isIOS 
    ? createIOSTouchHandlers(callback, config)
    : {
        onTouchStart: undefined,
        onTouchMove: undefined,
        onTouchEnd: undefined,
        onTouchCancel: undefined
      };

  return {
    // Always include context menu handler for desktop compatibility
    onContextMenu: handleContextMenu,
    
    // Include touch handlers only on iOS to avoid conflicts
    ...(isIOS && iosTouchHandlers)
  };
};