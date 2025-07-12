import { createSignal } from "solid-js";
import { TreeView, TreeNode } from "~/components/TreeView";

// Mock data for the tree
const mockTreeData: TreeNode[] = [
  {
    id: "1",
    label: "Documents",
    hasChildren: true,
    children: [
      {
        id: "1-1",
        label: "Work",
        hasChildren: true,
      },
      {
        id: "1-2",
        label: "Personal",
        hasChildren: true,
      },
    ],
  },
  {
    id: "2",
    label: "Pictures",
    hasChildren: true,
  },
  {
    id: "3",
    label: "Videos",
    hasChildren: true,
  },
  {
    id: "4",
    label: "Music",
    hasChildren: false,
  },
];

// Mock function to simulate loading children from a remote source
const loadChildren = async (nodeId: string): Promise<TreeNode[]> => {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Return mock children based on nodeId
  switch (nodeId) {
    case "1-1":
      return [
        { id: "1-1-1", label: "Project A", hasChildren: false },
        { id: "1-1-2", label: "Project B", hasChildren: true },
        { id: "1-1-3", label: "Meeting Notes", hasChildren: false },
      ];
    case "1-2":
      return [
        { id: "1-2-1", label: "Tax Documents", hasChildren: false },
        { id: "1-2-2", label: "Insurance", hasChildren: false },
        { id: "1-2-3", label: "Receipts", hasChildren: true },
      ];
    case "1-1-2":
      return [
        { id: "1-1-2-1", label: "Design Files", hasChildren: false },
        { id: "1-1-2-2", label: "Code Review", hasChildren: false },
      ];
    case "1-2-3":
      return [
        { id: "1-2-3-1", label: "2023", hasChildren: false },
        { id: "1-2-3-2", label: "2024", hasChildren: false },
      ];
    case "2":
      return [
        { id: "2-1", label: "Vacation", hasChildren: true },
        { id: "2-2", label: "Family", hasChildren: true },
        { id: "2-3", label: "Screenshots", hasChildren: false },
      ];
    case "2-1":
      return [
        { id: "2-1-1", label: "Beach Trip 2023", hasChildren: false },
        { id: "2-1-2", label: "Mountain Hike 2024", hasChildren: false },
      ];
    case "2-2":
      return [
        { id: "2-2-1", label: "Birthday Party", hasChildren: false },
        { id: "2-2-2", label: "Christmas 2023", hasChildren: false },
      ];
    case "3":
      return [
        { id: "3-1", label: "Tutorials", hasChildren: false },
        { id: "3-2", label: "Movies", hasChildren: true },
        { id: "3-3", label: "Personal", hasChildren: false },
      ];
    case "3-2":
      return [
        { id: "3-2-1", label: "Action", hasChildren: false },
        { id: "3-2-2", label: "Comedy", hasChildren: false },
        { id: "3-2-3", label: "Documentary", hasChildren: false },
      ];
    default:
      return [];
  }
};

export default function TreeExample() {
  const [selectedItem, setSelectedItem] = createSignal<TreeNode | null>(null);
  const [focusedItem, setFocusedItem] = createSignal<TreeNode | null>(null);
  const [expandedItems, setExpandedItems] = createSignal<string[]>([]);

  const handleSelect = (node: TreeNode) => {
    setSelectedItem(node);
    console.log("Selected:", node);
  };

  const handleFocus = (node: TreeNode) => {
    setFocusedItem(node);
    console.log("Focused:", node);
  };

  const handleExpand = (nodeId: string) => {
    setExpandedItems(prev => 
      prev.includes(nodeId) 
        ? prev.filter(id => id !== nodeId)
        : [...prev, nodeId]
    );
    console.log("Expanded/Collapsed:", nodeId);
  };

  return (
    <div class="container mx-auto p-8 space-y-8">
      <div class="hero bg-base-200 rounded-box">
        <div class="hero-content text-center">
          <div class="max-w-md">
            <h1 class="text-4xl font-bold">TreeView Component</h1>
            <p class="py-6">Professional tree component with DaisyUI styling, keyboard navigation, and lazy loading.</p>
          </div>
        </div>
      </div>
      
      <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div class="xl:col-span-2">
          <div class="card bg-base-100 shadow-xl">
            <div class="card-body">
              <h2 class="card-title">File Explorer</h2>
              <p class="text-sm opacity-70 mb-4">Click to select, use keyboard arrows to navigate</p>
              <TreeView
                nodes={mockTreeData}
                onSelect={handleSelect}
                onFocus={handleFocus}
                onExpand={handleExpand}
                loadChildren={loadChildren}
                class="max-h-96 overflow-y-auto"
              />
            </div>
          </div>
        </div>
        
        <div class="space-y-6">
          <div class="card bg-base-100 shadow-xl">
            <div class="card-body">
              <h2 class="card-title">Current Status</h2>
              
              <div class="space-y-4">
                <div>
                  <h3 class="font-semibold text-sm opacity-70 mb-2">FOCUSED ITEM</h3>
                  <div class="mockup-code bg-base-200 text-xs">
                    {focusedItem() ? (
                      <pre><code>{JSON.stringify({
                        id: focusedItem()!.id,
                        label: focusedItem()!.label,
                        level: focusedItem()!.level || 0
                      }, null, 2)}</code></pre>
                    ) : (
                      <pre><code>null</code></pre>
                    )}
                  </div>
                </div>
                
                <div>
                  <h3 class="font-semibold text-sm opacity-70 mb-2">SELECTED ITEM</h3>
                  <div class="mockup-code bg-base-200 text-xs">
                    {selectedItem() ? (
                      <pre><code>{JSON.stringify({
                        id: selectedItem()!.id,
                        label: selectedItem()!.label,
                        hasChildren: selectedItem()!.hasChildren
                      }, null, 2)}</code></pre>
                    ) : (
                      <pre><code>null</code></pre>
                    )}
                  </div>
                </div>
                
                <div>
                  <h3 class="font-semibold text-sm opacity-70 mb-2">EXPANDED NODES</h3>
                  <div class="flex flex-wrap gap-1">
                    {expandedItems().length > 0 ? (
                      expandedItems().map(id => (
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