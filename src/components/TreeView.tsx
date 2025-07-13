import {
  Accessor,
  createContext,
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  onMount,
  Show,
  Suspense,
  useContext,
} from "solid-js";

type TreeSelectHandler = (node: TreeNode) => void;
type TreeFocusHandler = (node: TreeNode) => void;
type TreeExpandHandler = (nodeId: string) => void;
type TreeChildrenLoader = (nodeId: string) => Promise<TreeNode[]>;
type TreeChildrenLoadedHandler = (nodeId: string, children: TreeNode[]) => void;

interface TreeContextValue {
  expandedNodes: Accessor<Set<string>>;
  focusedNodeId: Accessor<string | undefined>;
  selectedNodeId: Accessor<string | undefined>;
  loadedChildren: Accessor<Map<string, TreeNode[]>>;
  onSelect: TreeSelectHandler;
  onFocus: TreeFocusHandler;
  onExpand: TreeExpandHandler;
  onChildrenLoaded: TreeChildrenLoadedHandler;
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
  children?: TreeNode[];
  hasChildren?: boolean;
  isExpanded?: boolean;
  level: number;
}

export interface TreeViewProps {
  nodes: TreeNode[];
  onSelect?: TreeSelectHandler;
  onFocus?: TreeFocusHandler;
  onExpand?: TreeExpandHandler;
  loadChildren?: TreeChildrenLoader;
  class?: string;
}

export interface TreeItemProps {
  node: TreeNode;
}

const TreeItem = (props: TreeItemProps) => {
  const ctx = useTreeContext();
  
  // Use the expanded state from context
  const expanded = () => ctx.expandedNodes().has(props.node.id);

  // Only load children if we don't have static children
  const [childrenResource] = createResource(
    () =>
      expanded() && props.node.hasChildren && !props.node.children
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

  return (
    <li>
      <a
        classList={{
          "items-center gap-2 flex": true,
          active: isSelected(),
          "bg-primary/50 ": isFocused(),
          // Not sure if I want an outline ring
          "ring-2 ring-primary ring-offset-2 ring-offset-base-200":
            isFocused() && false,
        }}
        onClick={handleClick}
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

      <Show when={expanded() && props.node.hasChildren}>
        <ul>
          <Show
            when={props.node.children && props.node.children.length > 0}
            fallback={
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
                    <TreeItem
                      node={{ ...child, level: level + 1 }}
                    />
                  )}
                </For>
              </Suspense>
            }
          >
            <For each={props.node.children}>
              {(child) => (
                <TreeItem
                  node={{ ...child, level: level + 1 }}
                />
              )}
            </For>
          </Show>
        </ul>
      </Show>
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


export const TreeView = (props: TreeViewProps) => {
  const [selectedNode, setSelectedNode] = createSignal<TreeNode | null>(null);
  const [focusedNode, setFocusedNode] = createSignal<TreeNode | null>(null);
  const [expandedNodes, setExpandedNodes] = createSignal<Set<string>>(
    new Set(),
  );
  const [loadedChildren, setLoadedChildren] = createSignal<
    Map<string, TreeNode[]>
  >(new Map());
  let treeRef: HTMLUListElement | undefined;
  let containerRef: HTMLDivElement | undefined;

  // Memoize expensive tree flattening computation
  const flattenedNodes = createMemo(() => 
    flattenTree(props.nodes, undefined, expandedNodes, loadedChildren)
  );

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
    }
  };

  onMount(() => {
    if (props.nodes.length > 0) {
      setFocusedNode(props.nodes[0]);
      // The reactive effect will handle scrolling
    }
  });

  // Memoize context value to prevent unnecessary re-renders
  const contextValue: TreeContextValue = {
    expandedNodes,
    focusedNodeId,
    selectedNodeId,
    loadedChildren,
    onSelect: handleSelect,
    onFocus: handleFocus,
    onExpand: handleExpand,
    onChildrenLoaded: handleChildrenLoaded,
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
          <For each={props.nodes}>
            {(node) => (
              <TreeItem
                node={{ ...node, level: 0 }}
              />
            )}
          </For>
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
      let childrenToFlatten: TreeNode[] = [];

      // Prioritize static children if available
      if (node.children && node.children.length > 0) {
        childrenToFlatten = node.children;
      }
      // Otherwise use dynamically loaded children
      else if (loaded.has(node.id)) {
        childrenToFlatten = loaded.get(node.id) || [];
      }

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
