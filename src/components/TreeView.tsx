import {
  Accessor,
  createEffect,
  createResource,
  createSignal,
  For,
  onMount,
  Show,
  Suspense,
} from "solid-js";

type TreeSelectHandler = (node: TreeNode) => void;
type TreeFocusHandler = (node: TreeNode) => void;
type TreeExpandHandler = (nodeId: string) => void;
type TreeChildrenLoader = (nodeId: string) => Promise<TreeNode[]>;
type TreeChildrenLoadedHandler = (nodeId: string, children: TreeNode[]) => void;

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
  onSelect?: TreeSelectHandler;
  onFocus?: TreeFocusHandler;
  onExpand?: TreeExpandHandler;
  loadChildren?: TreeChildrenLoader;
  onChildrenLoaded?: TreeChildrenLoadedHandler;
  expandedNodes?: Set<string>;
  focusedNodeId?: string;
  selectedNodeId?: string;
}

const TreeItem = (props: TreeItemProps) => {
  // Use the expanded state from parent instead of local state
  const expanded = () => props.expandedNodes?.has(props.node.id) || false;

  // Only load children if we don't have static children
  const [childrenResource] = createResource(
    () =>
      expanded() && props.node.hasChildren && !props.node.children
        ? props.node.id
        : null,
    async (nodeId) => {
      const children = await (props.loadChildren?.(nodeId) ||
        Promise.resolve([]));
      // Notify parent about loaded children so they can be included in keyboard navigation
      if (children.length > 0) {
        props.onChildrenLoaded?.(nodeId, children);
      }
      return children;
    },
  );

  const handleToggle = () => {
    if (props.onExpand) {
      props.onExpand(props.node.id);
    }
  };

  const handleClick = () => {
    props.onFocus?.(props.node);
    props.onSelect?.(props.node);
  };

  const level = props.node.level;
  const isSelected = () => props.selectedNodeId === props.node.id;
  const isFocused = () => props.focusedNodeId === props.node.id;

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
                      onSelect={props.onSelect}
                      onFocus={props.onFocus}
                      onExpand={props.onExpand}
                      loadChildren={props.loadChildren}
                      onChildrenLoaded={props.onChildrenLoaded}
                      expandedNodes={props.expandedNodes}
                      focusedNodeId={props.focusedNodeId}
                      selectedNodeId={props.selectedNodeId}
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
                  onSelect={props.onSelect}
                  onFocus={props.onFocus}
                  onExpand={props.onExpand}
                  loadChildren={props.loadChildren}
                  onChildrenLoaded={props.onChildrenLoaded}
                  expandedNodes={props.expandedNodes}
                  focusedNodeId={props.focusedNodeId}
                  selectedNodeId={props.selectedNodeId}
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
  const [flattenedNodes, setFlattenedNodes] = createSignal<TreeNode[]>([]);

  let treeRef: HTMLUListElement | undefined;
  let containerRef: HTMLDivElement | undefined;

  createEffect(() => {
    // Re-flatten when expanded nodes or loaded children change
    expandedNodes();
    loadedChildren();
    setFlattenedNodes(
      flattenTree(props.nodes, undefined, expandedNodes, loadedChildren),
    );
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

    const currentIndex = flattened.findIndex((n) => n.id === currentNode.id);

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

  return (
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
              onSelect={handleSelect}
              onFocus={handleFocus}
              onExpand={handleExpand}
              loadChildren={props.loadChildren}
              onChildrenLoaded={handleChildrenLoaded}
              expandedNodes={expandedNodes()}
              focusedNodeId={focusedNode()?.id}
              selectedNodeId={selectedNode()?.id}
            />
          )}
        </For>
      </ul>
    </div>
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
    const nodeWithLevel = { ...node, level };
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
