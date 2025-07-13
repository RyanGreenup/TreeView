import { createSignal } from "solid-js";
import { StatusDisplay } from "~/components/StatusDisplay";
import { TreeNode, TreeView } from "~/components/TreeView";

// Mock data for the tree - only root nodes
const mockTreeData: TreeNode[] = [
  {
    id: "1",
    label: "Documents",
    hasChildren: true,
    level: 0,
  },
  {
    id: "2",
    label: "Pictures",
    hasChildren: true,
    level: 0,
  },
  {
    id: "3",
    label: "Videos",
    hasChildren: true,
    level: 0,
  },
  {
    id: "4",
    label: "Music",
    hasChildren: false,
    level: 0,
  },
];

// Mutable hashmap to store children data
const childrenMap = new Map<string, TreeNode[]>([
  [
    "1",
    [
      { id: "1-1", label: "Work", hasChildren: true, level: 0 },
      { id: "1-2", label: "Personal", hasChildren: true, level: 0 },
    ],
  ],
  [
    "1-1",
    [
      { id: "1-1-1", label: "Project A", hasChildren: false, level: 0 },
      { id: "1-1-2", label: "Project B", hasChildren: true, level: 0 },
      { id: "1-1-3", label: "Meeting Notes", hasChildren: false, level: 0 },
    ],
  ],
  [
    "1-2",
    [
      { id: "1-2-1", label: "Tax Documents", hasChildren: false, level: 0 },
      { id: "1-2-2", label: "Insurance", hasChildren: false, level: 0 },
      { id: "1-2-3", label: "Receipts", hasChildren: true, level: 0 },
    ],
  ],
  [
    "1-1-2",
    [
      { id: "1-1-2-1", label: "Design Files", hasChildren: false, level: 0 },
      { id: "1-1-2-2", label: "Code Review", hasChildren: false, level: 0 },
    ],
  ],
  [
    "1-2-3",
    [
      { id: "1-2-3-1", label: "2023", hasChildren: false, level: 0 },
      { id: "1-2-3-2", label: "2024", hasChildren: false, level: 0 },
    ],
  ],
  [
    "2",
    [
      { id: "2-1", label: "Vacation", hasChildren: true, level: 0 },
      { id: "2-2", label: "Family", hasChildren: true, level: 0 },
      { id: "2-3", label: "Screenshots", hasChildren: false, level: 0 },
    ],
  ],
  [
    "2-1",
    [
      { id: "2-1-1", label: "Beach Trip 2023", hasChildren: false, level: 0 },
      {
        id: "2-1-2",
        label: "Mountain Hike 2024",
        hasChildren: false,
        level: 0,
      },
    ],
  ],
  [
    "2-2",
    [
      { id: "2-2-1", label: "Birthday Party", hasChildren: false, level: 0 },
      { id: "2-2-2", label: "Christmas 2023", hasChildren: false, level: 0 },
    ],
  ],
  [
    "3",
    [
      { id: "3-1", label: "Tutorials", hasChildren: false, level: 0 },
      { id: "3-2", label: "Movies", hasChildren: true, level: 0 },
      { id: "3-3", label: "Personal", hasChildren: false, level: 0 },
    ],
  ],
  [
    "3-2",
    [
      { id: "3-2-1", label: "Action", hasChildren: false, level: 0 },
      { id: "3-2-2", label: "Comedy", hasChildren: false, level: 0 },
      { id: "3-2-3", label: "Documentary", hasChildren: false, level: 0 },
    ],
  ],
]);


// Mock function to simulate loading children from a remote source
const loadChildren = async (nodeId: string): Promise<TreeNode[]> => {
  // Simulate network delay
  await new Promise((resolve) => setTimeout(resolve, 300));

  // Return mock children from hashmap
  return childrenMap.get(nodeId) || [];
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
                nodes={mockTreeData}
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
