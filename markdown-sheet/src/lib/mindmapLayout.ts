import { hierarchy, tree as d3Tree } from "d3-hierarchy";
import type { Node, Edge } from "@xyflow/react";
import type { KityMinderNode, MindmapInternalNode } from "./mindmapTypes";
import type { ThemeColors } from "./mindmapThemes";

export type LayoutDirection = "right" | "mind" | "bottom" | "filetree";

export interface MindmapNodeData {
  label: string;
  depth: number;
  direction: "right" | "left" | "bottom";
  themeColors: ThemeColors;
  priority?: number;
  progress?: number;
  hyperlink?: string;
  hyperlinkTitle?: string;
  note?: string;
  image?: string;
  imageSize?: { width: number; height: number };
  expandState?: "expand" | "collapse";
  internalId: string;
  isRoot: boolean;
  hasChildren: boolean;
}

const V_SPACING = 50;
const H_SPACING = 220;
const FILETREE_INDENT = 30;
const FILETREE_ROW = 34;

function estimateNodeWidth(text: string, depth: number): number {
  const fontSize = depth === 0 ? 16 : depth === 1 ? 14 : 13;
  const padding = depth === 0 ? 48 : depth === 1 ? 32 : 24;
  const charWidth = fontSize * 0.55;
  // Wider chars for CJK
  const cjkCount = (text.match(/[\u3000-\u9fff\uf900-\ufaff]/g) || []).length;
  const asciiCount = text.length - cjkCount;
  return Math.max(80, asciiCount * charWidth + cjkCount * fontSize + padding);
}

function estimateNodeHeight(depth: number): number {
  return depth === 0 ? 44 : depth === 1 ? 36 : 30;
}

function visibleChildren(node: MindmapInternalNode): MindmapInternalNode[] {
  if (node.data.expandState === "collapse") return [];
  return node.children;
}

function makeNodeData(
  node: MindmapInternalNode,
  depth: number,
  direction: "right" | "left" | "bottom",
  themeColors: ThemeColors,
): MindmapNodeData {
  return {
    label: node.data.text,
    depth,
    direction,
    themeColors,
    priority: node.data.priority,
    progress: node.data.progress,
    hyperlink: node.data.hyperlink,
    hyperlinkTitle: node.data.hyperlinkTitle,
    note: node.data.note,
    image: node.data.image,
    imageSize: node.data.imageSize,
    expandState: node.data.expandState,
    internalId: node.id,
    isRoot: depth === 0,
    hasChildren: node.children.length > 0,
  };
}

function layoutTree(
  root: MindmapInternalNode,
  direction: "right" | "left" | "bottom",
  themeColors: ThemeColors,
  xOffset = 0,
  yOffset = 0,
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const h = hierarchy(root, visibleChildren);

  const isHorizontal = direction !== "bottom";
  const layout = d3Tree<MindmapInternalNode>()
    .nodeSize(isHorizontal ? [V_SPACING, H_SPACING] : [H_SPACING, V_SPACING])
    .separation((a, b) => (a.parent === b.parent ? 1 : 1.3));

  const layoutRoot = layout(h);

  layoutRoot.each((d) => {
    const node = d.data;
    const depth = d.depth;
    const w = estimateNodeWidth(node.data.text, depth);
    const nh = estimateNodeHeight(depth);

    let x: number, y: number;
    if (direction === "right") {
      x = d.y + xOffset - w / 2;
      y = d.x + yOffset - nh / 2;
    } else if (direction === "left") {
      x = -d.y + xOffset - w / 2;
      y = d.x + yOffset - nh / 2;
    } else {
      x = d.x + xOffset - w / 2;
      y = d.y + yOffset - nh / 2;
    }

    nodes.push({
      id: node.id,
      type: "mindmap",
      position: { x, y },
      data: makeNodeData(node, depth, direction, themeColors) as unknown as Record<string, unknown>,
    });

    if (d.parent) {
      const sourceHandle =
        direction === "bottom" ? "source-bottom" : direction === "left" ? "source-left" : "source-right";
      const targetHandle =
        direction === "bottom" ? "target-top" : direction === "left" ? "target-right" : "target-left";

      edges.push({
        id: `e-${d.parent.data.id}-${node.id}`,
        source: d.parent.data.id,
        target: node.id,
        sourceHandle,
        targetHandle,
        type: "mindmap",
        data: { color: themeColors.connection, depth } as unknown as Record<string, unknown>,
      });
    }
  });

  return { nodes, edges };
}

