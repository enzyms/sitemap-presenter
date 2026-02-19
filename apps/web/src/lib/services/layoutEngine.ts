import { Position, type Node, type Edge } from '@xyflow/svelte';
import type { PageNode } from '$lib/types';

export type LayoutMode = 'hierarchical' | 'radial';

const NODE_WIDTH = 400;
const NODE_HEIGHT = 320;

// ============================================================
// FLOATING EDGES UTILITIES
// ============================================================

// Get intersection point where line from node center to target intersects node boundary
function getNodeIntersection(intersectionNode: Node, targetNode: Node): { x: number; y: number } {
	const nodeWidth = intersectionNode.measured?.width ?? NODE_WIDTH;
	const nodeHeight = intersectionNode.measured?.height ?? NODE_HEIGHT;
	const intersectionNodePosition = intersectionNode.position;
	const targetPosition = targetNode.position;

	const w = nodeWidth / 2;
	const h = nodeHeight / 2;

	const x2 = intersectionNodePosition.x + w;
	const y2 = intersectionNodePosition.y + h;
	const x1 = targetPosition.x + (targetNode.measured?.width ?? NODE_WIDTH) / 2;
	const y1 = targetPosition.y + (targetNode.measured?.height ?? NODE_HEIGHT) / 2;

	const xx1 = (x1 - x2) / (2 * w) - (y1 - y2) / (2 * h);
	const yy1 = (x1 - x2) / (2 * w) + (y1 - y2) / (2 * h);
	const a = 1 / (Math.abs(xx1) + Math.abs(yy1));
	const xx3 = a * xx1;
	const yy3 = a * yy1;
	const x = w * (xx3 + yy3) + x2;
	const y = h * (-xx3 + yy3) + y2;

	return { x, y };
}

// Determine which position (Top/Right/Bottom/Left) the intersection is closest to
function getEdgePosition(node: Node, intersectionPoint: { x: number; y: number }): Position {
	const nx = Math.round(node.position.x);
	const ny = Math.round(node.position.y);
	const nw = node.measured?.width ?? NODE_WIDTH;
	const nh = node.measured?.height ?? NODE_HEIGHT;
	const px = Math.round(intersectionPoint.x);
	const py = Math.round(intersectionPoint.y);

	if (px <= nx + 1) return Position.Left;
	if (px >= nx + nw - 1) return Position.Right;
	if (py <= ny + 1) return Position.Top;
	if (py >= ny + nh - 1) return Position.Bottom;

	return Position.Top;
}

// Get all params needed for dynamic floating edge rendering (slides along boundary)
export function getEdgeParams(source: Node, target: Node) {
	const sourceIntersectionPoint = getNodeIntersection(source, target);
	const targetIntersectionPoint = getNodeIntersection(target, source);

	const sourcePos = getEdgePosition(source, sourceIntersectionPoint);
	const targetPos = getEdgePosition(target, targetIntersectionPoint);

	return {
		sx: sourceIntersectionPoint.x,
		sy: sourceIntersectionPoint.y,
		tx: targetIntersectionPoint.x,
		ty: targetIntersectionPoint.y,
		sourcePos,
		targetPos
	};
}

// Get center point of a node
function getNodeCenter(node: Node) {
	return {
		x: node.position.x + (node.measured?.width ?? NODE_WIDTH) / 2,
		y: node.position.y + (node.measured?.height ?? NODE_HEIGHT) / 2
	};
}

// Get the cardinal point (center of side) for a given position
function getCardinalPoint(node: Node, position: Position): [number, number] {
	const w = node.measured?.width ?? NODE_WIDTH;
	const h = node.measured?.height ?? NODE_HEIGHT;
	const x = node.position.x;
	const y = node.position.y;

	switch (position) {
		case Position.Top:
			return [x + w / 2, y];
		case Position.Bottom:
			return [x + w / 2, y + h];
		case Position.Left:
			return [x, y + h / 2];
		case Position.Right:
			return [x + w, y + h / 2];
	}
}

// Get params for simple floating edges (snaps to cardinal points, no sliding)
// Child (target) always connects from Top or Bottom only.
// Parent (source) uses nearest cardinal side facing the child.
export function getSimpleEdgeParams(source: Node, target: Node) {
	const sourceCenter = getNodeCenter(source);
	const targetCenter = getNodeCenter(target);

	const dx = targetCenter.x - sourceCenter.x;
	const dy = targetCenter.y - sourceCenter.y;

	// Child: north if below parent, south if above
	const targetPos = dy >= 0 ? Position.Top : Position.Bottom;

	// Parent: nearest cardinal side facing the child
	let sourcePos: Position;
	if (Math.abs(dy) >= Math.abs(dx)) {
		sourcePos = dy >= 0 ? Position.Bottom : Position.Top;
	} else {
		sourcePos = dx >= 0 ? Position.Right : Position.Left;
	}

	const [sx, sy] = getCardinalPoint(source, sourcePos);
	const [tx, ty] = getCardinalPoint(target, targetPos);

	return { sx, sy, tx, ty, sourcePos, targetPos };
}

