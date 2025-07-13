import {
  Accessor,
  createContext,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  JSXElement,
  onMount,
  Show,
  Suspense,
  useContext,
} from "solid-js";

import { Transition } from "solid-transition-group";

type TreeSelectHandler = (node: TreeNode) => void;
type TreeFocusHandler = (node: TreeNode) => void;
type TreeExpandHandler = (nodeId: string) => void;
type TreeChildrenLoader = (nodeId: string) => Promise<TreeNode[]>;
type TreeChildrenLoadedHandler = (nodeId: string, children: TreeNode[]) => void;
type TreeCutPasteHandler = (sourceId: string, targetId: string) => void;

interface TreeContextValue {
  expandedNodes: Accessor<Set<string>>;
  focusedNodeId: Accessor<string | undefined>;
  selectedNodeId: Accessor<string | undefined>;
  loadedChildren: Accessor<Map<string, TreeNode[]>>;
  cutNodeId: Accessor<string | undefined>;
  onSelect: TreeSelectHandler;
  onFocus: TreeFocusHandler;
  onExpand: TreeExpandHandler;
  onChildrenLoaded: TreeChildrenLoadedHandler;
  onCut: (nodeId: string) => void;
  onPaste: (targetId: string) => void;
  loadChildren?: TreeChildrenLoader;
}

const TreeContext = createContext<TreeContextValue>();

const useTreeContext = () => {
  const context = useContext(TreeContext);
  if (!context) {
    throw new Error("useTreeContext must be used within a TreeView");
  }
  return context;
};

export interface TreeNode {
  id: string;
  label: string;
  hasChildren?: boolean;
  isExpanded?: boolean;
  level: number;
}

export interface TreeViewProps {
  loadChildren: TreeChildrenLoader;
  onSelect?: TreeSelectHandler;
  onFocus?: TreeFocusHandler;
  onExpand?: TreeExpandHandler;
  onCutPaste?: TreeCutPasteHandler;
  class?: string;
  ref?: (ref: {
    expandAll: () => void;
    collapseAll: () => void;
    collapseAllExceptFocused: () => void;
    collapseAllExceptSelected: () => void;
    collapseSome: () => void;
    foldCycle: () => void;
    focusAndReveal: (nodeId: string) => Promise<void>;
    cut: (nodeId: string) => void;
    paste: (targetId: string) => void;
    clearCut: () => void;
  }) => void;
}

export interface TreeItemProps {
  node: TreeNode;
}

const TreeItem = (props: TreeItemProps) => {
  const ctx = useTreeContext();

  // Use the expanded state from context
  const expanded = () => ctx.expandedNodes().has(props.node.id);

  const [childrenResource] = createResource(
    () =>
      expanded() && props.node.hasChildren
        ? props.node.id
        : null,
    async (nodeId) => {
      const children = await (ctx.loadChildren?.(nodeId) ||
        Promise.resolve([]));
      // Notify parent about loaded children so they can be included in keyboard navigation
      if (children.length > 0) {
        ctx.onChildrenLoaded(nodeId, children);
      }
      return children;
    },
  );

  const handleToggle = () => {
    ctx.onExpand(props.node.id);
  };

  const handleClick = () => {
    ctx.onFocus(props.node);
    ctx.onSelect(props.node);
  };

  const level = props.node.level;
  const isSelected = () => ctx.selectedNodeId() === props.node.id;
  const isFocused = () => ctx.focusedNodeId() === props.node.id;
  const isCut = () => ctx.cutNodeId() === props.node.id;

  return (
    <li>
      <a
        classList={{
          "items-center gap-2 flex": true,
          active: isSelected(),
          "bg-primary/50 ": isFocused(),
          "opacity-50 bg-warning/20": isCut(),
          // Not sure if I want an outline ring
          "ring-2 ring-primary ring-offset-2 ring-offset-base-200":
            isFocused() && false,
        }}
        onClick={handleClick}
        onContextMenu={(e) => {
          e.preventDefault();
          // Simple context menu - you could enhance this with a proper dropdown
          const action = prompt("Choose action:\n1. Cut\n2. Paste\n3. Cancel", "3");
          switch(action) {
            case "1":
              ctx.onCut(props.node.id);
              break;
            case "2":
              ctx.onPaste(props.node.id);
              break;
          }
        }}
        data-node-id={props.node.id}
        role="treeitem"
        aria-expanded={expanded()}
        aria-level={level + 1}
        aria-selected={isSelected()}
      >
        <Show
          when={props.node.hasChildren}
          fallback={<div class="w-4 h-4 opacity-0"></div>}
        >
          <button
            class="btn btn-ghost btn-xs btn-square"
            onClick={(e) => {
              e.stopPropagation();
              handleToggle();
            }}
            tabIndex={-1}
            aria-label={expanded() ? "Collapse" : "Expand"}
          >
            <ExpandCollapseIcon expanded={expanded()} />
          </button>
        </Show>
        <span class="flex-1">{props.node.label}</span>
      </a>

      <TreeElementTransition>
        <Show when={expanded() && props.node.hasChildren}>
          <ul>
            <Suspense
              fallback={
                <li class="px-4 py-2">
                  <div class="flex items-center gap-2 text-sm opacity-60">
                    <span class="loading loading-spinner loading-xs"></span>
                    <span>Loading...</span>
                  </div>
                </li>
              }
            >
              <For each={childrenResource()}>
                {(child) => (
                  <TreeItem node={{ ...child, level: level + 1 }} />
                )}
              </For>
            </Suspense>
          </ul>
        </Show>
      </TreeElementTransition>
    </li>
  );
};

