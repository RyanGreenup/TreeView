/**
 * Touch Context Menu Component
 * 
 * A touch-friendly context menu implementation for iOS devices that don't support
 * native context menus. This component provides a modal-style menu that appears
 * on long press gestures.
 */

import { createSignal, onMount, onCleanup, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { TreeNode } from "./types";

export interface TouchContextMenuProps {
  /** The tree node for which the context menu is shown */
  node: TreeNode | null;
  /** Whether the context menu is visible */
  isVisible: boolean;
  /** Position where the context menu should appear */
  position: { x: number; y: number };
  /** Callback to close the context menu */
  onClose: () => void;
  /** Callback for cut action */
  onCut: (nodeId: string) => void;
  /** Callback for paste action */
  onPaste: (nodeId: string) => void;
  /** Callback for rename action */
  onRename: (nodeId: string) => void;
  /** Callback for create new child action */
  onCreateNew: (parentId: string) => void;
  /** Callback for delete action */
  onDelete: (nodeId: string) => void;
  /** Callback for move to root action */
  onMoveToRoot: (nodeId: string) => void;
  /** Whether there's a node currently cut (for paste availability) */
  hasCutNode: boolean;
}

/**
 * Touch-friendly context menu for iOS devices
 * 
 * This component renders a modal overlay with action buttons optimized for touch interaction.
 * It provides haptic feedback and follows iOS design patterns for better user experience.
 */
export const TouchContextMenu = (props: TouchContextMenuProps) => {
  const [isAnimating, setIsAnimating] = createSignal(false);
  let overlayRef: HTMLDivElement | undefined;

  // Handle animation states
  onMount(() => {
    if (props.isVisible) {
      setIsAnimating(true);
      // Small delay to ensure smooth animation
      setTimeout(() => setIsAnimating(false), 100);
    }
  });

  // Close menu when clicking outside
  const handleOverlayClick = (e: MouseEvent) => {
    if (e.target === overlayRef) {
      props.onClose();
    }
  };

  // Close menu on escape key
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      props.onClose();
    }
  };

  onMount(() => {
    document.addEventListener("keydown", handleKeyDown);
  });

  onCleanup(() => {
    document.removeEventListener("keydown", handleKeyDown);
  });

  // Menu action handlers with haptic feedback
  const handleAction = (action: () => void) => {
    // Provide haptic feedback on supported devices
    if ('vibrate' in navigator) {
      navigator.vibrate(25);
    }
    action();
    props.onClose();
  };

  return (
    <Show when={props.isVisible && props.node}>
      <Portal>
        <div
          ref={overlayRef}
          class="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          classList={{
            "animate-fade-in": isAnimating(),
          }}
          onClick={handleOverlayClick}
        >
          {/* iOS-style action sheet */}
          <div class="fixed bottom-0 left-0 right-0 bg-base-100 rounded-t-2xl shadow-2xl animate-slide-up">
            {/* Handle bar for visual feedback */}
            <div class="flex justify-center pt-3 pb-2">
              <div class="w-10 h-1 bg-base-content/20 rounded-full" />
            </div>
            
            {/* Context menu header */}
            <div class="px-6 py-4 border-b border-base-content/10">
              <h3 class="font-semibold text-lg text-base-content">
                {props.node?.label}
              </h3>
              <p class="text-sm text-base-content/60">
                Choose an action
              </p>
            </div>

            {/* Action buttons */}
            <div class="p-4 space-y-2">
              <button
                class="btn btn-ghost w-full justify-start text-left h-12"
                onClick={() => handleAction(() => props.onCut(props.node!.id))}
              >
                <svg class="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Cut
              </button>

              <Show when={props.hasCutNode}>
                <button
                  class="btn btn-ghost w-full justify-start text-left h-12"
                  onClick={() => handleAction(() => props.onPaste(props.node!.id))}
                >
                  <svg class="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  Paste Here
                </button>
              </Show>

              <button
                class="btn btn-ghost w-full justify-start text-left h-12"
                onClick={() => handleAction(() => props.onRename(props.node!.id))}
              >
                <svg class="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Rename
              </button>

              <button
                class="btn btn-ghost w-full justify-start text-left h-12"
                onClick={() => handleAction(() => props.onCreateNew(props.node!.id))}
              >
                <svg class="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Create New Child
              </button>

              <button
                class="btn btn-ghost w-full justify-start text-left h-12"
                onClick={() => handleAction(() => props.onMoveToRoot(props.node!.id))}
              >
                <svg class="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                </svg>
                Move to Root
              </button>

              <button
                class="btn btn-ghost w-full justify-start text-left h-12 text-error"
                onClick={() => handleAction(() => props.onDelete(props.node!.id))}
              >
                <svg class="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete
              </button>
            </div>

            {/* Cancel button */}
            <div class="p-4 pt-0">
              <button
                class="btn btn-outline w-full h-12"
                onClick={props.onClose}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </Portal>
    </Show>
  );
};

/* Additional CSS classes for animations - these would typically be in your global CSS */
declare global {
  interface HTMLElement {
    classList: {
      add: (className: string) => void;
      remove: (className: string) => void;
      toggle: (className: string) => void;
      contains: (className: string) => boolean;
    };
  }
}

// Note: You may want to add these CSS classes to your global styles:
/*
@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slide-up {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

.animate-fade-in {
  animation: fade-in 0.2s ease-out;
}

.animate-slide-up {
  animation: slide-up 0.3s ease-out;
}
*/