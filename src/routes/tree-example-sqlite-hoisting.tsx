import { createSignal, createResource, For } from "solid-js";
import { StatusDisplay } from "~/components/StatusDisplay";
import { TreeViewRef } from "~/components/tree/types";
import { TreeCard } from "~/components/TreeCard";
import { TreeNode, TreeView } from "~/components/TreeView";
import {
  createNewItem,
  deleteItem,
  getNoteDetails,
  getNotePath,
  loadTreeChildren,
  moveItem,
  renameItem,
} from "~/lib/server-actions";

export default function TreeExampleSQLite() {
  const [selectedItem, setSelectedItem] = createSignal<TreeNode | null>(null);
  const [focusedItem, setFocusedItem] = createSignal<TreeNode | null>(null);
  const [expandedItems, setExpandedItems] = createSignal<string[]>([]);
  const [hoistedRoot, setHoistedRoot] = createSignal<string>("__virtual_root__");

  let treeViewRef: TreeViewRef | undefined;

  // Create a resource for the breadcrumb path
  const [breadcrumbPath] = createResource(hoistedRoot, async (rootId) => {
    if (rootId === "__virtual_root__") {
      return [{
        id: "__virtual_root__",
        label: "Root",
        hasChildren: true,
        level: 0,
        type: "folder" as const
      }];
    }
    return await getNotePath(rootId);
  });

  /**
   * Load children directly from the database
   */
  const loadChildren = async (nodeId: string): Promise<TreeNode[]> => {
    try {
      // If we're asking for virtual root but have a hoisted root, return the hoisted node's children
      if (nodeId === "__virtual_root__" && hoistedRoot() !== "__virtual_root__") {
        return await loadTreeChildren(hoistedRoot());
      }
      return await loadTreeChildren(nodeId);
    } catch (error) {
      console.error("Error loading children:", error);
      return [];
    }
  };

  /**
   * Triggers a refresh of the tree data
   */
  const triggerRefresh = () => {
    treeViewRef?.refreshTree();
  };

  /**
   * Hoist the tree to a specific node (set it as the new root)
   */
  const hoistToNode = (nodeId: string) => {
    setHoistedRoot(nodeId);
    setExpandedItems([]); // Clear expanded items when hoisting
    triggerRefresh();
  };

  /**
   * Navigate up one level in the hoisted hierarchy
   */
  const navigateUp = async () => {
    if (hoistedRoot() === "__virtual_root__") return;
    
    try {
      const path = await getNotePath(hoistedRoot());
      if (path.length >= 2) {
        // Go to parent (second-to-last in path)
        const parent = path[path.length - 2];
        hoistToNode(parent.id);
      } else {
        // Go to root
        hoistToNode("__virtual_root__");
      }
    } catch (error) {
      console.error("Error navigating up:", error);
    }
  };

  /**
   * Reset to the true root
   */
  const resetToRoot = () => {
    hoistToNode("__virtual_root__");
  };

  const handleMoveItemToNewParent = async (
    sourceId: string,
    targetId: string,
  ): Promise<boolean> => {
    try {
      const success = await moveItem(sourceId, targetId);
      if (success) {
        triggerRefresh();
      }
      return success;
    } catch (error) {
      console.error("Error in cut/paste operation:", error);
      return false;
    }
  };

  const handleRename = async (
    nodeId: string,
    newLabel: string,
  ): Promise<boolean> => {
    try {
      const success = await renameItem(nodeId, newLabel);
      if (success) {
        console.log(`Renamed node ${nodeId} to "${newLabel}"`);
        triggerRefresh();
      }
      return success;
    } catch (error) {
      console.error("Error renaming item:", error);
      return false;
    }
  };

  const handleCreateNew = async (parentId: string): Promise<string | null> => {
    try {
      const newItemId = await createNewItem(parentId, "note");
      if (newItemId) {
        console.log(
          `Created new item with ID ${newItemId} under parent ${parentId}`,
        );
        triggerRefresh();
      }
      return newItemId;
    } catch (error) {
      console.error("Error creating new item:", error);
      return null;
    }
  };
  const handleDelete = async (nodeId: string): Promise<boolean> => {
    try {
      const success = await deleteItem(nodeId);
      if (success) {
        console.log(`Deleted node ${nodeId} and its descendants`);
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
    const actions = [
      "1. Cut",
      "2. Paste",
      "3. Move to Root",
      "4. Rename",
      "5. Create New Note Here",
      "6. Delete",
      "7. Hoist Here (Set as Root)",
      "8. Cancel",
    ];

    const action = prompt(
      `Choose action for "${node.label}":\n${actions.join("\n")}`,
      "8",
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
        await handleMoveItemToNewParent(node.id, "__virtual_root__");
        console.log("Moved to root:", node.id);
        break;
      case "4":
        treeViewRef?.rename(node.id);
        console.log("Rename node:", node.id);
        break;
      case "5":
        await handleCreateNew(node.id);
        console.log("Create new item under:", node.id);
        break;
      case "6":
        if (
          confirm(
            `Are you sure you want to delete "${node.label}" and all its children?`,
          )
        ) {
          treeViewRef?.delete(node.id);
          console.log("Delete node:", node.id);
        }
        break;
      case "7":
        hoistToNode(node.id);
        console.log("Hoisted to node:", node.id);
        break;
      default:
        console.log("Context menu cancelled");
    }
  };

  // Helper function to create tree action buttons
  const createTreeButton = (
    label: string,
    onClick: () => void,
    extraClasses = "",
  ) => (
    <button class={`btn btn-outline btn-sm ${extraClasses}`} onClick={onClick}>
      {label}
    </button>
  );

  // Helper function to create info rows
  const createInfoRow = (label: string, content: any) => (
    <div class="flex items-center justify-between">
      <span class="text-sm">{label}</span>
      {content}
    </div>
  );

  // Helper function to create keyboard shortcut rows
  const createShortcutRow = (label: string, keys: string | string[]) => (
    <div class="flex items-center justify-between">
      <span class="text-sm">{label}</span>
      {Array.isArray(keys) ? (
        <div class="space-x-1">
          {keys.map((key) => (
            <kbd class="kbd kbd-xs">{key}</kbd>
          ))}
        </div>
      ) : (
        <kbd class="kbd kbd-xs">{keys}</kbd>
      )}
    </div>
  );

  // Tree action buttons configuration
  const treeActions = [
    { label: "Expand All", action: () => treeViewRef?.expandAll() },
    { label: "Collapse All", action: () => treeViewRef?.collapseAll() },
    {
      label: "Collapse All Except Focused",
      action: () => treeViewRef?.collapseAllExceptFocused(),
      classes: "whitespace-nowrap",
    },
    {
      label: "Collapse All Except Selected",
      action: () => treeViewRef?.collapseAllExceptSelected(),
      classes: "whitespace-nowrap",
    },
    { label: "Collapse Some", action: () => treeViewRef?.collapseSome() },
    { label: "Fold-Cycle", action: () => treeViewRef?.foldCycle() },
    { label: "Clear Cut", action: () => treeViewRef?.clearCut() },
    { label: "Rename Focused", action: () => treeViewRef?.rename() },
    {
      label: "Create New Note",
      action: () => treeViewRef?.createNew(),
      classes: "btn-success",
    },
    {
      label: "Delete Focused",
      action: () => {
        const focused = focusedItem();
        if (
          focused &&
          confirm(
            `Are you sure you want to delete "${focused.label}" and all its children?`,
          )
        ) {
          treeViewRef?.delete();
        }
      },
      classes: "btn-error",
    },
    {
      label: "Hoist Focused",
      action: () => {
        const focused = focusedItem();
        if (focused) {
          hoistToNode(focused.id);
        }
      },
      classes: "btn-info",
    },
    { label: "Navigate Up", action: navigateUp, classes: "btn-secondary" },
    { label: "Reset to Root", action: resetToRoot, classes: "btn-warning" },
    { label: "Refresh Tree", action: triggerRefresh, classes: "btn-accent" },
  ];

  // Database info configuration
  const databaseInfo = [
    {
      label: "Database Type",
      content: <div class="badge badge-secondary">SQLite</div>,
    },
    {
      label: "Schema",
      content: (
        <div class="space-x-1">
          <div class="badge badge-outline badge-sm">
            notes (id, label, parent_id)
          </div>
        </div>
      ),
    },
    {
      label: "Data Loading",
      content: <div class="badge badge-success">Server-side</div>,
    },
    {
      label: "Current Root",
      content: (
        <div class="space-x-1">
          <div class={`badge badge-sm ${hoistedRoot() === "__virtual_root__" ? "badge-neutral" : "badge-info"}`}>
            {hoistedRoot() === "__virtual_root__" ? "True Root" : "Hoisted"}
          </div>
          {hoistedRoot() !== "__virtual_root__" && (
            <div class="badge badge-outline badge-sm font-mono">
              {hoistedRoot()}
            </div>
          )}
        </div>
      ),
    },
  ];

  // Keyboard shortcuts configuration
  const keyboardShortcuts = [
    { label: "Navigate", keys: ["↑", "↓"] },
    { label: "Expand/Child", keys: "→" },
    { label: "Collapse/Parent", keys: "←" },
    { label: "Select", keys: ["Enter", "Space"] },
    { label: "First/Last", keys: ["Home", "End"] },
    { label: "Cut/Paste", keys: ["Ctrl+X", "Ctrl+V"] },
    { label: "Move to Root", keys: "Ctrl+Shift+R" },
    { label: "Clear Cut", keys: "Esc" },
    { label: "Rename", keys: "F2" },
    { label: "Create New", keys: "Insert" },
    { label: "Delete", keys: "Delete" },
    { label: "Hoist (Context Menu)", keys: "Right Click → 7" },
    { label: "Navigate Up", keys: "Use buttons" },
    { label: "Reset to Root", keys: "Use buttons" },
  ];

  return (
    <div class="container mx-auto p-8 space-y-8">
      <div class="hero bg-base-200 rounded-box">
        <div class="hero-content text-center">
          <div class="max-w-md">
            <h1 class="text-4xl font-bold">TreeView with SQLite</h1>
            <p class="py-6">
              Professional tree component connected to SQLite database with
              hierarchical notes.
            </p>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div class="xl:col-span-2">
          <TreeCard title="Notes Explorer">
            <div class="flex flex-col lg:flex-row lg:justify-between lg:items-center mb-4 gap-4">
              <div>
                <p class="text-sm opacity-70">
                  Connected to SQLite database - Click to select, use keyboard
                  arrows to navigate
                </p>
              </div>
              <div class="flex flex-wrap gap-2">
                {treeActions.map((action) =>
                  createTreeButton(
                    action.label,
                    action.action,
                    action.classes || "",
                  ),
                )}
              </div>
            </div>
            
            {/* Breadcrumb Navigation */}
            <div class="mb-4">
              <div class="breadcrumbs text-sm">
                <ul>
                  <For each={breadcrumbPath()}>
                    {(pathNode, index) => (
                      <li>
                        <button
                          class={`link ${index() === (breadcrumbPath()?.length ?? 0) - 1 ? 'link-primary font-semibold' : 'link-hover'}`}
                          onClick={() => {
                            if (pathNode.id !== hoistedRoot()) {
                              hoistToNode(pathNode.id);
                            }
                          }}
                        >
                          {pathNode.label}
                        </button>
                      </li>
                    )}
                  </For>
                </ul>
              </div>
              {hoistedRoot() !== "__virtual_root__" && (
                <div class="text-xs text-base-content/50 mt-1">
                  Tree view is focused on: <span class="font-mono">{hoistedRoot()}</span>
                </div>
              )}
            </div>

            <TreeView
              onSelect={handleSelect}
              onFocus={handleFocus}
              onExpand={handleExpand}
              loadChildren={loadChildren}
              onCreate={handleCreateNew}
              onMoveItemToNewParent={handleMoveItemToNewParent}
              onRename={handleRename}
              onDelete={handleDelete}
              onContextMenu={handleContextMenu}
              ref={(ref) => (treeViewRef = ref)}
            />
          </TreeCard>
        </div>

        <div class="space-y-6">
          <TreeCard title="Current Status">
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
          </TreeCard>

          <TreeCard title="Database Info">
            <div class="space-y-3">
              {databaseInfo.map((info) =>
                createInfoRow(info.label, info.content),
              )}
            </div>
          </TreeCard>

          <TreeCard title="Keyboard Shortcuts">
            <div class="space-y-3">
              {keyboardShortcuts.map((shortcut) =>
                createShortcutRow(shortcut.label, shortcut.keys),
              )}
            </div>
          </TreeCard>
        </div>
      </div>
    </div>
  );
}
