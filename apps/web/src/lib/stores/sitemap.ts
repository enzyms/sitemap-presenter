import { writable, derived, get } from 'svelte/store';
import type { PageNode, LinkEdge, CrawlProgress, PageDiscoveredEvent, PageScreenshotEvent } from '$lib/types';

const defaultProgress: CrawlProgress = {
	sessionId: '',
	status: 'idle',
	found: 0,
	crawled: 0,
	screenshotted: 0,
	errors: 0
};

function createSitemapStore() {
	const nodes = writable<PageNode[]>([]);
	const edges = writable<LinkEdge[]>([]);
	const progress = writable<CrawlProgress>(defaultProgress);
	const selectedNodeId = writable<string | null>(null);
	const searchQuery = writable<string>('');
	const zoomLevel = writable<number>(1);

	// URL to node ID mapping
	const urlToNodeId = new Map<string, string>();

	function generateNodeId(url: string): string {
		const existingId = urlToNodeId.get(url);
		if (existingId) return existingId;

		const id = `node-${urlToNodeId.size + 1}`;
		urlToNodeId.set(url, id);
		return id;
	}

	function addPage(event: PageDiscoveredEvent) {
		const nodeId = generateNodeId(event.url);

		nodes.update((currentNodes) => {
			// Check if node already exists
			const existingIndex = currentNodes.findIndex((n) => n.id === nodeId);

			const newNode: PageNode = {
				id: nodeId,
				type: 'page',
				position: { x: 0, y: 0 }, // Will be calculated by layout
				data: {
					url: event.url,
					title: event.title || event.url,
					depth: event.depth,
					parentUrl: event.parentUrl,
					screenshotStatus: 'pending',
					links: event.links,
					internalLinks: event.internalLinks,
					externalLinks: event.externalLinks
				}
			};

			if (existingIndex >= 0) {
				const updated = [...currentNodes];
				updated[existingIndex] = { ...updated[existingIndex], data: newNode.data };
				return updated;
			}

			return [...currentNodes, newNode];
		});

		// Only add edge from parent to child (not all internal links)
		if (event.parentUrl) {
			const parentId = urlToNodeId.get(event.parentUrl);
			if (parentId) {
				edges.update((currentEdges) => {
					const edgeId = `edge-${parentId}-${nodeId}`;

					// Check if edge already exists
					if (!currentEdges.some((e) => e.id === edgeId)) {
						return [...currentEdges, {
							id: edgeId,
							source: parentId,
							target: nodeId,
							type: 'smoothstep',
							animated: false,
							data: {
								sourceUrl: event.parentUrl!,
								targetUrl: event.url
							}
						}];
					}
					return currentEdges;
				});
			}
		}

		// Update progress
		progress.update((p) => ({
			...p,
			found: p.found + 1,
			crawled: p.crawled + 1
		}));
	}

	function updateScreenshot(event: PageScreenshotEvent) {
		const nodeId = urlToNodeId.get(event.url);
		if (!nodeId) return;

		nodes.update((currentNodes) => {
			return currentNodes.map((node) => {
				if (node.id === nodeId) {
					return {
						...node,
						data: {
							...node.data,
							thumbnailUrl: event.thumbnailUrl,
							fullScreenshotUrl: event.fullScreenshotUrl,
							screenshotStatus: 'ready' as const
						}
					};
				}
				return node;
			});
		});

		progress.update((p) => ({
			...p,
			screenshotted: p.screenshotted + 1
		}));
	}

	function layoutNodes() {
		const currentNodes = get(nodes);

		if (currentNodes.length === 0) return;

		// Node dimensions for the larger sizes
		const nodeWidth = 480;
		const nodeHeight = 400;
		const horizontalGap = 80;
		const verticalGap = 100;

		// Group nodes by depth
		const nodesByDepth = new Map<number, PageNode[]>();
		for (const node of currentNodes) {
			const depth = node.data.depth;
			if (!nodesByDepth.has(depth)) {
				nodesByDepth.set(depth, []);
			}
			nodesByDepth.get(depth)!.push(node);
		}

		// Build parent-children map
		const childrenByParent = new Map<string, PageNode[]>();
		for (const node of currentNodes) {
			if (node.data.parentUrl) {
				const parentId = urlToNodeId.get(node.data.parentUrl);
				if (parentId) {
					if (!childrenByParent.has(parentId)) {
						childrenByParent.set(parentId, []);
					}
					childrenByParent.get(parentId)!.push(node);
				}
			}
		}

		// Calculate positions
		const positions = new Map<string, { x: number; y: number }>();

		// Row 0: Homepage centered at top
		const depth0Nodes = nodesByDepth.get(0) || [];
		if (depth0Nodes.length > 0) {
			const homepage = depth0Nodes[0];
			positions.set(homepage.id, { x: 0, y: 0 });
		}

		// Row 1: Depth-1 nodes - main menu (left 60%) + user menu (right 40%)
		const depth1Nodes = nodesByDepth.get(1) || [];
		if (depth1Nodes.length > 0) {
			// Split: first 60% are "main menu", rest are "user menu"
			const mainCount = Math.ceil(depth1Nodes.length * 0.6);
			const mainNodes = depth1Nodes.slice(0, mainCount);
			const userNodes = depth1Nodes.slice(mainCount);

			const row1Y = nodeHeight + verticalGap;

			// Calculate total widths for centering
			const mainWidth = mainNodes.length * nodeWidth + (mainNodes.length - 1) * horizontalGap;
			const userWidth = userNodes.length * nodeWidth + (userNodes.length - 1) * horizontalGap;
			const totalWidth = mainWidth + userWidth + horizontalGap * 2;

			// Position main menu nodes (left side)
			const mainStartX = -totalWidth / 2;
			mainNodes.forEach((node, i) => {
				positions.set(node.id, {
					x: mainStartX + i * (nodeWidth + horizontalGap),
					y: row1Y
				});
			});

			// Position user menu nodes (right side)
			const userStartX = mainStartX + mainWidth + horizontalGap * 2;
			userNodes.forEach((node, i) => {
				positions.set(node.id, {
					x: userStartX + i * (nodeWidth + horizontalGap),
					y: row1Y
				});
			});
		}

		// Row 2+: Position children under their parents
		const processedDepths = new Set([0, 1]);
		const maxDepth = Math.max(...nodesByDepth.keys());

		for (let depth = 2; depth <= maxDepth; depth++) {
			const depthNodes = nodesByDepth.get(depth) || [];
			const rowY = depth * (nodeHeight + verticalGap);

			// Group nodes by their parent
			const nodesByParentId = new Map<string, PageNode[]>();
			for (const node of depthNodes) {
				const parentId = node.data.parentUrl ? urlToNodeId.get(node.data.parentUrl) : null;
				const key = parentId || 'orphan';
				if (!nodesByParentId.has(key)) {
					nodesByParentId.set(key, []);
				}
				nodesByParentId.get(key)!.push(node);
			}

			// Position each group under their parent
			for (const [parentId, children] of nodesByParentId) {
				const parentPos = positions.get(parentId);
				if (parentPos) {
					// Center children under parent
					const groupWidth = children.length * nodeWidth + (children.length - 1) * horizontalGap;
					const startX = parentPos.x + nodeWidth / 2 - groupWidth / 2;

					children.forEach((node, i) => {
						positions.set(node.id, {
							x: startX + i * (nodeWidth + horizontalGap),
							y: rowY
						});
					});
				} else {
					// Orphan nodes - position them at the end
					const existingPositions = Array.from(positions.values());
					const maxX = existingPositions.length > 0
						? Math.max(...existingPositions.map(p => p.x))
						: 0;
					children.forEach((node, i) => {
						positions.set(node.id, {
							x: maxX + (i + 1) * (nodeWidth + horizontalGap),
							y: rowY
						});
					});
				}
			}
		}

		// Update node positions
		nodes.update((currentNodes) => {
			return currentNodes.map((node) => {
				const pos = positions.get(node.id);
				if (pos) {
					return {
						...node,
						position: pos
					};
				}
				return node;
			});
		});
	}

	function setSessionId(sessionId: string) {
		progress.update((p) => ({ ...p, sessionId }));
	}

	function setStatus(status: CrawlProgress['status']) {
		progress.update((p) => ({ ...p, status }));
	}

	function reset() {
		nodes.set([]);
		edges.set([]);
		progress.set(defaultProgress);
		selectedNodeId.set(null);
		searchQuery.set('');
		urlToNodeId.clear();
	}

	function loadFromCache(cachedNodes: PageNode[], cachedEdges: LinkEdge[]) {
		// Clear existing data
		urlToNodeId.clear();

		// Rebuild URL to node ID mapping
		for (const node of cachedNodes) {
			urlToNodeId.set(node.data.url, node.id);
		}

		// Load nodes and edges
		nodes.set(cachedNodes);
		edges.set(cachedEdges);

		// Reset progress
		progress.set(defaultProgress);
		selectedNodeId.set(null);
		searchQuery.set('');
	}

	// Force a refresh of all nodes (creates new object references to trigger re-render)
	function refreshNodes() {
		nodes.update(current => current.map(n => ({ ...n, data: { ...n.data } })));
	}

	function getCurrentData() {
		return {
			nodes: get(nodes),
			edges: get(edges)
		};
	}

	// Derived store for filtered nodes based on search
	const filteredNodes = derived([nodes, searchQuery], ([$nodes, $searchQuery]) => {
		if (!$searchQuery) return $nodes;
		const query = $searchQuery.toLowerCase();
		return $nodes.filter(
			(node) =>
				node.data.url.toLowerCase().includes(query) ||
				node.data.title.toLowerCase().includes(query)
		);
	});

	// Derived store for selected node data
	const selectedNode = derived([nodes, selectedNodeId], ([$nodes, $selectedNodeId]) => {
		if (!$selectedNodeId) return null;
		return $nodes.find((n) => n.id === $selectedNodeId) || null;
	});

	return {
		nodes,
		edges,
		progress,
		selectedNodeId,
		searchQuery,
		zoomLevel,
		filteredNodes,
		selectedNode,
		addPage,
		updateScreenshot,
		layoutNodes,
		setSessionId,
		setStatus,
		reset,
		loadFromCache,
		getCurrentData,
		refreshNodes,
		selectNode: (id: string | null) => selectedNodeId.set(id),
		setSearchQuery: (query: string) => searchQuery.set(query),
		setZoomLevel: (level: number) => zoomLevel.set(level)
	};
}

export const sitemapStore = createSitemapStore();
