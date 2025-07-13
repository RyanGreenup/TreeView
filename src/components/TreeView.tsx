import { 
  createSignal, 
  createResource, 
  For, 
  Show, 
  Suspense, 
  onMount,
  createEffect,
  JSX
} from "solid-js";

export interface TreeNode {
  id: string;
  label: string;
  children?: TreeNode[];
  hasChildren?: boolean;
  isExpanded?: boolean;
  level?: number;
}

export interface TreeViewProps {
  nodes: TreeNode[];
  onSelect?: (node: TreeNode) => void;
  onFocus?: (node: TreeNode) => void;
  onExpand?: (nodeId: string) => void;
  loadChildren?: (nodeId: string) => Promise<TreeNode[]>;
  class?: string;
}

export interface TreeItemProps {
  node: TreeNode;
  onSelect?: (node: TreeNode) => void;
  onFocus?: (node: TreeNode) => void;
  onExpand?: (nodeId: string) => void;
  loadChildren?: (nodeId: string) => Promise<TreeNode[]>;
  onChildrenLoaded?: (nodeId: string, children: TreeNode[]) => void;
  expandedNodes?: Set<string>;
  focusedNodeId?: string;
  selectedNodeId?: string;
}

const TreeItem = (props: TreeItemProps) => {
  // Use the expanded state from parent instead of local state
  const expanded = () => props.expandedNodes?.has(props.node.id) || false;
  
  // Only load children if we don't have static children
  const [childrenResource] = createResource(
    () => expanded() && props.node.hasChildren && !props.node.children ? props.node.id : null,
    async (nodeId) => {
      const children = await (props.loadChildren?.(nodeId) || Promise.resolve([]));
      // Notify parent about loaded children so they can be included in keyboard navigation
      if (children.length > 0) {
        props.onChildrenLoaded?.(nodeId, children);
      }
      return children;
    }
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

  const level = props.node.level || 0;
  const isSelected = () => props.selectedNodeId === props.node.id;
  const isFocused = () => props.focusedNodeId === props.node.id;

  return (
    <>
      <div
        class={`
          flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-all duration-200
          ${isSelected() ? 'bg-primary text-primary-content shadow-sm' : 'hover:bg-base-200'}
          ${isFocused() ? 'ring-2 ring-primary ring-offset-2 ring-offset-base-100' : ''}
          ${isSelected() && isFocused() ? 'ring-2 ring-primary-content ring-offset-2 ring-offset-primary' : ''}
        `}
        style={{ "margin-left": `${level * 1.5}rem` }}
        onClick={handleClick}
        data-node-id={props.node.id}
        role="treeitem"
        aria-expanded={expanded()}
        aria-level={level + 1}
        aria-selected={isSelected()}
      >
        <Show 
          when={props.node.hasChildren}
          fallback={<div class="w-4 h-4"></div>}
        >
          <button
            class={`
              btn btn-ghost btn-xs btn-square flex-shrink-0 
              ${isSelected() ? 'btn-primary' : ''} 
              hover:btn-primary focus:btn-primary
            `}
            onClick={(e) => {
              e.stopPropagation();
              handleToggle();
            }}
            tabIndex={-1}
            aria-label={expanded() ? "Collapse" : "Expand"}
          >
            <svg
              class={`w-3 h-3 transition-transform duration-200 ${expanded() ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </Show>
        <span class="flex-1 text-sm truncate">{props.node.label}</span>
      </div>
      
      <Show when={expanded() && props.node.hasChildren}>
        <div role="group">
          <Show
            when={props.node.children && props.node.children.length > 0}
            fallback={
              <Suspense
                fallback={
                  <div 
                    class="flex items-center gap-2 p-2 text-sm opacity-60" 
                    style={{ "margin-left": `${(level + 1) * 1.5}rem` }}
                  >
                    <span class="loading loading-spinner loading-xs"></span>
                    <span>Loading...</span>
                  </div>
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
        </div>
      </Show>
    </>
  );
};

// Helper function to scroll an element into view if it's not fully visible
const scrollIntoViewIfNeeded = (element: HTMLElement, container: HTMLElement) => {
  const elementRect = element.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  
  const isAbove = elementRect.top < containerRect.top;
  const isBelow = elementRect.bottom > containerRect.bottom;
  
  if (isAbove || isBelow) {
    // Try modern scrollIntoView first
    if ('scrollIntoView' in element && typeof element.scrollIntoView === 'function') {
      try {
        element.scrollIntoView({
          behavior: 'smooth',
          block: isAbove ? 'start' : 'end',
          inline: 'nearest'
        });
      } catch {
        // Fallback for older browsers
        element.scrollIntoView(isAbove);
      }
    } else {
      // Manual scroll fallback
      const elementTop = element.offsetTop;
      const elementHeight = element.offsetHeight;
      const containerScrollTop = container.scrollTop;
      const containerHeight = container.clientHeight;
      
      if (isAbove) {
        container.scrollTop = elementTop - 10; // 10px padding
      } else if (isBelow) {
        container.scrollTop = elementTop - containerHeight + elementHeight + 10;
      }
    }
  }
};

export const TreeView = (props: TreeViewProps) => {
  const [selectedNode, setSelectedNode] = createSignal<TreeNode | null>(null);
  const [focusedNode, setFocusedNode] = createSignal<TreeNode | null>(null);
  const [expandedNodes, setExpandedNodes] = createSignal<Set<string>>(new Set());
  const [loadedChildren, setLoadedChildren] = createSignal<Map<string, TreeNode[]>>(new Map());
  const [flattenedNodes, setFlattenedNodes] = createSignal<TreeNode[]>([]);

  let treeRef: HTMLDivElement | undefined;

  // Flatten the tree structure for keyboard navigation
  const flattenTree = (nodes: TreeNode[], level = 0): TreeNode[] => {
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
          flattened.push(...flattenTree(childrenToFlatten, level + 1));
        }
      }
    }
    return flattened;
  };

  createEffect(() => {
    // Re-flatten when expanded nodes or loaded children change
    expandedNodes();
    loadedChildren();
    setFlattenedNodes(flattenTree(props.nodes));
  });

  const handleSelect = (node: TreeNode) => {
    setSelectedNode(node);
    props.onSelect?.(node);
  };

  const handleFocus = (node: TreeNode) => {
    setFocusedNode(node);
    props.onFocus?.(node);
    
    // Scroll the focused item into view
    setTimeout(() => {
      const focusedElement = treeRef?.querySelector(`[data-node-id="${node.id}"]`) as HTMLElement;
      if (focusedElement && treeRef) {
        scrollIntoViewIfNeeded(focusedElement, treeRef);
      }
    }, 0);
  };

  const handleExpand = (nodeId: string) => {
    setExpandedNodes(prev => {
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
    setLoadedChildren(prev => {
      const newMap = new Map(prev);
      newMap.set(nodeId, children);
      return newMap;
    });
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    const flattened = flattenedNodes();
    const currentNode = focusedNode();
    if (!currentNode) return;
    
    const currentIndex = flattened.findIndex(n => n.id === currentNode.id);
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (currentIndex < flattened.length - 1) {
          const nextNode = flattened[currentIndex + 1];
          handleFocus(nextNode);
        }
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        if (currentIndex > 0) {
          const prevNode = flattened[currentIndex - 1];
          handleFocus(prevNode);
        }
        break;
        
      case 'ArrowRight':
        e.preventDefault();
        if (currentNode.hasChildren && !expandedNodes().has(currentNode.id)) {
          handleExpand(currentNode.id);
        } else if (currentNode.hasChildren && expandedNodes().has(currentNode.id) && flattened[currentIndex + 1]) {
          const nextNode = flattened[currentIndex + 1];
          handleFocus(nextNode);
        }
        break;
        
      case 'ArrowLeft':
        e.preventDefault();
        if (currentNode.hasChildren && expandedNodes().has(currentNode.id)) {
          handleExpand(currentNode.id);
        } else if (currentNode.level && currentNode.level > 0) {
          const parentLevel = currentNode.level - 1;
          for (let i = currentIndex - 1; i >= 0; i--) {
            if (flattened[i].level === parentLevel) {
              handleFocus(flattened[i]);
              break;
            }
          }
        }
        break;
        
      case 'Enter':
      case ' ':
        e.preventDefault();
        handleSelect(currentNode);
        break;
        
      case 'Home':
        e.preventDefault();
        if (flattened.length > 0) {
          handleFocus(flattened[0]);
        }
        break;
        
      case 'End':
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
      // Ensure the first item is visible
      setTimeout(() => {
        const firstElement = treeRef?.querySelector('[data-node-id]') as HTMLElement;
        if (firstElement && treeRef) {
          scrollIntoViewIfNeeded(firstElement, treeRef);
        }
      }, 100);
    }
  });

  return (
    <div
      ref={treeRef}
      class={`bg-base-100 border border-base-300 rounded-box p-4 w-full ${props.class || ''}`}
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
    </div>
  );
};