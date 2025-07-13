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

const handleCutPaste = (source_id: string, target_id: string) => {
  // Find the source item in the flat data structure
  const sourceItem = flatTreeData.find((item) => item.id === source_id);

  if (sourceItem) {
    // Update the parent_id to move the item to the new target
    sourceItem.parent_id = target_id;
  }
};

const handleMoveToRoot = (source_id: string) => {
  // Find the source item in the flat data structure
  const sourceItem = flatTreeData.find((item) => item.id === source_id);

  if (sourceItem) {
    // Update the parent_id to null to move the item to the root
    sourceItem.parent_id = null;
  }
};

// Mock function to simulate loading root data from a remote source
const loadRootData = async (): Promise<TreeNode[]> => {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 500));

  return flatTreeData
    .filter((item) => item.parent_id === null)
    .map((item) => ({
      id: item.id,
      label: item.label,
      hasChildren: flatTreeData.some((child) => child.parent_id === item.id),
      level: 0,
    }));
};

// Mock function to simulate loading children from a remote source
const loadChildren = async (nodeId: string): Promise<TreeNode[]> => {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 300));

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

  let treeViewRef:
    | {
        expandAll: () => void;
        collapseAll: () => void;
        collapseAllExceptFocused: () => void;
        collapseAllExceptSelected: () => void;
        collapseSome: () => void;
        foldCycle: () => void;
        focusAndReveal: (nodeId: string) => Promise<void>;
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
                </div>
              </div>
              <TreeView
                rootData={loadRootData}
                onSelect={handleSelect}
                onFocus={handleFocus}
                onExpand={handleExpand}
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
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
