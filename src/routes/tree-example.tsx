import { createSignal } from "solid-js";
import { StatusDisplay } from "~/components/StatusDisplay";
import { TreeNode, TreeView } from "~/components/TreeView";

// Mock data for the tree - only root nodes

// Flat data structure representing the tree hierarchy
const flatTreeData = [
  // Root nodes
  { id: "1", label: "Documents", parent_id: null },
  { id: "2", label: "Pictures", parent_id: null },
  { id: "3", label: "Videos", parent_id: null },
  { id: "4", label: "Music", parent_id: null },

  // Documents children
  { id: "1-1", label: "Work", parent_id: "1" },
  { id: "1-2", label: "Personal", parent_id: "1" },

  // Work children
  { id: "1-1-1", label: "Project A", parent_id: "1-1" },
  { id: "1-1-2", label: "Project B", parent_id: "1-1" },
  { id: "1-1-3", label: "Meeting Notes", parent_id: "1-1" },

  // Personal children
  { id: "1-2-1", label: "Tax Documents", parent_id: "1-2" },
  { id: "1-2-2", label: "Insurance", parent_id: "1-2" },
  { id: "1-2-3", label: "Receipts", parent_id: "1-2" },

  // Project B children
  { id: "1-1-2-1", label: "Design Files", parent_id: "1-1-2" },
  { id: "1-1-2-2", label: "Code Review", parent_id: "1-1-2" },

  // Receipts children
  { id: "1-2-3-1", label: "2023", parent_id: "1-2-3" },
  { id: "1-2-3-2", label: "2024", parent_id: "1-2-3" },

  // Pictures children
  { id: "2-1", label: "Vacation", parent_id: "2" },
  { id: "2-2", label: "Family", parent_id: "2" },
  { id: "2-3", label: "Screenshots", parent_id: "2" },

  // Vacation children
  { id: "2-1-1", label: "Beach Trip 2023", parent_id: "2-1" },
  { id: "2-1-2", label: "Mountain Hike 2024", parent_id: "2-1" },

  // Family children
  { id: "2-2-1", label: "Birthday Party", parent_id: "2-2" },
  { id: "2-2-2", label: "Christmas 2023", parent_id: "2-2" },

  // Videos children
  { id: "3-1", label: "Tutorials", parent_id: "3" },
  { id: "3-2", label: "Movies", parent_id: "3" },
  { id: "3-3", label: "Personal", parent_id: "3" },

  // Movies children
  { id: "3-2-1", label: "Action", parent_id: "3-2" },
  { id: "3-2-2", label: "Comedy", parent_id: "3-2" },
  { id: "3-2-3", label: "Documentary", parent_id: "3-2" },
];

/**
 * Handles cut and paste operations for tree nodes by updating the parent-child relationships
 * in the flat data structure.
 * 
 * @param source_id - The ID of the node being moved (cut)
 * @param target_id - The ID of the destination node where the source will be pasted
 * @returns boolean - Returns true if the operation was successful, false otherwise
 * 
 * @example
 * // Move "Project A" to be a child of "Personal"
 * handleCutPaste("1-1-1", "1-2");
 * 
 * // Move a node to the root level
 * handleCutPaste("1-1-1", "__virtual_root__");
 */
const handleCutPaste = (source_id: string, target_id: string): boolean => {
  // Find the source item in the flat data structure
  const sourceItem = flatTreeData.find((item) => item.id === source_id);

  // Check if we're trying to move a parent into its own child
  // If target's parent is the source, it's not clear what the user wants, so do nothing
  const targetItem = flatTreeData.find((item) => item.id === target_id);

  if (targetItem && targetItem.parent_id === source_id) {
    return false;
  }

  // Otherwise perform the operation

  if (sourceItem) {
    // Update the parent_id to move the item to the new target
    // If target is virtual root, set parent_id to null
    sourceItem.parent_id = target_id === "__virtual_root__" ? null : target_id;
    return true;
  }

  return false;
};

/**
 * Handles renaming a tree node by updating its label in the flat data structure.
 * 
 * @param node_id - The ID of the node being renamed
 * @param new_label - The new label for the node
 * @returns boolean - Returns true if the operation was successful, false otherwise
 * 
 * @example
 * // Rename "Project A" to "New Project"
 * handleRename("1-1-1", "New Project");
 */
