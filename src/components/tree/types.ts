import { Accessor } from "solid-js";

export interface TreeNode {
  id: string;
  label: string;
  hasChildren?: boolean;
  isExpanded?: boolean;
  level: number;
}

export type TreeSelectHandler = (node: TreeNode) => void;
export type TreeFocusHandler = (node: TreeNode) => void;
export type TreeExpandHandler = (nodeId: string) => void;
export type TreeChildrenLoader = (nodeId: string) => Promise<TreeNode[]>;
export type TreeChildrenLoadedHandler = (nodeId: string, children: TreeNode[]) => void;
export type TreeCutPasteHandler = (sourceId: string, targetId: string) => boolean;
export type TreeRenameHandler = (nodeId: string, newLabel: string) => boolean;
export type TreeCreateHandler = (parentId: string) => boolean;
export type TreeContextMenuHandler = (node: TreeNode, event: MouseEvent) => void;

export interface TreeContextValue {
  expandedNodes: Accessor<Set<string>>;
  focusedNodeId: Accessor<string | undefined>;
  selectedNodeId: Accessor<string | undefined>;
  loadedChildren: Accessor<Map<string, TreeNode[]>>;
  cutNodeId: Accessor<string | undefined>;
  editingNodeId: Accessor<string | undefined>;
  onSelect: TreeSelectHandler;
  onFocus: TreeFocusHandler;
  onExpand: TreeExpandHandler;
  onChildrenLoaded: TreeChildrenLoadedHandler;
  onCut: (nodeId: string) => void;
  onPaste: (targetId: string) => void;
  onMoveToRoot: (nodeId?: string) => void;
  onRename: (nodeId: string) => void;
  onRenameCommit: (nodeId: string, newLabel: string) => void;
  onRenameCancel: () => void;
  onContextMenu?: TreeContextMenuHandler;
  loadChildren?: TreeChildrenLoader;
}

export interface TreeViewProps {
  loadChildren: TreeChildrenLoader;
  onSelect?: TreeSelectHandler;
  onFocus?: TreeFocusHandler;
  onExpand?: TreeExpandHandler;
  onCutPaste?: TreeCutPasteHandler;
  onRename?: TreeRenameHandler;
  onCreate?: TreeCreateHandler;
  onContextMenu?: TreeContextMenuHandler;
  class?: string;
  ref?: (ref: TreeViewRef) => void;
}

export interface TreeViewRef {
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
}

export interface TreeItemProps {
  node: TreeNode;
}

export type FoldCycleState = 0 | 1 | 2;