function layoutMind(
  root: MindmapInternalNode,
  themeColors: ThemeColors,
): { nodes: Node[]; edges: Edge[] } {
  const allNodes: Node[] = [];
  const allEdges: Edge[] = [];

  const children = visibleChildren(root);
  const rightChildren = children.filter((_, i) => i % 2 === 0);
  const leftChildren = children.filter((_, i) => i % 2 === 1);

  // Root node
  const rw = estimateNodeWidth(root.data.text, 0);
  const rh = estimateNodeHeight(0);
  allNodes.push({
    id: root.id,
    type: "mindmap",
    position: { x: -rw / 2, y: -rh / 2 },
    data: makeNodeData(root, 0, "right", themeColors) as unknown as Record<string, unknown>,
  });

  // Layout right subtrees
  if (rightChildren.length > 0) {
    const rightRoot: MindmapInternalNode = { id: root.id + "-r", data: root.data, children: rightChildren };
    const right = layoutTree(rightRoot, "right", themeColors, H_SPACING / 2, 0);
    // Skip the duplicate root node, keep edges from root to right children
    for (const n of right.nodes) {
      if (n.id !== rightRoot.id) allNodes.push(n);
    }
    for (const e of right.edges) {
      // Remap edges from virtual root to actual root
      if (e.source === rightRoot.id) {
        allEdges.push({ ...e, source: root.id, sourceHandle: "source-right" });
      } else {
        allEdges.push(e);
      }
    }
  }

  // Layout left subtrees
  if (leftChildren.length > 0) {
    const leftRoot: MindmapInternalNode = { id: root.id + "-l", data: root.data, children: leftChildren };
    const left = layoutTree(leftRoot, "left", themeColors, -H_SPACING / 2, 0);
    for (const n of left.nodes) {
      if (n.id !== leftRoot.id) allNodes.push(n);
    }
    for (const e of left.edges) {
      if (e.source === leftRoot.id) {
        allEdges.push({ ...e, source: root.id, sourceHandle: "source-left" });
      } else {
        allEdges.push(e);
      }
    }
  }

  return { nodes: allNodes, edges: allEdges };
}

function layoutFiletree(
  root: MindmapInternalNode,
  themeColors: ThemeColors,
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  let row = 0;

  function visit(node: MindmapInternalNode, depth: number) {
    const x = depth * FILETREE_INDENT;
    const y = row * FILETREE_ROW;
    row++;

    nodes.push({
      id: node.id,
      type: "mindmap",
      position: { x, y },
      data: makeNodeData(node, depth, "right", themeColors) as unknown as Record<string, unknown>,
    });

    for (const child of visibleChildren(node)) {
      edges.push({
        id: `e-${node.id}-${child.id}`,
        source: node.id,
        target: child.id,
        sourceHandle: "source-bottom",
        targetHandle: "target-left",
        type: "mindmap",
        data: { color: themeColors.connection, depth: depth + 1 } as unknown as Record<string, unknown>,
      });
      visit(child, depth + 1);
    }
  }

  visit(root, 0);
  return { nodes, edges };
}

export function computeLayout(
  root: MindmapInternalNode,
  direction: LayoutDirection,
  themeColors: ThemeColors,
): { nodes: Node[]; edges: Edge[] } {
  if (direction === "mind") return layoutMind(root, themeColors);
  if (direction === "filetree") return layoutFiletree(root, themeColors);
  return layoutTree(root, direction === "bottom" ? "bottom" : "right", themeColors);
}

// --- Tree manipulation utilities ---

export function assignIds(node: KityMinderNode): MindmapInternalNode {
  return {
    id: crypto.randomUUID(),
    data: { ...node.data },
    children: (node.children || []).map((c) => assignIds(c)),
  };
}

export function cloneTree(node: MindmapInternalNode): MindmapInternalNode {
  return {
    id: node.id,
    data: { ...node.data, imageSize: node.data.imageSize ? { ...node.data.imageSize } : undefined },
    children: node.children.map(cloneTree),
  };
}

export function findNode(tree: MindmapInternalNode, id: string): MindmapInternalNode | null {
  if (tree.id === id) return tree;
  for (const child of tree.children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

export function findParent(
  tree: MindmapInternalNode,
  id: string,
): { parent: MindmapInternalNode; index: number } | null {
  for (let i = 0; i < tree.children.length; i++) {
    if (tree.children[i].id === id) return { parent: tree, index: i };
    const found = findParent(tree.children[i], id);
    if (found) return found;
  }
  return null;
}

export function stripIds(node: MindmapInternalNode): KityMinderNode {
  return {
    data: { ...node.data },
    children: node.children.map(stripIds),
  };
}