const handleRename = (node_id: string, new_label: string): boolean => {
  // Find the item in the flat data structure
  const item = flatTreeData.find((item) => item.id === node_id);

  if (item && new_label.trim()) {
    // Update the label
    item.label = new_label.trim();
    console.log(`Renamed node ${node_id} to "${new_label}"`);
    return true;
  }

  return false;
};

/**
 * Handles creating a new item in the tree by adding it to the flat data structure.
 * 
 * @param parent_id - The ID of the parent node where the new item will be created
 * @returns string | null - Returns the ID of the new item if successful, null otherwise
 * 
 * @example
 * // Create a new item under "Personal"
 * const newItemId = handleCreateNew("1-2");
 * 
 * // Create a new item at root level
 * const newItemId = handleCreateNew("__virtual_root__");
 */
const handleCreateNew = (parent_id: string): string | null => {
  // Generate a unique ID for the new item
  const timestamp = Date.now();
  const newId = `new-${timestamp}`;
  
  // Create the new item
  const newItem = {
    id: newId,
    label: "New Item",
    parent_id: parent_id === "__virtual_root__" ? null : parent_id
  };

  // Add to the flat data structure
  flatTreeData.push(newItem);
  console.log(`Created new item "${newItem.label}" with ID ${newId} under parent ${parent_id}`);
  
  return newId;
};

/**
 * Handles deleting an item from the tree by removing it and all its descendants
 * from the flat data structure.
 * 
 * @param node_id - The ID of the node to delete
 * @returns boolean - Returns true if the operation was successful, false otherwise
 * 
 * @example
 * // Delete "Project A" and all its children
 * handleDelete("1-1-1");
 */
const handleDelete = (node_id: string): boolean => {
  // Find all descendants of the node to delete
  const getDescendants = (parentId: string): string[] => {
    const children = flatTreeData
      .filter(item => item.parent_id === parentId)
      .map(item => item.id);
    
    const descendants = [...children];
    
    // Recursively find all descendants
    for (const childId of children) {
      descendants.push(...getDescendants(childId));
    }
    
    return descendants;
  };
  
  // Get all nodes to delete (the target node + all its descendants)
  const nodesToDelete = [node_id, ...getDescendants(node_id)];
  
  // Remove all nodes from the flat data structure
  const initialLength = flatTreeData.length;
  
  for (let i = flatTreeData.length - 1; i >= 0; i--) {
    if (nodesToDelete.includes(flatTreeData[i].id)) {
      flatTreeData.splice(i, 1);
    }
  }
  
  const deletedCount = initialLength - flatTreeData.length;
  console.log(`Deleted ${deletedCount} nodes starting with ${node_id}`);
  
  return deletedCount > 0;
};

