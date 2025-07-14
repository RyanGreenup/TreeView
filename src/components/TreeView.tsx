import {
  createMemo,
  For,
  onMount,
  splitProps,
  Suspense,
} from "solid-js";

import { TreeItem } from "./tree/TreeItem";
import { TreeContext } from "./tree/context";
import { VIRTUAL_ROOT_ID } from "./tree/constants";
import {
  useTreeState,
  useTreeOperations,
  useTreeKeyboard,
  useTreeEffects,
} from "./tree/hooks";
import {
  TreeViewProps,
  TreeNode,
  TreeContextValue,
  TreeViewRef,
} from "./tree/types";

export type { TreeNode, TreeViewProps } from "./tree/types";

export const TreeView = (props: TreeViewProps) => {
  const [local, others] = splitProps(props, ["class"]);

  let treeRef: HTMLUListElement | undefined;
  let containerRef: HTMLDivElement | undefined;

  // Initialize hooks
  const state = useTreeState(others);
  const operations = useTreeOperations(state, others, { treeRef });
  const { handleKeyDown } = useTreeKeyboard(state, operations);

  // Setup effects
  useTreeEffects(state, operations, { treeRef, containerRef });

  const treeViewRef: TreeViewRef = {
    expandAll: operations.expandAll,
    collapseAll: operations.collapseAll,
    collapseAllExceptFocused: operations.collapseAllExceptFocused,
    collapseAllExceptSelected: operations.collapseAllExceptSelected,
    collapseSome: operations.collapseSome,
    foldCycle: operations.foldCycle,
    focusAndReveal: operations.focusAndReveal,
    cut: operations.handleCut,
    paste: operations.handlePaste,
    clearCut: operations.clearCut,
    refreshTree: operations.refreshTree,
    rename: operations.handleRename,
    createNew: operations.handleCreateNew,
    delete: operations.handleDelete,
  };

  onMount(() => {
    others.ref?.(treeViewRef);
  });

  const contextValue = createMemo(
    (): TreeContextValue => ({
      expandedNodes: state.expandedNodes,
      focusedNodeId: state.focusedNodeId,
      selectedNodeId: state.selectedNodeId,
      loadedChildren: state.loadedChildren,
      cutNodeId: state.cutNodeId,
      editingNodeId: state.editingNodeId,
      onSelect: operations.handleSelect,
      onFocus: operations.handleFocus,
      onExpand: operations.handleExpand,
      onChildrenLoaded: operations.handleChildrenLoaded,
      onCut: operations.handleCut,
      onPaste: operations.handlePaste,
      onMoveToRoot: operations.handleMoveToRoot,
      onRename: operations.handleRename,
      onRenameCommit: operations.handleRenameCommit,
      onRenameCancel: operations.handleRenameCancel,
      onContextMenu: others.onContextMenu,
      loadChildren: others.loadChildren,
    }),
  );

  return (
    <TreeContext.Provider value={contextValue()}>
      <div
        ref={containerRef}
        class={`max-h-96 overflow-y-auto ${local.class || ""}`}
      >
        <ul
          ref={treeRef}
          class="menu bg-base-200 rounded-box w-full"
          role="tree"
          aria-label="Tree View"
          tabIndex={0}
          onKeyDown={handleKeyDown}
        >
          <Suspense
            fallback={
              <li class="px-4 py-2">
                <div class="flex items-center gap-2 text-sm opacity-60">
                  <span class="loading loading-spinner loading-xs" />
                  <span>Loading...</span>
                </div>
              </li>
            }
          >
            <For each={state.loadedChildren().get(VIRTUAL_ROOT_ID) || []}>
              {(node) => <TreeItem node={{ ...node, level: 0 }} />}
            </For>
          </Suspense>
        </ul>
      </div>
    </TreeContext.Provider>
  );
};
