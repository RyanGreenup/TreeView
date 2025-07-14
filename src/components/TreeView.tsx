import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  onMount,
  Show,
  splitProps,
  Suspense,
} from "solid-js";

import { TreeItem } from "./tree/TreeItem";
import { TreeContext } from "./tree/context";
import { VIRTUAL_ROOT_ID, REFRESH_TREE_AFTER_RENAME } from "./tree/constants";
import { createKeyboardHandler } from "./tree/keyboard";
import { LoadingIndicator } from "./tree/LoadingIndicator";
import {
  flattenTree,
  scrollIntoViewIfNeeded,
  findNodeInChildren,
  getParentId,
  getPathToNode,
} from "./tree/utils";
import {
  TreeViewProps,
  TreeNode,
  TreeContextValue,
  FoldCycleState,
  TreeViewRef,
} from "./tree/types";

export type { TreeNode, TreeViewProps } from "./tree/types";

export const TreeView = (props: TreeViewProps) => {
  const [local, others] = splitProps(props, ["class"]);

  const [selectedNode, setSelectedNode] = createSignal<TreeNode | null>(null);
  const [focusedNode, setFocusedNode] = createSignal<TreeNode | null>(null);
  const [expandedNodes, setExpandedNodes] = createSignal<Set<string>>(
    new Set([VIRTUAL_ROOT_ID]),
  );
  const [loadedChildren, setLoadedChildren] = createSignal<
    Map<string, TreeNode[]>
  >(new Map());
  const [foldCycleState, setFoldCycleState] = createSignal<FoldCycleState>(0);
  const [cutNodeId, setCutNodeId] = createSignal<string | undefined>(undefined);
  const [editingNodeId, setEditingNodeId] = createSignal<string | undefined>(
    undefined,
  );
  const [pendingFocusNodeId, setPendingFocusNodeId] = createSignal<
    string | undefined
  >(undefined);
  const [pendingExpansions, setPendingExpansions] = createSignal<
    Map<string, boolean>
  >(new Map());

  let treeRef: HTMLUListElement | undefined;
  let containerRef: HTMLDivElement | undefined;

  const [rootChildren] = createResource(async () => {
    const children = await others.loadChildren(VIRTUAL_ROOT_ID);
    return children;
  });

  createEffect(() => {
    const children = rootChildren();
    if (children) {
      setLoadedChildren((prev) => {
        const newMap = new Map(prev);
        newMap.set(VIRTUAL_ROOT_ID, children);
        return newMap;
      });
    }
  });

  const flattenedNodes = createMemo(() => {
    const children = loadedChildren().get(VIRTUAL_ROOT_ID);
    return children
      ? flattenTree(children, 0, expandedNodes, loadedChildren)
      : [];
  });

  const focusedNodeId = createMemo(() => focusedNode()?.id);
  const selectedNodeId = createMemo(() => selectedNode()?.id);

  const currentNodeIndex = createMemo(() => {
    const currentNode = focusedNode();
    return currentNode
      ? flattenedNodes().findIndex((n) => n.id === currentNode.id)
      : -1;
  });

  createEffect(() => {
    const focused = focusedNode();
    if (!focused || !treeRef || !containerRef) return;

    queueMicrotask(() => {
      const focusedElement = treeRef?.querySelector(
        `a[data-node-id="${focused.id}"]`,
      ) as HTMLElement;
      if (focusedElement && containerRef) {
        scrollIntoViewIfNeeded(focusedElement, containerRef);
      }
    });
  });

  const handleSelect = (node: TreeNode) => {
    setSelectedNode(node);
    others.onSelect?.(node);
  };

  const handleFocus = (node: TreeNode) => {
    setFocusedNode(node);
    others.onFocus?.(node);
  };

  const handleExpand = (nodeId: string) => {
    setExpandedNodes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
    others.onExpand?.(nodeId);
  };

  const handleChildrenLoaded = (nodeId: string, children: TreeNode[]) => {
    setLoadedChildren((prev) => {
      const newMap = new Map(prev);
      newMap.set(nodeId, children);
      return newMap;
    });
  };

  const handleCut = (nodeId: string) => {
    setCutNodeId(nodeId);
  };

  const handlePaste = async (targetId: string) => {
    const cutId = cutNodeId();
    if (!cutId || !others.onCutPaste) return;

    try {
      const operationSucceeded = await others.onCutPaste(cutId, targetId);
      if (operationSucceeded) {
        const getParentIdFn = getParentIdMemo();
        const sourceParentId = getParentIdFn(cutId);

        // Refresh target parent (expand and focus moved item)
        await refreshParentChildren(targetId, {
          expand: true,
          focusChild: cutId,
        });

        // Refresh source parent if different
        if (sourceParentId && sourceParentId !== targetId) {
          await refreshParentChildren(sourceParentId);
        }

        setCutNodeId(undefined);
      }
    } catch (error) {
      console.warn("Cut/paste operation failed:", error);
    }
  };

  const handleMoveToRoot = async (nodeId?: string) => {
    const targetNodeId = nodeId || focusedNode()?.id;
    if (!targetNodeId || !others.onCutPaste) return;

    try {
      const operationSucceeded = await others.onCutPaste(
        targetNodeId,
        VIRTUAL_ROOT_ID,
      );
      if (operationSucceeded) {
        const getParentIdFn = getParentIdMemo();
        const sourceParentId = getParentIdFn(targetNodeId);

        // Refresh root (focus moved item)
        await refreshParentChildren(VIRTUAL_ROOT_ID, {
          focusChild: targetNodeId,
        });

        // Refresh source parent if different
        if (sourceParentId && sourceParentId !== VIRTUAL_ROOT_ID) {
          await refreshParentChildren(sourceParentId);
        }
      }
    } catch (error) {
      console.warn("Move to root operation failed:", error);
    }
  };

  const clearCut = () => {
    setCutNodeId(undefined);
  };

  const refreshParents = (
    parentIds: string[],
    options: { forceExpand?: boolean } = {},
  ) => {
    const getParentIdFn = getParentIdMemo();
    const expanded = expandedNodes();
    const loaded = loadedChildren();

    // Resolve leaf nodes to their parents, deduplicate
    const parentsToRefresh = [
      ...new Set(
        parentIds
          .filter((id) => id)
          .map((id) => {
            // If it's a leaf node (not expanded, no children), use grandparent
            if (
              id !== VIRTUAL_ROOT_ID &&
              !expanded.has(id) &&
              !loaded.has(id)
            ) {
              return getParentIdFn(id) || VIRTUAL_ROOT_ID;
            }
            return id;
          }),
      ),
    ];

    // Store expansion states, clear children, collapse
    const wasExpanded = new Map(
      parentsToRefresh.map((id) => [id, expanded.has(id)]),
    );

    setLoadedChildren((prev) => {
      const newMap = new Map(prev);
      parentsToRefresh.forEach(
        (id) => id !== VIRTUAL_ROOT_ID && newMap.delete(id),
      );
      return newMap;
    });

    setExpandedNodes((prev) => {
      const newSet = new Set(prev);
      parentsToRefresh.forEach(
        (id) => id !== VIRTUAL_ROOT_ID && newSet.delete(id),
      );
      return newSet;
    });

    // Queue re-expansion
    const toExpand = parentsToRefresh
      .filter(
        (id) =>
          id !== VIRTUAL_ROOT_ID &&
          (options.forceExpand || wasExpanded.get(id)),
      )
      .map((id) => [id, true] as const);

    if (toExpand.length) setPendingExpansions(new Map(toExpand));

    // Handle virtual root
    if (parentsToRefresh.includes(VIRTUAL_ROOT_ID)) {
      setLoadedChildren((prev) => {
        prev.delete(VIRTUAL_ROOT_ID);
        return new Map(prev);
      });
      others.loadChildren(VIRTUAL_ROOT_ID).then((children) => {
        setLoadedChildren((prev) =>
          new Map(prev).set(VIRTUAL_ROOT_ID, children),
        );
      });
    }
  };

  // Helper to refresh parent children and optionally expand/focus
  const refreshParentChildren = async (
    parentId: string,
    options: { expand?: boolean; focusChild?: string } = {},
  ) => {
    try {
      if (options.expand) {
        setExpandedNodes((prev) => new Set([...prev, parentId]));
      }

      const children = await others.loadChildren(parentId);
      setLoadedChildren((prev) => {
        const newMap = new Map(prev);
        newMap.set(parentId, children);
        return newMap;
      });

      if (options.focusChild) {
        setPendingFocusNodeId(options.focusChild);
      }
    } catch (error) {
      console.warn(`Failed to refresh parent ${parentId}:`, error);
    }
  };

  const handleCreateNew = async (parentId?: string) => {
    const targetParentId = parentId || focusedNode()?.id || VIRTUAL_ROOT_ID;
    if (!others.onCreate) return;

    try {
      const newItemId = await others.onCreate(targetParentId);
      if (newItemId) {
        await refreshParentChildren(targetParentId, {
          expand: true,
          focusChild: newItemId,
        });
      }
    } catch (error) {
      console.warn("Create operation failed:", error);
    }
  };

  const handleDelete = async (nodeId?: string) => {
    const targetNodeId = nodeId || focusedNode()?.id;
    if (!targetNodeId || !others.onDelete) return;

    try {
      const success = await others.onDelete(targetNodeId);
      if (success) {
        const getParentIdFn = getParentIdMemo();
        const parentId = getParentIdFn(targetNodeId) || VIRTUAL_ROOT_ID;

        // Clear states if they were on the deleted node
        if (focusedNode()?.id === targetNodeId) setFocusedNode(null);
        if (selectedNode()?.id === targetNodeId) setSelectedNode(null);
        if (cutNodeId() === targetNodeId) setCutNodeId(undefined);

        refreshParents([parentId]);
      }
    } catch (error) {
      console.warn("Delete operation failed:", error);
    }
  };

  const handleRename = (nodeId?: string) => {
    const targetNodeId = nodeId || focusedNode()?.id;
    if (targetNodeId) setEditingNodeId(targetNodeId);
  };

  const handleRenameCommit = async (nodeId: string, newLabel: string) => {
    if (!others.onRename) return;

    try {
      const success = await others.onRename(nodeId, newLabel);
      if (success) {
        setEditingNodeId(undefined);
        if (REFRESH_TREE_AFTER_RENAME) {
          refreshTree();
        } else {
          updateNodeLabelInPlace(nodeId, newLabel);
        }
      }
    } catch (error) {
      console.warn("Rename operation failed:", error);
    }
  };

  const handleRenameCancel = () => setEditingNodeId(undefined);

  const updateNodeLabelInPlace = (nodeId: string, newLabel: string) => {
    const nodeElement = treeRef?.querySelector(
      `a[data-node-id="${nodeId}"] span`,
    );
    if (nodeElement) nodeElement.textContent = newLabel;
  };

  const refreshTree = () => {
    const currentExpansions = new Set(expandedNodes());
    setLoadedChildren(new Map());
    setExpandedNodes(new Set([VIRTUAL_ROOT_ID]));

    others.loadChildren(VIRTUAL_ROOT_ID).then((children) => {
      setLoadedChildren((prev) => new Map(prev).set(VIRTUAL_ROOT_ID, children));
      const nodesToRestore = Array.from(currentExpansions).filter(
        (id) => id !== VIRTUAL_ROOT_ID,
      );
      if (nodesToRestore.length > 0) {
        setPendingExpansions(new Map(nodesToRestore.map((id) => [id, true])));
      }
    });
  };

  const getParentIdMemo = createMemo(() => {
    const loaded = loadedChildren();
    return (nodeId: string): string | null => getParentId(nodeId, loaded);
  });

  const expandAll = async () => {
    const expandLevel = async (nodes: TreeNode[]) => {
      const nodesToExpand = nodes.filter((node) => node.hasChildren);
      if (nodesToExpand.length === 0) return;

      setExpandedNodes((prev) => {
        const newSet = new Set(prev);
        nodesToExpand.forEach((node) => newSet.add(node.id));
        return newSet;
      });

      const childrenLoadPromises = nodesToExpand.map(async (node) => {
        try {
          const children = await others.loadChildren(node.id);
          if (children?.length > 0) {
            setLoadedChildren((prev) => new Map(prev).set(node.id, children));
            return children;
          }
        } catch (error) {
          console.warn(`Failed to load children for node ${node.id}:`, error);
        }
        return [];
      });

      const allChildrenArrays = await Promise.all(childrenLoadPromises);
      const nextLevelNodes = allChildrenArrays.flat();
      if (nextLevelNodes.length > 0) {
        await expandLevel(nextLevelNodes);
      }
    };

    const rootNodes = loadedChildren().get(VIRTUAL_ROOT_ID);
    if (rootNodes) await expandLevel(rootNodes);
  };

  const collapseAll = () => setExpandedNodes(new Set([VIRTUAL_ROOT_ID]));

  const getPathToNodeMemo = createMemo(() => {
    const loaded = loadedChildren();
    return (nodeId: string): string[] | null =>
      getPathToNode(nodeId, loaded, VIRTUAL_ROOT_ID);
  });

  const collapseAllExceptNode = (node: TreeNode | null) => {
    if (!node) {
      collapseAll();
      return;
    }

    const getPathFn = getPathToNodeMemo();
    const pathToNode = getPathFn(node.id);
    if (pathToNode) {
      setExpandedNodes(new Set([VIRTUAL_ROOT_ID, ...pathToNode.slice(0, -1)]));
    } else {
      collapseAll();
    }
  };

  const collapseAllExceptFocused = () => collapseAllExceptNode(focusedNode());
  const collapseAllExceptSelected = () => collapseAllExceptNode(selectedNode());

  const collapseSome = () => {
    const focused = focusedNode();
    const selected = selectedNode();

    if (!focused && !selected) {
      collapseAll();
      return;
    }

    const pathsToKeep = new Set<string>([VIRTUAL_ROOT_ID]);
    const getPathFn = getPathToNodeMemo();

    if (focused) {
      const pathToFocused = getPathFn(focused.id);
      if (pathToFocused) {
        pathToFocused.slice(0, -1).forEach((id) => pathsToKeep.add(id));
      }
    }

    if (selected && selected.id !== focused?.id) {
      const pathToSelected = getPathFn(selected.id);
      if (pathToSelected) {
        pathToSelected.slice(0, -1).forEach((id) => pathsToKeep.add(id));
      }
    }

    setExpandedNodes(pathsToKeep);
  };

  const foldCycle = () => {
    const currentState = foldCycleState();

    switch (currentState) {
      case 0:
        const rootNodes = loadedChildren().get(VIRTUAL_ROOT_ID);
        if (!rootNodes) return;
        const topLevelParentIds = rootNodes
          .filter((node) => node.hasChildren)
          .map((node) => node.id);
        setExpandedNodes(new Set([VIRTUAL_ROOT_ID, ...topLevelParentIds]));
        setFoldCycleState(1);
        break;
      case 1:
        expandAll();
        setFoldCycleState(2);
        break;
      case 2:
        collapseAll();
        setFoldCycleState(0);
        break;
    }
  };

  const focusAndReveal = async (nodeId: string) => {
    let targetNode = findNodeInChildren(nodeId, loadedChildren());

    if (!targetNode) {
      const expandAndSearch = async (
        currentNodes: TreeNode[],
        targetId: string,
      ): Promise<TreeNode | null> => {
        for (const node of currentNodes) {
          if (targetId.startsWith(node.id + "-") || targetId === node.id) {
            if (node.id === targetId) return node;

            if (node.hasChildren) {
              setExpandedNodes((prev) => new Set([...prev, node.id]));
              try {
                const dynamicChildren = await others.loadChildren(node.id);
                if (dynamicChildren?.length > 0) {
                  setLoadedChildren((prev) =>
                    new Map(prev).set(node.id, dynamicChildren),
                  );
                  const found = await expandAndSearch(dynamicChildren, targetId);
                  if (found) return found;
                }
              } catch (error) {
                console.warn(
                  `Failed to load children for node ${node.id}:`,
                  error,
                );
              }
            }
          }
        }
        return null;
      };

      const rootNodes = loadedChildren().get(VIRTUAL_ROOT_ID);
      if (rootNodes) {
        targetNode = await expandAndSearch(rootNodes, nodeId);
      }
    }

    if (!targetNode) {
      console.warn(`Node with id "${nodeId}" not found in tree`);
      return;
    }

    const getPathFn = getPathToNodeMemo();
    const pathToTarget = getPathFn(nodeId);
    if (pathToTarget) {
      const parentsToExpand = pathToTarget.slice(0, -1);
      setExpandedNodes((prev) => {
        const newSet = new Set(prev);
        newSet.add(VIRTUAL_ROOT_ID);
        parentsToExpand.forEach((id) => newSet.add(id));
        return newSet;
      });
      handleFocus(targetNode);
    }
  };

  const keyboardHandlers = {
    handleSelect,
    handleFocus,
    handleExpand,
    handleCut,
    handlePaste,
    handleMoveToRoot,
    clearCut,
    handleRename,
    handleCreateNew,
    handleDelete,
  };

  const handleKeyDown = createKeyboardHandler(
    flattenedNodes,
    focusedNode,
    currentNodeIndex,
    expandedNodes,
    keyboardHandlers,
  );

  const treeViewRef: TreeViewRef = {
    expandAll,
    collapseAll,
    collapseAllExceptFocused,
    collapseAllExceptSelected,
    collapseSome,
    foldCycle,
    focusAndReveal,
    cut: handleCut,
    paste: handlePaste,
    clearCut,
    refreshTree,
    rename: handleRename,
    createNew: handleCreateNew,
    delete: handleDelete,
  };

  onMount(() => {
    others.ref?.(treeViewRef);
  });

  createEffect(() => {
    const rootNodes = loadedChildren().get(VIRTUAL_ROOT_ID);
    if (rootNodes && rootNodes.length > 0 && !focusedNode()) {
      setFocusedNode(rootNodes[0]);
    }
  });

  createEffect(() => {
    const pending = pendingExpansions();
    if (pending.size > 0) {
      setExpandedNodes((prev) => {
        const newSet = new Set(prev);
        pending.forEach((shouldExpand, nodeId) => {
          if (shouldExpand) {
            newSet.add(nodeId);
          } else {
            newSet.delete(nodeId);
          }
        });
        return newSet;
      });

      setPendingExpansions(new Map());
    }
  });

  // Restore focus to tree when editing stops
  createEffect((prevEditing) => {
    const editing = editingNodeId();
    // Only restore focus when transitioning from editing to not editing
    if (prevEditing && editing === undefined && treeRef) {
      treeRef.focus();
    }
    return editing;
  });

  // Focus newly created items when they become available
  createEffect(() => {
    const pendingNodeId = pendingFocusNodeId();
    if (pendingNodeId) {
      // Try to find the node in the current flattened nodes
      const flattened = flattenedNodes();
      const nodeExists = flattened.some((node) => node.id === pendingNodeId);

      if (nodeExists) {
        // Node is now available, focus and reveal it
        focusAndReveal(pendingNodeId);
        setPendingFocusNodeId(undefined);
      }
    }
  });

  const contextValue = createMemo(
    (): TreeContextValue => ({
      expandedNodes,
      focusedNodeId,
      selectedNodeId,
      loadedChildren,
      cutNodeId,
      editingNodeId,
      onSelect: handleSelect,
      onFocus: handleFocus,
      onExpand: handleExpand,
      onChildrenLoaded: handleChildrenLoaded,
      onCut: handleCut,
      onPaste: handlePaste,
      onMoveToRoot: handleMoveToRoot,
      onRename: handleRename,
      onRenameCommit: handleRenameCommit,
      onRenameCancel: handleRenameCancel,
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
            <For each={loadedChildren().get(VIRTUAL_ROOT_ID) || []}>
              {(node) => <TreeItem node={{ ...node, level: 0 }} />}
            </For>
          </Suspense>
        </ul>
      </div>
    </TreeContext.Provider>
  );
};
