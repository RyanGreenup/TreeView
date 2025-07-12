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
  isSelected?: boolean;
  isFocused?: boolean;
}

const TreeItem = (props: TreeItemProps) => {
  const [expanded, setExpanded] = createSignal(props.node.isExpanded || false);
  const [childrenResource] = createResource(
    () => expanded() && props.node.hasChildren ? props.node.id : null,
    (nodeId) => props.loadChildren?.(nodeId) || Promise.resolve([])
  );

  const handleToggle = () => {
    const newExpanded = !expanded();
    setExpanded(newExpanded);
    if (newExpanded && props.onExpand) {
      props.onExpand(props.node.id);
    }
  };

  const handleClick = () => {
    props.onFocus?.(props.node);
    props.onSelect?.(props.node);
  };

  const level = props.node.level || 0;

  return (
    <li class="tree-item" role="treeitem" aria-expanded={expanded()}>
      <div
        class={`
          menu-item flex items-center gap-2 p-2 cursor-pointer
          ${props.isSelected ? 'active' : ''}
          ${props.isFocused ? 'focus' : ''}
        `}
        style={{ "padding-left": `${level * 1.5 + 0.5}rem` }}
        onClick={handleClick}
        data-node-id={props.node.id}
      >
        <Show 
          when={props.node.hasChildren}
          fallback={<div class="w-4"></div>}
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
            <svg
              class={`w-3 h-3 transition-transform ${expanded() ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </Show>
        <span class="flex-1 text-sm">{props.node.label}</span>
      </div>
      
      <Show when={expanded() && props.node.hasChildren}>
        <ul class="menu-items" role="group">
          <Suspense
            fallback={
              <li class="p-2 flex items-center gap-2 text-sm opacity-60" style={{ "padding-left": `${(level + 1) * 1.5 + 0.5}rem` }}>
                <span class="loading loading-spinner loading-xs"></span>
                <span>Loading...</span>
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
                  isSelected={props.isSelected}
                  isFocused={props.isFocused}
                />
              )}
            </For>
          </Suspense>
        </ul>
      </Show>
    </li>
  );
};

export const TreeView = (props: TreeViewProps) => {
  const [selectedNode, setSelectedNode] = createSignal<TreeNode | null>(null);
  const [focusedNode, setFocusedNode] = createSignal<TreeNode | null>(null);
  const [expandedNodes, setExpandedNodes] = createSignal<Set<string>>(new Set());
  const [flattenedNodes, setFlattenedNodes] = createSignal<TreeNode[]>([]);

  let treeRef: HTMLUListElement | undefined;

  // Flatten the tree structure for keyboard navigation
  const flattenTree = (nodes: TreeNode[], level = 0): TreeNode[] => {
    const flattened: TreeNode[] = [];
    const expanded = expandedNodes();
    
    for (const node of nodes) {
      const nodeWithLevel = { ...node, level };
      flattened.push(nodeWithLevel);
      
      if (expanded.has(node.id) && node.children) {
        flattened.push(...flattenTree(node.children, level + 1));
      }
    }
    return flattened;
  };

  createEffect(() => {
    setFlattenedNodes(flattenTree(props.nodes));
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
    }
  });

  return (
    <ul
      ref={treeRef}
      class={`menu bg-base-200 rounded-box w-full ${props.class || ''}`}
      role="tree"
      aria-label="Tree View"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <For each={props.nodes}>
        {(node) => (
          <TreeItem
            node={{ ...node, level: 0, isExpanded: expandedNodes().has(node.id) }}
            onSelect={handleSelect}
            onFocus={handleFocus}
            onExpand={handleExpand}
            loadChildren={props.loadChildren}
            isSelected={selectedNode()?.id === node.id}
            isFocused={focusedNode()?.id === node.id}
          />
        )}
      </For>
    </ul>
  );
};