// Mock function to simulate loading children from a remote source
const loadChildren = async (nodeId: string): Promise<TreeNode[]> => {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 300));

  // Handle virtual root - return top-level items
  if (nodeId === "__virtual_root__") {
    return flatTreeData
      .filter((item) => item.parent_id === null)
      .map((item) => ({
        id: item.id,
        label: item.label,
        hasChildren: flatTreeData.some((child) => child.parent_id === item.id),
        level: 0,
      }));
  }

  // Find children from flat data structure
  const children = flatTreeData
    .filter((item) => item.parent_id === nodeId)
    .map((item) => ({
      id: item.id,
      label: item.label,
      hasChildren: flatTreeData.some((child) => child.parent_id === item.id),
      level: 0,
    }));

  return children;
};
export default function TreeExample() {
  const [selectedItem, setSelectedItem] = createSignal<TreeNode | null>(null);
  const [focusedItem, setFocusedItem] = createSignal<TreeNode | null>(null);
  const [expandedItems, setExpandedItems] = createSignal<string[]>([]);

  // TODO should this be a type?
  let treeViewRef:
    | {
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
        refreshTree: () => void;
        rename: (nodeId?: string) => void;
        createNew: (parentId?: string) => void;
        delete: (nodeId?: string) => void;
      }
    | undefined;

  const handleSelect = (node: TreeNode) => {
    setSelectedItem(node);
    console.log("Selected:", node);
  };

  const handleFocus = (node: TreeNode) => {
    setFocusedItem(node);
    console.log("Focused:", node);
  };

  const handleExpand = (nodeId: string) => {
    setExpandedItems((prev) =>
      prev.includes(nodeId)
        ? prev.filter((id) => id !== nodeId)
        : [...prev, nodeId],
    );
    console.log("Expanded/Collapsed:", nodeId);
  };

  const handleContextMenu = (node: TreeNode, event: MouseEvent) => {
    console.log("Context menu for node:", node);
    
    // Simple context menu - you could enhance this with a proper dropdown
    const action = prompt(
      `Choose action for "${node.label}":\n1. Cut\n2. Paste\n3. Move to Root\n4. Rename\n5. Create New Child\n6. Delete\n7. Cancel`,
      "7",
    );
    
    switch (action) {
      case "1":
        treeViewRef?.cut(node.id);
        console.log("Cut node:", node.id);
        break;
      case "2":
        treeViewRef?.paste(node.id);
        console.log("Paste to node:", node.id);
        break;
      case "3":
        handleCutPaste(node.id, "__virtual_root__");
        treeViewRef?.refreshTree();
        console.log("Moved to root:", node.id);
        break;
      case "4":
        treeViewRef?.rename(node.id);
        console.log("Rename node:", node.id);
        break;
      case "5":
        treeViewRef?.createNew(node.id);
        console.log("Create new child under:", node.id);
        break;
      case "6":
        if (confirm(`Are you sure you want to delete "${node.label}" and all its children?`)) {
          treeViewRef?.delete(node.id);
          console.log("Delete node:", node.id);
        }
        break;
      default:
        console.log("Context menu cancelled");
    }
  };

  return (
    <div class="container mx-auto p-8 space-y-8">
      <div class="hero bg-base-200 rounded-box">
        <div class="hero-content text-center">
          <div class="max-w-md">
            <h1 class="text-4xl font-bold">TreeView Component</h1>
            <p class="py-6">
              Professional tree component with DaisyUI styling, keyboard
              navigation, and lazy loading.
            </p>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div class="xl:col-span-2">
          <div class="card bg-base-100 shadow-xl">
            <div class="card-body">
              <div class="flex flex-col lg:flex-row lg:justify-between lg:items-center mb-4 gap-4">
                <div>
                  <h2 class="card-title">File Explorer</h2>
                  <p class="text-sm opacity-70">
                    Click to select, use keyboard arrows to navigate
                  </p>
                </div>
                <div class="flex flex-wrap gap-2">
                  <button
                    class="btn btn-outline btn-sm"
                    onClick={() => treeViewRef?.expandAll()}
                  >
                    Expand All
                  </button>
                  <button
                    class="btn btn-outline btn-sm"
                    onClick={() => treeViewRef?.collapseAll()}
                  >
                    Collapse All
                  </button>
                  <button
                    class="btn btn-outline btn-sm whitespace-nowrap"
                    onClick={() => treeViewRef?.collapseAllExceptFocused()}
                  >
                    Collapse All Except Focused
                  </button>
                  <button
                    class="btn btn-outline btn-sm whitespace-nowrap"
                    onClick={() => treeViewRef?.collapseAllExceptSelected()}
                  >
                    Collapse All Except Selected
                  </button>
                  <button
                    class="btn btn-outline btn-sm"
                    onClick={() => treeViewRef?.collapseSome()}
                  >
                    Collapse Some
                  </button>
                  <button
                    class="btn btn-outline btn-sm"
                    onClick={() => treeViewRef?.foldCycle()}
                  >
                    Fold-Cycle
                  </button>
                  <button
                    class="btn btn-outline btn-sm"
                    onClick={() => treeViewRef?.focusAndReveal("3-2-2")}
                  >
                    Focus & Reveal (3-2-2)
                  </button>
                  <button
                    class="btn btn-outline btn-sm"
                    onClick={() => treeViewRef?.cut("1-1-1")}
                  >
                    Cut Project A
                  </button>
                  <button
                    class="btn btn-outline btn-sm"
                    onClick={() => treeViewRef?.paste("1-2")}
                  >
                    Paste to Personal
                  </button>
                  <button
                    class="btn btn-outline btn-sm"
                    onClick={() => treeViewRef?.paste("__virtual_root__")}
                  >
                    Move Cut to Root
                  </button>
                  <button
                    class="btn btn-outline btn-sm"
                    onClick={() => treeViewRef?.clearCut()}
                  >
                    Clear Cut
                  </button>
                  <button
                    class="btn btn-outline btn-sm"
                    onClick={() => treeViewRef?.rename()}
                  >
                    Rename Focused
                  </button>
                  <button
                    class="btn btn-outline btn-sm"
                    onClick={() => treeViewRef?.createNew()}
                  >
                    Create New Item
                  </button>
                  <button
                    class="btn btn-outline btn-sm btn-error"
                    onClick={() => {
                      const focused = focusedItem();
                      if (focused && confirm(`Are you sure you want to delete "${focused.label}" and all its children?`)) {
                        treeViewRef?.delete();
                      }
                    }}
                  >
                    Delete Focused
                  </button>
                  <button
                    class="btn btn-outline btn-sm btn-accent"
                    onClick={() => treeViewRef?.refreshTree()}
                  >
                    Refresh Tree
                  </button>
                </div>
              </div>
              <TreeView
                onSelect={handleSelect}
                onFocus={handleFocus}
                onExpand={handleExpand}
                onCutPaste={handleCutPaste}
                onRename={handleRename}
                onCreate={handleCreateNew}
                onDelete={handleDelete}
                onContextMenu={handleContextMenu}
                loadChildren={loadChildren}
                ref={(ref) => (treeViewRef = ref)}
              />
            </div>
          </div>
        </div>

        <div class="space-y-6">
          <div class="card bg-base-100 shadow-xl">
            <div class="card-body">
              <h2 class="card-title">Current Status</h2>

              <div class="space-y-4">
                <StatusDisplay
                  title="FOCUSED ITEM"
                  data={
                    focusedItem()
                      ? {
                          id: focusedItem()!.id,
                          label: focusedItem()!.label,
                          level: focusedItem()!.level || 0,
                        }
                      : null
                  }
                />

                <StatusDisplay
                  title="SELECTED ITEM"
                  data={
                    selectedItem()
                      ? {
                          id: selectedItem()!.id,
                          label: selectedItem()!.label,
                          hasChildren: selectedItem()!.hasChildren,
                        }
                      : null
                  }
                />

                <div>
                  <h3 class="font-semibold text-sm text-base-content/70 mb-2">
                    EXPANDED NODES
                  </h3>
                  <div class="flex flex-wrap gap-1">
                    {expandedItems().length > 0 ? (
                      expandedItems().map((id) => (
                        <div class="badge badge-primary badge-sm">{id}</div>
                      ))
                    ) : (
                      <div class="badge badge-ghost badge-sm">None</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="card bg-base-100 shadow-xl">
            <div class="card-body">
              <h2 class="card-title">Keyboard Shortcuts</h2>
              <div class="space-y-3">
                <div class="flex items-center justify-between">
                  <span class="text-sm">Navigate</span>
                  <div class="space-x-1">
                    <kbd class="kbd kbd-xs">↑</kbd>
                    <kbd class="kbd kbd-xs">↓</kbd>
                  </div>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-sm">Expand/Child</span>
                  <kbd class="kbd kbd-xs">→</kbd>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-sm">Collapse/Parent</span>
                  <kbd class="kbd kbd-xs">←</kbd>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-sm">Select</span>
                  <div class="space-x-1">
                    <kbd class="kbd kbd-xs">Enter</kbd>
                    <kbd class="kbd kbd-xs">Space</kbd>
                  </div>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-sm">First/Last</span>
                  <div class="space-x-1">
                    <kbd class="kbd kbd-xs">Home</kbd>
                    <kbd class="kbd kbd-xs">End</kbd>
                  </div>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-sm">Cut/Paste</span>
                  <div class="space-x-1">
                    <kbd class="kbd kbd-xs">Ctrl+X</kbd>
                    <kbd class="kbd kbd-xs">Ctrl+V</kbd>
                  </div>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-sm">Move to Root</span>
                  <kbd class="kbd kbd-xs">Ctrl+Shift+R</kbd>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-sm">Clear Cut</span>
                  <kbd class="kbd kbd-xs">Esc</kbd>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-sm">Rename</span>
                  <kbd class="kbd kbd-xs">F2</kbd>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-sm">Create New</span>
                  <kbd class="kbd kbd-xs">Insert</kbd>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-sm">Delete</span>
                  <kbd class="kbd kbd-xs">Delete</kbd>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
