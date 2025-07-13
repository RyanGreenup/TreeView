import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  onMount,
  Show,
  splitProps,
} from "solid-js";

import { TreeItem } from "./tree/TreeItem";
import { TreeContext } from "./tree/context";
import { VIRTUAL_ROOT_ID } from "./tree/constants";
import { createKeyboardHandler } from "./tree/keyboard";
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

  const handlePaste = (targetId: string) => {
    const cutId = cutNodeId();
    if (cutId && others.onCutPaste) {
      const operationSucceeded = others.onCutPaste(cutId, targetId);
      if (operationSucceeded) {
        refreshAfterMove(cutId, targetId);
        setCutNodeId(undefined);
      }
    }
  };

  const handleMoveToRoot = (nodeId?: string) => {
    const targetNodeId = nodeId || focusedNode()?.id;
    
    if (targetNodeId && others.onCutPaste) {
      others.onCutPaste(targetNodeId, VIRTUAL_ROOT_ID);
      refreshAfterMove(targetNodeId, VIRTUAL_ROOT_ID);
    }
  };

  const clearCut = () => {
    setCutNodeId(undefined);
  };

  const refreshTree = () => {
    // Store current expansion state
    const currentExpansions = new Set(expandedNodes());

    // Clear all loaded children to force refresh
    setLoadedChildren(new Map());

    // Reset expanded nodes to just virtual root
    setExpandedNodes(new Set([VIRTUAL_ROOT_ID]));

    // Re-load virtual root children
    others.loadChildren(VIRTUAL_ROOT_ID).then((children) => {
      setLoadedChildren((prev) => {
        const newMap = new Map(prev);
        newMap.set(VIRTUAL_ROOT_ID, children);
        return newMap;
      });

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
    return (nodeId: string): string | null => 
      getParentId(nodeId, loaded);
  });

  const refreshAfterMove = (sourceId: string, targetId: string) => {
    const getParentIdFn = getParentIdMemo();
    const sourceParentId = getParentIdFn(sourceId);
    const targetParentId = targetId;

    const sourceParentWasExpanded = sourceParentId
      ? expandedNodes().has(sourceParentId)
      : false;
    const targetParentWasExpanded = expandedNodes().has(targetParentId);

    setExpandedNodes((prev) => {
      const newSet = new Set(prev);
      if (sourceParentId && sourceParentId !== VIRTUAL_ROOT_ID)
        newSet.delete(sourceParentId);
      if (targetParentId !== VIRTUAL_ROOT_ID) newSet.delete(targetParentId);
      return newSet;
    });

    setLoadedChildren((prev) => {
      const newMap = new Map(prev);
      if (sourceParentId) newMap.delete(sourceParentId);
      if (targetParentId !== VIRTUAL_ROOT_ID) newMap.delete(targetParentId);
      return newMap;
    });

    const newPending = new Map<string, boolean>();
    if (
      sourceParentWasExpanded &&
      sourceParentId &&
      sourceParentId !== VIRTUAL_ROOT_ID
    ) {
      newPending.set(sourceParentId, true);
    }
    if (targetParentWasExpanded && targetParentId !== VIRTUAL_ROOT_ID) {
      newPending.set(targetParentId, true);
    }
    if (newPending.size > 0) {
      setPendingExpansions(newPending);
    }

    if (
      sourceParentId === VIRTUAL_ROOT_ID ||
      targetParentId === VIRTUAL_ROOT_ID
    ) {
      setLoadedChildren((prev) => {
        const newMap = new Map(prev);
        newMap.delete(VIRTUAL_ROOT_ID);
        return newMap;
      });
      others.loadChildren(VIRTUAL_ROOT_ID).then((children) => {
        setLoadedChildren((prev) => {
          const newMap = new Map(prev);
          newMap.set(VIRTUAL_ROOT_ID, children);
          return newMap;
        });
      });
    }
  };

  const expandAll = async () => {
    const expandLevel = async (nodes: TreeNode[]) => {
      const nodesToExpand = nodes.filter((node) => node.hasChildren);

      if (nodesToExpand.length === 0) {
        return;
      }

      // First, expand all nodes at this level immediately
      setExpandedNodes((prev) => {
        const newSet = new Set(prev);
        nodesToExpand.forEach((node) => newSet.add(node.id));
        return newSet;
      });

      // Then load children for each node at this level
      const childrenLoadPromises = nodesToExpand.map(async (node) => {
        try {
          const children = await others.loadChildren(node.id);
          if (children && children.length > 0) {
            setLoadedChildren((prev) => {
              const newMap = new Map(prev);
              newMap.set(node.id, children);
              return newMap;
            });
            return children;
          }
        } catch (error) {
          console.warn(`Failed to load children for node ${node.id}:`, error);
        }
        return [];
      });

      // Wait for all children at this level to load
      const allChildrenArrays = await Promise.all(childrenLoadPromises);

      // Flatten all children for the next level
      const nextLevelNodes = allChildrenArrays.flat();

      // Recursively expand the next level
      if (nextLevelNodes.length > 0) {
        await expandLevel(nextLevelNodes);
      }
    };

    const rootNodes = loadedChildren().get(VIRTUAL_ROOT_ID);
    if (rootNodes) {
      await expandLevel(rootNodes);
    }
  };

  const collapseAll = () => {
    setExpandedNodes(new Set([VIRTUAL_ROOT_ID])); // Keep virtual root expanded
  };

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

  const collapseAllExceptFocused = () => {
    collapseAllExceptNode(focusedNode());
  };

  const collapseAllExceptSelected = () => {
    collapseAllExceptNode(selectedNode());
  };

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
      case 0: // Currently collapsed, go to "unfold to items with children only"
        const getTopLevelParentIds = (nodes: TreeNode[]): string[] => {
          const ids: string[] = [];

          for (const node of nodes) {
            if (node.hasChildren) {
              ids.push(node.id);
            }
          }

          return ids;
        };

        const rootNodes = loadedChildren().get(VIRTUAL_ROOT_ID);
        if (!rootNodes) return;
        const topLevelParentIds = getTopLevelParentIds(rootNodes);
        setExpandedNodes(new Set([VIRTUAL_ROOT_ID, ...topLevelParentIds]));
        setFoldCycleState(1);
        break;

      case 1: // Currently showing top-level parents, go to "unfold all"
        expandAll();
        setFoldCycleState(2);
        break;

      case 2: // Currently expanded all, go back to collapsed
        collapseAll();
        setFoldCycleState(0);
        break;
    }
  };

  const focusAndReveal = async (nodeId: string) => {
    let targetNode = findNodeInChildren(nodeId, loadedChildren());

    // If not found, we need to progressively expand and load children
    if (!targetNode) {
      const expandAndSearch = async (
        currentNodes: TreeNode[],
        targetId: string,
      ): Promise<TreeNode | null> => {
        for (const node of currentNodes) {
          // Check if target could be a descendant by checking if targetId starts with node.id
          if (targetId.startsWith(node.id + "-") || targetId === node.id) {
            // If this is the target node
            if (node.id === targetId) {
              return node;
            }

            // If this node has children, search them
            if (node.hasChildren) {
              // Expand this node first
              setExpandedNodes((prev) => new Set([...prev, node.id]));

              try {
                const dynamicChildren = await others.loadChildren(node.id);
                if (dynamicChildren && dynamicChildren.length > 0) {
                  setLoadedChildren((prev) => {
                    const newMap = new Map(prev);
                    newMap.set(node.id, dynamicChildren);
                    return newMap;
                  });

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

  const contextValue = createMemo((): TreeContextValue => ({
    expandedNodes,
    focusedNodeId,
    selectedNodeId,
    loadedChildren,
    cutNodeId,
    onSelect: handleSelect,
    onFocus: handleFocus,
    onExpand: handleExpand,
    onChildrenLoaded: handleChildrenLoaded,
    onCut: handleCut,
    onPaste: handlePaste,
    onMoveToRoot: handleMoveToRoot,
    onContextMenu: others.onContextMenu,
    loadChildren: others.loadChildren,
  }));

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
          <Show
            when={!rootChildren.loading}
            fallback={
              <li class="px-4 py-2">
                <div class="flex items-center gap-2 text-sm opacity-60">
                  <span class="loading loading-spinner loading-xs"></span>
                  <span>Loading tree...</span>
                </div>
              </li>
            }
          >
            <For each={loadedChildren().get(VIRTUAL_ROOT_ID) || []}>
              {(node) => <TreeItem node={{ ...node, level: 0 }} />}
            </For>
          </Show>
        </ul>
      </div>
    </TreeContext.Provider>
  );
};

