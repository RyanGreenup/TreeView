import { createEffect } from "solid-js";
import { VIRTUAL_ROOT_ID } from "../constants";
import { flattenTree, scrollIntoViewIfNeeded } from "../utils";
import { TreeOperations } from "./useTreeOperations";
import { TreeState } from "./useTreeState";

export interface TreeEffectsConfig {
  treeRef?: HTMLUListElement;
  containerRef?: HTMLDivElement;
}

/**
 * Hook that manages side effects for the tree component.
 * Handles auto-scrolling focused nodes into view, restoring focus when editing stops,
 * and focusing newly created items when they become available.
 */
export const useTreeEffects = (
  state: TreeState,
  operations: TreeOperations,
  config: TreeEffectsConfig,
) => {
  // Auto-scroll focused node into view
  createEffect(() => {
    const focused = state.focusedNode();
    if (!focused || !config.treeRef || !config.containerRef) return;

    queueMicrotask(() => {
      const focusedElement = config.treeRef?.querySelector(
        `a[data-node-id="${focused.id}"]`,
      ) as HTMLElement;
      if (focusedElement && config.containerRef) {
        scrollIntoViewIfNeeded(focusedElement, config.containerRef);
      }
    });
  });

  // Restore focus to tree when editing stops
  createEffect((prevEditing) => {
    const editing = state.editingNodeId();
    // Only restore focus when transitioning from editing to not editing
    if (prevEditing && editing === undefined && config.treeRef) {
      config.treeRef.focus();
    }
    return editing;
  });

  // Focus newly created items when they become available
  createEffect(() => {
    const pendingNodeId = state.pendingFocusNodeId();
    if (pendingNodeId) {
      // Try to find the node in the current flattened nodes
      const children = state.loadedChildren().get(VIRTUAL_ROOT_ID);
      if (children) {
        const flattenedNodes = flattenTree(
          children,
          0,
          state.expandedNodes,
          state.loadedChildren,
        );
        const nodeExists = flattenedNodes.some(
          (node) => node.id === pendingNodeId,
        );

        if (nodeExists) {
          // Node is now available, focus and reveal it
          operations.focusAndReveal(pendingNodeId);
          state.setPendingFocusNodeId(undefined);
        }
      }
    }
  });
};
