import { Accessor } from "solid-js";
import { TreeNode } from "./types";

export const scrollIntoViewIfNeeded = (
  element: HTMLElement,
  container: HTMLElement,
): void => {
  const elementRect = element.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();

  const isAbove = elementRect.top < containerRect.top;
  const isBelow = elementRect.bottom > containerRect.bottom;

  if (!isAbove && !isBelow) return;

  if (
    "scrollIntoView" in element &&
    typeof element.scrollIntoView === "function"
  ) {
    try {
      element.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
    } catch {
      element.scrollIntoView(isAbove);
    }
  } else {
    const elementTop = element.offsetTop;
    const elementHeight = element.offsetHeight;
    const containerScrollTop = container.scrollTop;
    const containerHeight = container.clientHeight;
    const padding = 8;

    if (isAbove) {
      container.scrollTop = Math.max(0, elementTop - padding);
    } else if (isBelow) {
      container.scrollTop =
        elementTop - containerHeight + elementHeight + padding;
    }
  }
};

export const flattenTree = (
  nodes: TreeNode[],
  level = 0,
  expandedNodes: Accessor<Set<string>>,
  loadedChildren: Accessor<Map<string, TreeNode[]>>,
): TreeNode[] => {
  const flattened: TreeNode[] = [];
  const expanded = expandedNodes();
  const loaded = loadedChildren();

  for (const node of nodes) {
    const nodeWithLevel = node.level === level ? node : { ...node, level };
    flattened.push(nodeWithLevel);

    if (expanded.has(node.id)) {
      const childrenToFlatten = loaded.get(node.id) || [];
      if (childrenToFlatten.length > 0) {
        flattened.push(
          ...flattenTree(childrenToFlatten, level + 1, expandedNodes, loadedChildren),
        );
      }
    }
  }
  return flattened;
};

export const findNodeInChildren = (
  targetId: string,
  loadedChildren: Map<string, TreeNode[]>,
): TreeNode | null => {
  for (const [, children] of loadedChildren.entries()) {
    for (const child of children) {
      if (child.id === targetId) {
        return child;
      }
    }
  }
  return null;
};

export const getParentId = (
  nodeId: string,
  loadedChildren: Map<string, TreeNode[]>,
): string | null => {
  for (const [parentId, children] of loadedChildren.entries()) {
    if (children.some((child) => child.id === nodeId)) {
      return parentId;
    }
  }
  return null;
};

export const getPathToNode = (
  nodeId: string,
  loadedChildren: Map<string, TreeNode[]>,
  virtualRootId: string,
): string[] | null => {
  const findPath = (
    targetId: string,
    currentPath: string[] = [],
  ): string[] | null => {
    for (const [parentId, children] of loadedChildren.entries()) {
      for (const child of children) {
        const pathToChild = [...currentPath, parentId, child.id];

        if (child.id === targetId) {
          return pathToChild.filter((id) => id !== virtualRootId);
        }

        const childrenOfChild = loadedChildren.get(child.id);
        if (childrenOfChild) {
          const foundPath = findPath(targetId, pathToChild.slice(0, -1));
          if (foundPath) return foundPath;
        }
      }
    }
    return null;
  };

  return findPath(nodeId);
};