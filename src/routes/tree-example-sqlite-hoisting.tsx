import { createSignal } from "solid-js";
import { StatusDisplay } from "~/components/StatusDisplay";
import { TreeViewRef } from "~/components/tree/types";
import { TreeCard } from "~/components/TreeCard";
import { TreeNode } from "~/components/TreeView";
import { SQLiteTreeViewWithHoisting } from "~/components/SQLiteTreeViewWithHoisting";

export default function TreeExampleSQLite() {
  const [selectedItem, setSelectedItem] = createSignal<TreeNode | null>(null);
  const [focusedItem, setFocusedItem] = createSignal<TreeNode | null>(null);
  const [expandedItems, setExpandedItems] = createSignal<string[]>([]);
  const [hoistedRoot, setHoistedRoot] = createSignal<string>("__virtual_root__");

  let treeViewRef: TreeViewRef & { hoistToNode: (nodeId: string) => void; navigateUp: () => void; resetToRoot: () => void } | undefined;

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
          treeViewRef?.hoistToNode(focused.id);
        }
      },
      classes: "btn-info",
    },
    { label: "Navigate Up", action: () => treeViewRef?.navigateUp(), classes: "btn-secondary" },
    { label: "Reset to Root", action: () => treeViewRef?.resetToRoot(), classes: "btn-warning" },
    { label: "Refresh Tree", action: () => treeViewRef?.refreshTree(), classes: "btn-accent" },
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
            
            <SQLiteTreeViewWithHoisting
              onSelect={handleSelect}
              onFocus={handleFocus}
              onExpand={handleExpand}
              hoistedRoot={hoistedRoot}
              setHoistedRoot={setHoistedRoot}
              setExpandedItems={setExpandedItems}
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
