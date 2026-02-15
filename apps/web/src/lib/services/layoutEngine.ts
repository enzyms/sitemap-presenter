import dagre from 'dagre';
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

// Get all params needed for floating edge rendering
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

// Hierarchical layout using Dagre (rows by depth)
function layoutHierarchical(nodes: PageNode[], edges: Edge[]): PageNode[] {
	const visibleNodes = nodes.filter((n) => !n.hidden);
	if (visibleNodes.length === 0) return nodes;

	const dagreGraph = new dagre.graphlib.Graph();
	dagreGraph.setDefaultEdgeLabel(() => ({}));
	dagreGraph.setGraph({
		rankdir: 'TB', // Top to Bottom (rows by depth)
		ranksep: 150, // Vertical spacing between levels
		nodesep: 80, // Horizontal spacing between nodes
		align: 'UL'
	});

	visibleNodes.forEach((node) => {
		dagreGraph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
	});

	edges.forEach((edge) => {
		const sourceVisible = visibleNodes.some((n) => n.id === edge.source);
		const targetVisible = visibleNodes.some((n) => n.id === edge.target);
		if (sourceVisible && targetVisible) {
			dagreGraph.setEdge(edge.source, edge.target);
		}
	});

	dagre.layout(dagreGraph);

	return nodes.map((node) => {
		if (node.hidden) return node;
		const pos = dagreGraph.node(node.id);
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

// Radial layout with children positioned close to their parents
function layoutRadial(nodes: PageNode[], edges: Edge[]): PageNode[] {
	const visibleNodes = nodes.filter((n) => !n.hidden);
	if (visibleNodes.length === 0) return nodes;

	const centerX = 0;
	const centerY = 0;

	// Build parent-children relationships
	const childrenByParent = new Map<string, string[]>();
	edges.forEach((edge) => {
		const children = childrenByParent.get(edge.source) || [];
		children.push(edge.target);
		childrenByParent.set(edge.source, children);
	});

	// Group visible nodes by depth
	const byDepth = new Map<number, PageNode[]>();
	visibleNodes.forEach((node) => {
		const depth = node.data.depth;
		if (!byDepth.has(depth)) byDepth.set(depth, []);
		byDepth.get(depth)!.push(node);
	});

	// Calculate dynamic radius based on nodes at each level
	const maxDepth = Math.max(...byDepth.keys());
	const positions = new Map<string, { x: number; y: number }>();

	// Position root node at center
	const rootNodes = byDepth.get(0) || [];
	if (rootNodes.length > 0) {
		positions.set(rootNodes[0].id, { x: centerX, y: centerY });
	}

	// For each depth level, position nodes
	for (let depth = 1; depth <= maxDepth; depth++) {
		const nodesAtDepth = byDepth.get(depth) || [];
		if (nodesAtDepth.length === 0) continue;

		// Calculate radius based on number of nodes (minimum circumference to avoid overlap)
		const minSpacing = NODE_WIDTH + 100; // Minimum space between node centers
		const circumference = Math.max(nodesAtDepth.length * minSpacing, 800);
		const radius = circumference / (2 * Math.PI);

		// Group nodes by their parent for positioning
		const nodesByParent = new Map<string, PageNode[]>();
		nodesAtDepth.forEach((node) => {
			// Find the parent at depth-1
			const parentEdge = edges.find((e) => e.target === node.id);
			const parentId = parentEdge?.source || 'root';
			if (!nodesByParent.has(parentId)) nodesByParent.set(parentId, []);
			nodesByParent.get(parentId)!.push(node);
		});

		// Get parent positions and angles
		const parentPositions: Array<{ id: string; angle: number; children: PageNode[] }> = [];
		const parentNodesAtPrevDepth = byDepth.get(depth - 1) || [];

		nodesByParent.forEach((children, parentId) => {
			const parentPos = positions.get(parentId);
			if (parentPos) {
				// Calculate angle of parent from center
				const angle = Math.atan2(parentPos.y - centerY, parentPos.x - centerX);
				parentPositions.push({ id: parentId, angle, children });
			} else if (parentId === 'root') {
				// Orphan nodes - distribute evenly
				parentPositions.push({ id: parentId, angle: 0, children });
			}
		});

		// Sort by parent angle to keep children near parents
		parentPositions.sort((a, b) => a.angle - b.angle);

		// Calculate total children and distribute angles
		const totalChildren = nodesAtDepth.length;
		let currentIndex = 0;

		parentPositions.forEach(({ id: parentId, angle: parentAngle, children }) => {
			const parentPos = positions.get(parentId);

			if (parentPos && parentId !== 'root') {
				// Position children in an arc centered on parent's angle
				const arcSpan = (children.length / totalChildren) * 2 * Math.PI;
				const startAngle = parentAngle - arcSpan / 2;

				children.forEach((node, i) => {
					const nodeAngle =
						children.length === 1
							? parentAngle
							: startAngle + (arcSpan * i) / (children.length - 1 || 1);

					positions.set(node.id, {
						x: centerX + radius * Math.cos(nodeAngle),
						y: centerY + radius * Math.sin(nodeAngle)
					});
				});
			} else {
				// Orphan nodes - distribute in remaining space
				children.forEach((node, i) => {
					const nodeAngle = (2 * Math.PI * (currentIndex + i)) / totalChildren - Math.PI / 2;
					positions.set(node.id, {
						x: centerX + radius * Math.cos(nodeAngle),
						y: centerY + radius * Math.sin(nodeAngle)
					});
				});
			}
			currentIndex += children.length;
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