// ============================================================
// URL PATH HIERARCHY
// ============================================================

// Get the logical parent URL based on URL path structure
function getLogicalParentUrl(url: string, allUrls: string[]): string | null {
	try {
		const parsed = new URL(url);
		const pathParts = parsed.pathname.split('/').filter(Boolean);

		// Root page has no parent
		if (pathParts.length === 0) {
			return null;
		}

		// Try to find the closest parent by removing path segments
		for (let i = pathParts.length - 1; i >= 0; i--) {
			const parentPath = '/' + pathParts.slice(0, i).join('/');
			const parentUrl = `${parsed.protocol}//${parsed.host}${parentPath}`;
			const parentUrlWithSlash = parentUrl.endsWith('/') ? parentUrl : parentUrl + '/';
			const parentUrlWithoutSlash = parentUrl.endsWith('/') ? parentUrl.slice(0, -1) : parentUrl;

			// Check if this parent URL exists in our crawled pages
			if (allUrls.includes(parentUrlWithSlash) || allUrls.includes(parentUrlWithoutSlash)) {
				return allUrls.find(u => u === parentUrlWithSlash || u === parentUrlWithoutSlash) || null;
			}
		}

		// If no parent found in crawled pages, return the root URL
		const rootUrl = `${parsed.protocol}//${parsed.host}/`;
		if (allUrls.includes(rootUrl) && url !== rootUrl) {
			return rootUrl;
		}

		return null;
	} catch {
		return null;
	}
}

// Calculate depth based on URL path
function getUrlDepth(url: string, baseUrl: string): number {
	try {
		const parsed = new URL(url);
		const base = new URL(baseUrl);

		// If different hosts, return 0
		if (parsed.host !== base.host) return 0;

		const pathParts = parsed.pathname.split('/').filter(Boolean);
		return pathParts.length;
	} catch {
		return 0;
	}
}

// Reorganize nodes and edges based on URL path hierarchy
export function reorganizeByUrlHierarchy(
	nodes: PageNode[],
	edges: Edge[]
): { nodes: PageNode[]; edges: Edge[] } {
	if (nodes.length === 0) return { nodes, edges };

	// Find the base URL (root page at depth 0)
	const rootNode = nodes.find(n => n.data.depth === 0) || nodes[0];
	const baseUrl = rootNode.data.url;

	// Get all URLs
	const allUrls = nodes.map(n => n.data.url);

	// Create URL to node ID mapping
	const urlToNodeId = new Map<string, string>();
	nodes.forEach(n => urlToNodeId.set(n.data.url, n.id));

	// Recalculate depth and parent for each node based on URL structure
	const updatedNodes = nodes.map(node => {
		const urlDepth = getUrlDepth(node.data.url, baseUrl);
		const logicalParent = getLogicalParentUrl(node.data.url, allUrls);

		return {
			...node,
			data: {
				...node.data,
				depth: urlDepth,
				parentUrl: logicalParent
			}
		};
	});

	// Rebuild edges based on URL hierarchy
	const newEdges: Edge[] = [];
	const edgeSet = new Set<string>();

	updatedNodes.forEach(node => {
		if (node.data.parentUrl) {
			const parentId = urlToNodeId.get(node.data.parentUrl);
			if (parentId && parentId !== node.id) {
				const edgeId = `edge-${parentId}-${node.id}`;
				if (!edgeSet.has(edgeId)) {
					edgeSet.add(edgeId);
					newEdges.push({
						id: edgeId,
						source: parentId,
						target: node.id,
						type: 'smoothstep',
						animated: false,
						data: {
							sourceUrl: node.data.parentUrl,
							targetUrl: node.data.url
						}
					});
				}
			}
		}
	});

	return { nodes: updatedNodes, edges: newEdges };
}

// ============================================================
// LAYOUT ALGORITHMS
// ============================================================

// Tree-view layout: L1 nodes as column heads, subtrees stacked vertically below
const COLUMN_GAP = 80;
const VERTICAL_GAP = 40;
const ROOT_TO_L1_GAP = 100;
const INDENT_STEP = NODE_WIDTH + 40;