// Helper function to scroll an element into view if it's not fully visible
const scrollIntoViewIfNeeded = (
  element: HTMLElement,
  container: HTMLElement,
) => {
  const elementRect = element.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();

  const isAbove = elementRect.top < containerRect.top;
  const isBelow = elementRect.bottom > containerRect.bottom;

  if (isAbove || isBelow) {
    // Use scrollIntoView with better block positioning for smooth UX
    if (
      "scrollIntoView" in element &&
      typeof element.scrollIntoView === "function"
    ) {
      try {
        element.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "nearest",
        });
      } catch {
        // Fallback for older browsers
        element.scrollIntoView(isAbove);
      }
    } else {
      // Manual scroll fallback with better positioning
      const elementTop = element.offsetTop;
      const elementHeight = element.offsetHeight;
      const containerScrollTop = container.scrollTop;
      const containerHeight = container.clientHeight;
      const padding = 8; // Small padding from container edges

      if (isAbove) {
        container.scrollTop = Math.max(0, elementTop - padding);
      } else if (isBelow) {
        container.scrollTop =
          elementTop - containerHeight + elementHeight + padding;
      }
    }
  }
};

// Virtual root node ID - represents the invisible root container
const VIRTUAL_ROOT_ID = "__virtual_root__";

export const TreeView = (props: TreeViewProps) => {
  const [selectedNode, setSelectedNode] = createSignal<TreeNode | null>(null);
  const [focusedNode, setFocusedNode] = createSignal<TreeNode | null>(null);
  const [expandedNodes, setExpandedNodes] = createSignal<Set<string>>(
    new Set([VIRTUAL_ROOT_ID]), // Virtual root is always expanded
  );
  const [loadedChildren, setLoadedChildren] = createSignal<
    Map<string, TreeNode[]>
  >(new Map());
  const [foldCycleState, setFoldCycleState] = createSignal<0 | 1 | 2>(0);
  const [cutNodeId, setCutNodeId] = createSignal<string | undefined>(undefined);
  const [pendingExpansions, setPendingExpansions] = createSignal<Map<string, boolean>>(new Map());
  let treeRef: HTMLUListElement | undefined;
  let containerRef: HTMLDivElement | undefined;

  // Load root children from virtual root
  const [rootChildren] = createResource(
    async () => {
      const children = await props.loadChildren(VIRTUAL_ROOT_ID);
      return children;
    }
  );

  // Store root children in loadedChildren when they load
  createEffect(() => {
    const children = rootChildren();
    if (children) {
      setLoadedChildren(prev => {
        const newMap = new Map(prev);
        newMap.set(VIRTUAL_ROOT_ID, children);
        return newMap;
      });
    }
  });

  // Memoize expensive tree flattening computation
  const flattenedNodes = createMemo(() => {
    const children = loadedChildren().get(VIRTUAL_ROOT_ID);
    return children ? flattenTree(children, 0, expandedNodes, loadedChildren) : [];
  });

  // Memoize accessor functions to prevent creating new functions on every render
  const focusedNodeId = createMemo(() => focusedNode()?.id);
  const selectedNodeId = createMemo(() => selectedNode()?.id);

  // Memoize current index for keyboard navigation
  const currentNodeIndex = createMemo(() => {
    const currentNode = focusedNode();
    return currentNode
      ? flattenedNodes().findIndex((n) => n.id === currentNode.id)
      : -1;
  });

  // Reactive effect to scroll focused item into view
  createEffect(() => {
    const focused = focusedNode();
    if (!focused || !treeRef || !containerRef) return;

    // Use queueMicrotask for better timing than requestAnimationFrame
    queueMicrotask(() => {
      const focusedElement = treeRef?.querySelector(
        `a[data-node-id="${focused.id}"]`,
      ) as HTMLElement;
      if (focusedElement) {
        scrollIntoViewIfNeeded(focusedElement, containerRef!);
      }
    });
  });

  const handleSelect = (node: TreeNode) => {
    setSelectedNode(node);
    props.onSelect?.(node);
  };

  const handleFocus = (node: TreeNode) => {
    setFocusedNode(node);
    props.onFocus?.(node);
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
    props.onExpand?.(nodeId);
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
    if (cutId && props.onCutPaste) {
      props.onCutPaste(cutId, targetId);
      // Refresh data by collapsing and re-expanding parent nodes
      refreshAfterMove(cutId, targetId);
      setCutNodeId(undefined);
    }
  };

  const handleMoveToRoot = () => {
    const cutId = cutNodeId();
    if (cutId && props.onCutPaste) {
      // Moving to root is just pasting to the virtual root
      props.onCutPaste(cutId, VIRTUAL_ROOT_ID);
      // Refresh data by collapsing and re-expanding parent nodes
      refreshAfterMove(cutId, VIRTUAL_ROOT_ID);
      setCutNodeId(undefined);
    }
  };

  const clearCut = () => {
    setCutNodeId(undefined);
  };

  const getParentId = (nodeId: string): string | null => {
    const loaded = loadedChildren();
    
    // Check all loaded children maps to find the parent
    for (const [parentId, children] of loaded.entries()) {
      if (children.some(child => child.id === nodeId)) {
        return parentId;
      }
    }
    
    return null;
  };

  const refreshAfterMove = (sourceId: string, targetId: string) => {
    // Get parent IDs
    const sourceParentId = getParentId(sourceId);
    const targetParentId = targetId;

    // Store expansion states
    const sourceParentWasExpanded = sourceParentId ? expandedNodes().has(sourceParentId) : false;
    const targetParentWasExpanded = expandedNodes().has(targetParentId);

    // Collapse both parents to force data refresh
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (sourceParentId && sourceParentId !== VIRTUAL_ROOT_ID) newSet.delete(sourceParentId);
      if (targetParentId !== VIRTUAL_ROOT_ID) newSet.delete(targetParentId);
      return newSet;
    });

    // Clear loaded children for both parents
    setLoadedChildren(prev => {
      const newMap = new Map(prev);
      if (sourceParentId) newMap.delete(sourceParentId);
      if (targetParentId !== VIRTUAL_ROOT_ID) newMap.delete(targetParentId);
      return newMap;
    });

    // Schedule re-expansion using reactive pending expansions
    const newPending = new Map<string, boolean>();
    if (sourceParentWasExpanded && sourceParentId && sourceParentId !== VIRTUAL_ROOT_ID) {
      newPending.set(sourceParentId, true);
    }
    if (targetParentWasExpanded && targetParentId !== VIRTUAL_ROOT_ID) {
      newPending.set(targetParentId, true);
    }
    if (newPending.size > 0) {
      setPendingExpansions(newPending);
    }

    // If moving to/from virtual root, refresh root children
    if (sourceParentId === VIRTUAL_ROOT_ID || targetParentId === VIRTUAL_ROOT_ID) {
      // Trigger refresh of virtual root children
      setLoadedChildren(prev => {
        const newMap = new Map(prev);
        newMap.delete(VIRTUAL_ROOT_ID);
        return newMap;
      });
      // Re-load virtual root children
      props.loadChildren(VIRTUAL_ROOT_ID).then(children => {
        setLoadedChildren(prev => {
          const newMap = new Map(prev);
          newMap.set(VIRTUAL_ROOT_ID, children);
          return newMap;
        });
      });
    }
  };


  const expandAll = async () => {
    const expandLevel = async (nodes: TreeNode[]) => {
      const nodesToExpand = nodes.filter(node => node.hasChildren);
      
      if (nodesToExpand.length === 0) {
        return;
      }

      // First, expand all nodes at this level immediately
      setExpandedNodes(prev => {
        const newSet = new Set(prev);
        nodesToExpand.forEach(node => newSet.add(node.id));
        return newSet;
      });

      // Then load children for each node at this level
      const childrenLoadPromises = nodesToExpand.map(async (node) => {
        try {
          const children = await props.loadChildren(node.id);
          if (children && children.length > 0) {
            // Update loaded children immediately when they arrive
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

  const getPathToNode = (nodeId: string): string[] | null => {
    const loaded = loadedChildren();
    
    const findPath = (targetId: string, currentPath: string[] = []): string[] | null => {
      // Check each parent's children
      for (const [parentId, children] of loaded.entries()) {
        for (const child of children) {
          const pathToChild = [...currentPath, parentId, child.id];
          
          if (child.id === targetId) {
            // Filter out virtual root from the path
            return pathToChild.filter(id => id !== VIRTUAL_ROOT_ID);
          }
          
          // Recursively search in child's children if they exist
          const childrenOfChild = loaded.get(child.id);
          if (childrenOfChild) {
            const foundPath = findPath(targetId, pathToChild.slice(0, -1));
            if (foundPath) return foundPath;
          }
        }
      }
      return null;
    };
    
    return findPath(nodeId);
  };

  const collapseAllExceptNode = (node: TreeNode | null) => {
    if (!node) {
      collapseAll();
      return;
    }

    const pathToNode = getPathToNode(node.id);
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

    if (focused) {
      const pathToFocused = getPathToNode(focused.id);
      if (pathToFocused) {
        pathToFocused.slice(0, -1).forEach((id) => pathsToKeep.add(id));
      }
    }

    if (selected && selected.id !== focused?.id) {
      const pathToSelected = getPathToNode(selected.id);
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
    const findNodeInLoadedChildren = (targetId: string): TreeNode | null => {
      const loaded = loadedChildren();
      for (const [, children] of loaded.entries()) {
        for (const child of children) {
          if (child.id === targetId) {
            return child;
          }
        }
      }
      return null;
    };

    // First try to find the node in already loaded children
    let targetNode = findNodeInLoadedChildren(nodeId);

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

              // Load dynamic children
              try {
                const dynamicChildren = await props.loadChildren(node.id);
                if (dynamicChildren && dynamicChildren.length > 0) {
                  // Update loaded children
                  setLoadedChildren((prev) => {
                    const newMap = new Map(prev);
                    newMap.set(node.id, dynamicChildren);
                    return newMap;
                  });

                  // Search in the newly loaded children
                  const found = await expandAndSearch(
                    dynamicChildren,
                    targetId,
                  );
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

    // Get path to the target node and ensure all parents are expanded
    const pathToTarget = getPathToNode(nodeId);
    if (pathToTarget) {
      // Expand all parent nodes (exclude the target node itself)
      const parentsToExpand = pathToTarget.slice(0, -1);
      setExpandedNodes((prev) => {
        const newSet = new Set(prev);
        newSet.add(VIRTUAL_ROOT_ID); // Ensure virtual root is expanded
        parentsToExpand.forEach((id) => newSet.add(id));
        return newSet;
      });

      // Set focus to the target node
      handleFocus(targetNode);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    const flattened = flattenedNodes();
    const currentNode = focusedNode();
    if (!currentNode) return;

    const currentIndex = currentNodeIndex();

    const focusDown = () => {
      e.preventDefault();
      if (currentIndex < flattened.length - 1) {
        const nextNode = flattened[currentIndex + 1];
        handleFocus(nextNode);
      }
    };
    const focusUp = () => {
      e.preventDefault();
      if (currentIndex > 0) {
        const prevNode = flattened[currentIndex - 1];
        handleFocus(prevNode);
      }
    };
    const handleArrowRight = () => {
      e.preventDefault();
      if (currentNode.hasChildren && !expandedNodes().has(currentNode.id)) {
        handleExpand(currentNode.id);
      } else if (
        currentNode.hasChildren &&
        expandedNodes().has(currentNode.id) &&
        flattened[currentIndex + 1]
      ) {
        const nextNode = flattened[currentIndex + 1];
        handleFocus(nextNode);
      }
    };
    const handleArrowLeft = () => {
      e.preventDefault();
      if (currentNode.hasChildren && expandedNodes().has(currentNode.id)) {
        handleExpand(currentNode.id);
      } else if (currentNode.level > 0) {
        const parentLevel = currentNode.level - 1;
        for (let i = currentIndex - 1; i >= 0; i--) {
          if (flattened[i].level === parentLevel) {
            handleFocus(flattened[i]);
            break;
          }
        }
      }
    };
    const handleHome = () => {
      e.preventDefault();
      if (flattened.length > 0) {
        handleFocus(flattened[0]);
      }
    };

    switch (e.key) {
      case "Home":
        handleHome();
        break;

      case "ArrowLeft":
        handleArrowLeft();
        break;

      case "ArrowRight":
        handleArrowRight();
        break;

      case "ArrowUp":
        focusUp();
        break;

      case "ArrowDown":
        focusDown();
        break;

      case "Enter":
      case " ":
        e.preventDefault();
        handleSelect(currentNode);
        break;

      case "End":
        e.preventDefault();
        if (flattened.length > 0) {
          handleFocus(flattened[flattened.length - 1]);
        }
        break;

      case "x":
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          handleCut(currentNode.id);
        }
        break;

      case "v":
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          handlePaste(currentNode.id);
        }
        break;

      case "Escape":
        e.preventDefault();
        clearCut();
        break;
    }
  };

  onMount(() => {
    // Expose API methods via ref
    props.ref?.({
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
    });
  });

  // Set focus on first node when root children load
  createEffect(() => {
    const rootNodes = loadedChildren().get(VIRTUAL_ROOT_ID);
    if (rootNodes && rootNodes.length > 0 && !focusedNode()) {
      setFocusedNode(rootNodes[0]);
    }
  });

  // Handle pending expansions reactively
  createEffect(() => {
    const pending = pendingExpansions();
    if (pending.size > 0) {
      // Apply pending expansions
      setExpandedNodes(prev => {
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
      
      // Clear pending expansions
      setPendingExpansions(new Map());
    }
  });

  // Memoize context value to prevent unnecessary re-renders
  const contextValue: TreeContextValue = {
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
    loadChildren: props.loadChildren,
  };

  return (
    <TreeContext.Provider value={contextValue}>
      <div
        ref={containerRef}
        class={`max-h-96 overflow-y-auto ${props.class || ""}`}
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

interface ExpandCollapseIconProps {
  expanded: boolean;
  class?: string;
}

// Helper Functions / Components

const ExpandCollapseIcon = (props: ExpandCollapseIconProps) => (
  <svg
    classList={{
      "w-3 h-3 transition-transform duration-200": true,
      "rotate-90": props.expanded,
      [props.class || ""]: !!props.class,
    }}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="2"
      d="M9 5l7 7-7 7"
    />
  </svg>
);

// Flatten the tree structure for keyboard navigation
const flattenTree = (
  nodes: TreeNode[],
  level = 0,
  expandedNodes: Accessor<Set<string>>,
  loadedChildren: Accessor<Map<string, TreeNode[]>>,
): TreeNode[] => {
  const flattened: TreeNode[] = [];
  const expanded = expandedNodes();
  const loaded = loadedChildren();

  for (const node of nodes) {
    // Only create new object if level differs from current node level
    const nodeWithLevel = node.level === level ? node : { ...node, level };
    flattened.push(nodeWithLevel);

    if (expanded.has(node.id)) {
      const childrenToFlatten = loaded.get(node.id) || [];

      if (childrenToFlatten.length > 0) {
        flattened.push(
          ...flattenTree(
            childrenToFlatten,
            level + 1,
            expandedNodes,
            loadedChildren,
          ),
        );
      }
    }
  }
  return flattened;
};

const TreeElementTransition = (props: { children: JSXElement }): JSXElement => {
  return (
    <Transition
      enterActiveClass="transition-all duration-200 ease-in-out"
      enterClass="opacity-0 max-h-0 -translate-y-2"
      enterToClass="opacity-100 max-h-96 translate-y-0"
      exitActiveClass="transition-all duration-200 ease-in-out"
      exitClass="opacity-100 max-h-96 translate-y-0"
      exitToClass="opacity-0 max-h-0 -translate-y-2"
    >
      {props.children}
    </Transition>
  );
};

const ReplaceLoadingSpinnerTransition = (props: {
  children: JSXElement;
}): JSXElement => {
  return (
    <Transition
      enterActiveClass="transition-all duration-300 ease-out"
      enterClass="opacity-0 scale-95"
      enterToClass="opacity-100 scale-100"
      exitActiveClass="transition-all duration-200 ease-in"
      exitClass="opacity-100 scale-100"
      exitToClass="opacity-0 scale-95"
    >
      {props.children}
    </Transition>
  );
};
