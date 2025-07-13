import { createSignal, createResource } from "solid-js";
import { action, cache } from "@solidjs/router";
import { StatusDisplay } from "~/components/StatusDisplay";
import { TreeNode, TreeView } from "~/components/TreeView";
import { loadTreeChildren, moveItem, renameItem, createNewItem, deleteItem } from "~/lib/server-actions";

// Cache the tree children loading
const getTreeChildren = cache(async (nodeId: string) => {
  "use server";
  return await loadTreeChildren(nodeId);
}, "tree-children");

// Server actions for tree operations
const moveItemAction = action(async (sourceId: string, targetId: string) => {
  "use server";
  return await moveItem(sourceId, targetId);
}, "move-item");

const renameItemAction = action(async (nodeId: string, newLabel: string) => {
  "use server";
  return await renameItem(nodeId, newLabel);
}, "rename-item");

const createNewItemAction = action(async (parentId: string, type: "folder" | "note" = "note") => {
  "use server";
  return await createNewItem(parentId, type);
}, "create-item");

const deleteItemAction = action(async (nodeId: string) => {
  "use server";
  return await deleteItem(nodeId);
}, "delete-item");

export default function TreeExampleSQLite() {
  const [selectedItem, setSelectedItem] = createSignal<TreeNode | null>(null);
  const [focusedItem, setFocusedItem] = createSignal<TreeNode | null>(null);
  const [expandedItems, setExpandedItems] = createSignal<string[]>([]);
  const [refreshTrigger, setRefreshTrigger] = createSignal(0);

  // Create a resource to load initial tree data for SSR
  const [initialTreeData] = createResource(
    () => refreshTrigger(),
    () => getTreeChildren("__virtual_root__")
  );

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

  /**
   * Load children from the database using the cached server function
   */
  const loadChildren = async (nodeId: string): Promise<TreeNode[]> => {
    try {
      // For root, use the resource data if available, otherwise fetch fresh
      if (nodeId === "__virtual_root__") {
        const cached = initialTreeData();
        if (cached) {
          return cached;
        }
      }
      return await getTreeChildren(nodeId);
    } catch (error) {
      console.error("Error loading children:", error);
      return [];
    }
  };

  /**
   * Triggers a refresh of the tree data
   */
  const triggerRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
    setTimeout(() => {
      treeViewRef?.refreshTree();
    }, 100);
  };

  /**
   * Handles cut and paste operations by calling the server action
   */
  const handleCutPaste = async (source_id: string, target_id: string): Promise<boolean> => {
    try {
      const success = await moveItemAction(source_id, target_id);
      if (success) {
        triggerRefresh();
      }
      return success;
    } catch (error) {
      console.error("Error in cut/paste operation:", error);
      return false;
    }
  };

  /**
   * Handles renaming a tree node by calling the server action
   */
  const handleRename = async (node_id: string, new_label: string): Promise<boolean> => {
    try {
      const success = await renameItemAction(node_id, new_label);
      if (success) {
        console.log(`Renamed node ${node_id} to "${new_label}"`);
        triggerRefresh();
      }
      return success;
    } catch (error) {
      console.error("Error renaming item:", error);
      return false;
    }
  };

  /**
   * Handles creating a new item by calling the server action
   */
  const handleCreateNew = async (parent_id: string): Promise<string | null> => {
    try {
      // For now, create notes by default. This could be enhanced with a dialog
      const newItemId = await createNewItemAction(parent_id, "note");
      
      if (newItemId) {
        console.log(`Created new item with ID ${newItemId} under parent ${parent_id}`);
        triggerRefresh();
      }
      
      return newItemId;
    } catch (error) {
      console.error("Error creating new item:", error);
      return null;
    }
  };

  /**
   * Handles deleting an item by calling the server action
   */
  const handleDelete = async (node_id: string): Promise<boolean> => {
    try {
      const success = await deleteItemAction(node_id);
      
      if (success) {
        console.log(`Deleted node ${node_id} and its descendants`);
        triggerRefresh();
      }
      
      return success;
    } catch (error) {
      console.error("Error deleting item:", error);
      return false;
    }
  };

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

  const handleContextMenu = async (node: TreeNode, event: MouseEvent) => {
    console.log("Context menu for node:", node);
    
    // Simple context menu - you could enhance this with a proper dropdown
    const nodeType = node.type || "item";
    const actions = [
      "1. Cut",
      "2. Paste",
      "3. Move to Root",
      "4. Rename",
      `5. Create New ${nodeType === "folder" ? "Note/Folder" : "Note"} Here`,
      "6. Delete",
      "7. Cancel"
    ];
    
    const action = prompt(
      `Choose action for "${node.label}" (${nodeType}):\n${actions.join("\n")}`,
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
        await handleCutPaste(node.id, "__virtual_root__");
        console.log("Moved to root:", node.id);
        break;
      case "4":
        treeViewRef?.rename(node.id);
        console.log("Rename node:", node.id);
        break;
      case "5":
        // For simplicity, always create notes. Could be enhanced to choose type
        await handleCreateNew(node.id);
        console.log("Create new item under:", node.id);
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
            <h1 class="text-4xl font-bold">TreeView with SQLite</h1>
            <p class="py-6">
              Professional tree component connected to SQLite database with notes and folders.
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
                  <h2 class="card-title">Notes & Folders Explorer</h2>
                  <p class="text-sm opacity-70">
                    Connected to SQLite database - Click to select, use keyboard arrows to navigate
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
                    class="btn btn-outline btn-sm btn-success"
                    onClick={() => treeViewRef?.createNew()}
                  >
                    Create New Note
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
                    onClick={triggerRefresh}
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
                          type: focusedItem()!.type || "unknown",
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
                          type: selectedItem()!.type || "unknown",
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
              <h2 class="card-title">Database Info</h2>
              <div class="space-y-3">
                <div class="flex items-center justify-between">
                  <span class="text-sm">Database Type</span>
                  <div class="badge badge-secondary">SQLite</div>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-sm">Tables</span>
                  <div class="space-x-1">
                    <div class="badge badge-outline badge-sm">notes</div>
                    <div class="badge badge-outline badge-sm">folders</div>
                  </div>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-sm">Data Loading</span>
                  <div class="badge badge-success">Server-side</div>
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