function layoutHierarchical(nodes: PageNode[], edges: Edge[]): PageNode[] {
	const visibleNodes = nodes.filter((n) => !n.hidden);
	if (visibleNodes.length === 0) return nodes;

	const visibleIds = new Set(visibleNodes.map((n) => n.id));

	// Build parent → children map from visible edges
	const childrenMap = new Map<string, string[]>();
	const hasParent = new Set<string>();
	for (const edge of edges) {
		if (!visibleIds.has(edge.source) || !visibleIds.has(edge.target)) continue;
		const children = childrenMap.get(edge.source) || [];
		children.push(edge.target);
		childrenMap.set(edge.source, children);
		hasParent.add(edge.target);
	}

	// Find root (depth 0)
	const rootNode = visibleNodes.find((n) => n.data.depth === 0);
	if (!rootNode) return nodes;

	const l1Children = (childrenMap.get(rootNode.id) || []).filter((id) => visibleIds.has(id));

	const positions = new Map<string, { x: number; y: number }>();

	// Measure a subtree: returns { height, maxWidth } for the column
	function measureSubtree(nodeId: string, relativeDepth: number): { height: number; maxWidth: number } {
		const indent = relativeDepth >= 3 ? (relativeDepth - 2) * INDENT_STEP : 0;
		const nodeWidth = indent + NODE_WIDTH;
		const children = (childrenMap.get(nodeId) || []).filter((id) => visibleIds.has(id));

		if (children.length === 0) {
			return { height: NODE_HEIGHT, maxWidth: nodeWidth };
		}

		let totalHeight = NODE_HEIGHT;
		let maxWidth = nodeWidth;
		for (const childId of children) {
			const childMeasure = measureSubtree(childId, relativeDepth + 1);
			totalHeight += VERTICAL_GAP + childMeasure.height;
			maxWidth = Math.max(maxWidth, childMeasure.maxWidth);
		}
		return { height: totalHeight, maxWidth };
	}

	// Place a subtree vertically starting at cursorY
	function placeSubtree(nodeId: string, columnLeft: number, cursorY: number, relativeDepth: number): number {
		const indent = relativeDepth >= 3 ? (relativeDepth - 2) * INDENT_STEP : 0;
		positions.set(nodeId, { x: columnLeft + indent, y: cursorY });

		let y = cursorY + NODE_HEIGHT + VERTICAL_GAP;
		const children = (childrenMap.get(nodeId) || []).filter((id) => visibleIds.has(id));
		for (const childId of children) {
			y = placeSubtree(childId, columnLeft, y, relativeDepth + 1);
		}
		return y;
	}

	// Measure all L1 columns
	const columnMeasures = l1Children.map((id) => ({
		id,
		...measureSubtree(id, 1)
	}));

	// Calculate total width and place L1 columns horizontally
	const totalWidth = columnMeasures.reduce((sum, col) => sum + col.maxWidth, 0)
		+ Math.max(0, columnMeasures.length - 1) * COLUMN_GAP;

	const startX = -totalWidth / 2;
	const l1Y = NODE_HEIGHT + ROOT_TO_L1_GAP;

	let cursorX = startX;
	for (const col of columnMeasures) {
		placeSubtree(col.id, cursorX, l1Y, 1);
		cursorX += col.maxWidth + COLUMN_GAP;
	}

	// Center root above all columns
	positions.set(rootNode.id, { x: -NODE_WIDTH / 2, y: 0 });

	// Place orphan nodes (visible, no parent edge, not root) in a row below all columns
	const placed = new Set(positions.keys());
	const orphans = visibleNodes.filter((n) => !placed.has(n.id));
	if (orphans.length > 0) {
		const maxY = Math.max(...Array.from(positions.values()).map((p) => p.y));
		const orphanY = maxY + NODE_HEIGHT + VERTICAL_GAP * 2;
		const orphanTotalWidth = orphans.length * NODE_WIDTH + (orphans.length - 1) * COLUMN_GAP;
		let ox = -orphanTotalWidth / 2;
		for (const node of orphans) {
			positions.set(node.id, { x: ox, y: orphanY });
			ox += NODE_WIDTH + COLUMN_GAP;
		}
	}

	return nodes.map((node) => {
		if (node.hidden) return node;
		const pos = positions.get(node.id);
		if (!pos) return node;
		return {
			...node,
			position: { x: pos.x, y: pos.y }
		};
	});
}

// Count all visible descendants of a node (used for angular space allocation)
function countDescendants(
	nodeId: string,
	childrenMap: Map<string, string[]>,
	visibleIds: Set<string>
): number {
	const children = (childrenMap.get(nodeId) || []).filter((id) => visibleIds.has(id));
	if (children.length === 0) return 1; // leaf counts as 1
	let total = 0;
	for (const child of children) {
		total += countDescendants(child, childrenMap, visibleIds);
	}
	return total;
}

// Radial layout: concentric circles by depth, children clustered near parent
// Ring radius grows dynamically so nodes never overlap.
function layoutRadial(nodes: PageNode[], edges: Edge[]): PageNode[] {
	const visibleNodes = nodes.filter((n) => !n.hidden);
	if (visibleNodes.length === 0) return nodes;

	const visibleIds = new Set(visibleNodes.map((n) => n.id));
	const centerX = 0;
	const centerY = 0;

	// Build parent → children map (only visible edges)
	const childrenMap = new Map<string, string[]>();
	for (const edge of edges) {
		if (!visibleIds.has(edge.source) || !visibleIds.has(edge.target)) continue;
		const children = childrenMap.get(edge.source) || [];
		children.push(edge.target);
		childrenMap.set(edge.source, children);
	}

	// Find root(s) — nodes at depth 0
	const rootNodes = visibleNodes.filter((n) => n.data.depth === 0);
	if (rootNodes.length === 0) return nodes;

	// Count nodes at each depth
	const byDepth = new Map<number, PageNode[]>();
	for (const node of visibleNodes) {
		const d = node.data.depth;
		if (!byDepth.has(d)) byDepth.set(d, []);
		byDepth.get(d)!.push(node);
	}
	const maxDepth = Math.max(...byDepth.keys());

	// Calculate radius for each ring:
	// - Must fit all nodes at that depth without overlap
	// - Must be larger than the previous ring by at least MIN_RING_GAP
	const MIN_RING_GAP = NODE_HEIGHT + 150;
	const NODE_ARC_SPACE = Math.sqrt(NODE_WIDTH * NODE_WIDTH + NODE_HEIGHT * NODE_HEIGHT) + 60;
	const ringRadius = new Map<number, number>();
	ringRadius.set(0, 0); // root at center

	for (let d = 1; d <= maxDepth; d++) {
		const count = (byDepth.get(d) || []).length;
		// Minimum radius so nodes don't overlap: circumference >= count * spacing
		const radiusForFit = (count * NODE_ARC_SPACE) / (2 * Math.PI);
		// Must be at least MIN_RING_GAP larger than previous ring
		const radiusForGap = (ringRadius.get(d - 1) || 0) + MIN_RING_GAP;
		ringRadius.set(d, Math.max(radiusForFit, radiusForGap));
	}

	const positions = new Map<string, { x: number; y: number }>();

	// Place root at center
	positions.set(rootNodes[0].id, { x: centerX, y: centerY });

	// Recursive placement: each node gets an angular range, children share it
	function placeChildren(
		parentId: string,
		startAngle: number,
		endAngle: number,
		depth: number
	) {
		const children = (childrenMap.get(parentId) || []).filter((id) => visibleIds.has(id));
		if (children.length === 0) return;

		const radius = ringRadius.get(depth) || depth * MIN_RING_GAP;

		// Weight each child by its descendant count for proportional spacing
		const weights = children.map((id) => countDescendants(id, childrenMap, visibleIds));
		const totalWeight = weights.reduce((a, b) => a + b, 0);

		let currentAngle = startAngle;

		for (let i = 0; i < children.length; i++) {
			const childId = children[i];
			const share = ((endAngle - startAngle) * weights[i]) / totalWeight;
			const childAngle = currentAngle + share / 2;

			positions.set(childId, {
				x: centerX + radius * Math.cos(childAngle),
				y: centerY + radius * Math.sin(childAngle)
			});

			// Recurse: this child's subtree gets the slice [currentAngle, currentAngle + share]
			placeChildren(childId, currentAngle, currentAngle + share, depth + 1);

			currentAngle += share;
		}
	}

	// Start: root's children get the full circle
	placeChildren(rootNodes[0].id, -Math.PI, Math.PI, 1);

	// Handle orphan nodes (no parent edge, not root) — distribute on outermost ring
	const placed = new Set(positions.keys());
	const orphans = visibleNodes.filter((n) => !placed.has(n.id));
	if (orphans.length > 0) {
		const outerRadius = (ringRadius.get(maxDepth) || MIN_RING_GAP) + MIN_RING_GAP;
		orphans.forEach((node, i) => {
			const angle = (2 * Math.PI * i) / orphans.length - Math.PI / 2;
			positions.set(node.id, {
				x: centerX + outerRadius * Math.cos(angle),
				y: centerY + outerRadius * Math.sin(angle)
			});
		});
	}

	return nodes.map((node) => {
		if (node.hidden) return node;
		const pos = positions.get(node.id);
		if (!pos) return node;
		return {
			...node,
			position: {
				x: pos.x - NODE_WIDTH / 2,
				y: pos.y - NODE_HEIGHT / 2
			}
		};
	});
}

export function applyLayout(
	nodes: PageNode[],
	edges: Edge[],
	mode: LayoutMode = 'hierarchical'
): PageNode[] {
	switch (mode) {
		case 'radial':
			return layoutRadial(nodes, edges);
		case 'hierarchical':
		default:
			return layoutHierarchical(nodes, edges);
	}
}

export { NODE_WIDTH, NODE_HEIGHT };
