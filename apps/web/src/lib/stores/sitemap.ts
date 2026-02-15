import { writable, derived, get } from 'svelte/store';
import type { PageNode, LinkEdge, CrawlProgress, PageDiscoveredEvent, PageScreenshotEvent } from '$lib/types';
import { applyLayout, reorganizeByUrlHierarchy, type LayoutMode } from '$lib/services/layoutEngine';
import type { Edge } from '@xyflow/svelte';

const defaultProgress: CrawlProgress = {
	sessionId: '',
	status: 'idle',
	found: 0,
	crawled: 0,
	screenshotted: 0,
	errors: 0
};

import { browser } from '$app/environment';

const POSITIONS_STORAGE_KEY = 'sitemap-node-positions';
const LAYOUT_MODE_STORAGE_KEY = 'sitemap-layout-mode';

function createSitemapStore() {
	const nodes = writable<PageNode[]>([]);
	const edges = writable<LinkEdge[]>([]);
	const progress = writable<CrawlProgress>(defaultProgress);
	const selectedNodeId = writable<string | null>(null);
	const searchQuery = writable<string>('');
	const zoomLevel = writable<number>(1);

	// Load saved layout mode from localStorage (only in browser)
	const savedLayoutMode = browser
		? localStorage.getItem(LAYOUT_MODE_STORAGE_KEY) as LayoutMode | null
		: null;
	const layoutMode = writable<LayoutMode>(savedLayoutMode || 'hierarchical');

	// URL to node ID mapping
	const urlToNodeId = new Map<string, string>();

	// Track manually positioned nodes and their positions
	const manuallyPositioned = new Set<string>();

	// Current site ID for position storage
	let currentSiteId: string | null = null;

	// Set current site ID for position storage
	function setSiteId(siteId: string) {
		currentSiteId = siteId;
	}

	// Save node positions to localStorage (per layout mode)
	function savePositions() {
		if (!browser || !currentSiteId) {
			console.log('[savePositions] Skip - browser:', browser, 'siteId:', currentSiteId);
			return;
		}

		const currentNodes = get(nodes);
		const mode = get(layoutMode);
		const positions: Record<string, { x: number; y: number }> = {};

		for (const node of currentNodes) {
			positions[node.id] = node.position;
		}

		try {
			const key = `${POSITIONS_STORAGE_KEY}-${currentSiteId}-${mode}`;
			localStorage.setItem(key, JSON.stringify(positions));
			console.log('[savePositions] Saved', Object.keys(positions).length, 'positions to', key);
		} catch (e) {
			console.error('Failed to save node positions:', e);
		}
	}

	// Load node positions from localStorage (for specific layout mode)
	function loadPositions(mode?: LayoutMode): Record<string, { x: number; y: number }> | null {
		if (!browser || !currentSiteId) {
			console.log('[loadPositions] Skip - browser:', browser, 'siteId:', currentSiteId);
			return null;
		}

		const targetMode = mode || get(layoutMode);
		try {
			const key = `${POSITIONS_STORAGE_KEY}-${currentSiteId}-${targetMode}`;
			const saved = localStorage.getItem(key);
			console.log('[loadPositions] Key:', key, 'Found:', !!saved);
			if (saved) {
				const parsed = JSON.parse(saved);
				console.log('[loadPositions] Loaded', Object.keys(parsed).length, 'positions');
				return parsed;
			}
		} catch (e) {
			console.error('Failed to load node positions:', e);
		}
		return null;
	}

	// Clear saved positions for current layout mode
	function clearSavedPositions() {
		if (!browser || !currentSiteId) return;

		const mode = get(layoutMode);
		try {
			const key = `${POSITIONS_STORAGE_KEY}-${currentSiteId}-${mode}`;
			localStorage.removeItem(key);
		} catch (e) {
			console.error('Failed to clear node positions:', e);
		}
	}

	// Clear saved positions for all layout modes
	function clearAllSavedPositions() {
		if (!browser || !currentSiteId) return;

		try {
			localStorage.removeItem(`${POSITIONS_STORAGE_KEY}-${currentSiteId}-hierarchical`);
			localStorage.removeItem(`${POSITIONS_STORAGE_KEY}-${currentSiteId}-radial`);
		} catch (e) {
			console.error('Failed to clear node positions:', e);
		}
	}

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
					externalLinks: event.externalLinks,
					isExpanded: true
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
		const currentEdges = get(edges);
		const mode = get(layoutMode);

		if (currentNodes.length === 0) return;

		const layoutedNodes = applyLayout(currentNodes, currentEdges as Edge[], mode).map((node) => {
			// Preserve manually positioned nodes
			if (manuallyPositioned.has(node.id)) {
				const original = currentNodes.find((n) => n.id === node.id);
				if (original) return { ...node, position: original.position };
			}
			return node;
		});

		nodes.set(layoutedNodes);
	}

	function setLayoutMode(mode: LayoutMode) {
		const currentMode = get(layoutMode);
		console.log('[setLayoutMode] Switching from', currentMode, 'to', mode, '| siteId:', currentSiteId);

		// Save positions for the current mode before switching
		if (currentMode !== mode && currentSiteId) {
			console.log('[setLayoutMode] Saving positions for', currentMode);
			savePositions();
		}

		// Clear manually positioned and switch mode
		manuallyPositioned.clear();
		layoutMode.set(mode);

		// Save layout mode to localStorage
		if (browser) {
			localStorage.setItem(LAYOUT_MODE_STORAGE_KEY, mode);
		}

		// Load saved positions for the new mode
		console.log('[setLayoutMode] Loading positions for', mode);
		const savedPositions = loadPositions(mode);
		console.log('[setLayoutMode] Got savedPositions:', savedPositions ? Object.keys(savedPositions).length : 0);

		if (savedPositions) {
			nodes.update((currentNodes) =>
				currentNodes.map((node) => {
					if (savedPositions[node.id]) {
						manuallyPositioned.add(node.id);
						return { ...node, position: savedPositions[node.id] };
					}
					return node;
				})
			);
			console.log('[setLayoutMode] Applied positions, manuallyPositioned:', manuallyPositioned.size);
		}

		// Apply layout (will preserve manually positioned nodes)
		layoutNodes();

		// Save positions for the new mode
		savePositions();
	}

	function onNodeDragStop(nodeId: string, position: { x: number; y: number }) {
		console.log('[onNodeDragStop] Node', nodeId, 'dragged to', position);
		manuallyPositioned.add(nodeId);
		nodes.update((currentNodes) =>
			currentNodes.map((n) => (n.id === nodeId ? { ...n, position } : n))
		);
		// Save positions after drag
		savePositions();
	}

	// Reset to default state: clear positions, expand all, re-layout
	function resetLayout() {
		manuallyPositioned.clear();
		clearAllSavedPositions(); // Clear positions for both hierarchical and radial modes

		// Expand all nodes
		nodes.update((currentNodes) =>
			currentNodes.map((n) => ({
				...n,
				hidden: false,
				data: { ...n.data, isExpanded: true }
			}))
		);

		layoutNodes();
	}

	// Get all descendant IDs for a node
	function getDescendantIds(nodeId: string, edgeList: Edge[]): string[] {
		const children: string[] = [];
		const directChildren = edgeList.filter((e) => e.source === nodeId).map((e) => e.target);

		for (const childId of directChildren) {
			children.push(childId);
			children.push(...getDescendantIds(childId, edgeList));
		}
		return children;
	}

	function toggleNodeExpanded(nodeId: string) {
		const currentEdges = get(edges);

		nodes.update((currentNodes) => {
			const node = currentNodes.find((n) => n.id === nodeId);
			if (!node) return currentNodes;

			const isExpanding = node.data.isExpanded === false;
			const childIds = getDescendantIds(nodeId, currentEdges as Edge[]);

			return currentNodes.map((n) => {
				if (n.id === nodeId) {
					return { ...n, data: { ...n.data, isExpanded: isExpanding } };
				}
				if (childIds.includes(n.id)) {
					return { ...n, hidden: !isExpanding };
				}
				return n;
			});
		});

		layoutNodes();
		savePositions();
	}

	function expandAll() {
		nodes.update((currentNodes) =>
			currentNodes.map((n) => ({
				...n,
				hidden: false,
				data: { ...n.data, isExpanded: true }
			}))
		);
		layoutNodes();
	}

	function collapseToDepth(maxDepth: number) {
		nodes.update((currentNodes) =>
			currentNodes.map((n) => ({
				...n,
				hidden: n.data.depth > maxDepth,
				data: { ...n.data, isExpanded: n.data.depth < maxDepth }
			}))
		);
		layoutNodes();
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
		manuallyPositioned.clear();
		layoutMode.set('hierarchical');
	}

	function loadFromCache(cachedNodes: PageNode[], cachedEdges: LinkEdge[]) {
		// Clear existing data
		urlToNodeId.clear();
		manuallyPositioned.clear();

		// Rebuild URL to node ID mapping
		for (const node of cachedNodes) {
			urlToNodeId.set(node.data.url, node.id);
		}

		// Initialize isExpanded for nodes without it
		const nodesWithExpanded = cachedNodes.map((node) => ({
			...node,
			hidden: false,
			data: {
				...node.data,
				isExpanded: node.data.isExpanded ?? true
			}
		}));

		// Reorganize by URL path hierarchy
		const { nodes: reorganizedNodes, edges: reorganizedEdges } = reorganizeByUrlHierarchy(
			nodesWithExpanded,
			cachedEdges as Edge[]
		);

		// Apply saved positions for current layout mode
		const currentMode = get(layoutMode);
		console.log('[loadFromCache] Current layout mode:', currentMode, 'siteId:', currentSiteId);
		const savedPositions = loadPositions(currentMode);
		console.log('[loadFromCache] savedPositions:', savedPositions ? Object.keys(savedPositions).length : 'null');

		// Only use mode-specific saved positions, not cached positions from potentially different mode
		const nodesWithPositions = reorganizedNodes.map((node) => {
			if (savedPositions && savedPositions[node.id]) {
				manuallyPositioned.add(node.id);
				return { ...node, position: savedPositions[node.id] };
			}
			// No mode-specific position - let layoutNodes() calculate it
			return node;
		});

		console.log('[loadFromCache] Loaded', manuallyPositioned.size, 'positions for', currentMode, 'mode');

		// Load nodes and edges
		nodes.set(nodesWithPositions);
		edges.set(reorganizedEdges as LinkEdge[]);

		// Always apply layout - it will preserve positions for nodes in manuallyPositioned
		layoutNodes();

		// Reset progress
		progress.set(defaultProgress);
		selectedNodeId.set(null);
		searchQuery.set('');
	}

	// Reorganize the current nodes/edges by URL hierarchy
	function applyUrlHierarchy() {
		const currentNodes = get(nodes);
		const currentEdges = get(edges);

		if (currentNodes.length === 0) return;

		// Rebuild URL to node ID mapping
		urlToNodeId.clear();
		for (const node of currentNodes) {
			urlToNodeId.set(node.data.url, node.id);
		}

		const { nodes: reorganizedNodes, edges: reorganizedEdges } = reorganizeByUrlHierarchy(
			currentNodes,
			currentEdges as Edge[]
		);

		nodes.set(reorganizedNodes);
		edges.set(reorganizedEdges as LinkEdge[]);

		// Re-apply layout after reorganizing
		layoutNodes();
	}

	// Force a refresh of all nodes (creates new object references to trigger re-render)
	function refreshNodes() {
		nodes.update((current) => current.map((n) => ({ ...n, data: { ...n.data } })));
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
		layoutMode,
		filteredNodes,
		selectedNode,
		addPage,
		updateScreenshot,
		layoutNodes,
		setLayoutMode,
		onNodeDragStop,
		resetLayout,
		toggleNodeExpanded,
		expandAll,
		collapseToDepth,
		applyUrlHierarchy,
		setSessionId,
		setStatus,
		reset,
		clearAll: reset, // Alias for reset
		loadFromCache,
		getCurrentData,
		refreshNodes,
		setSiteId,
		savePositions,
		selectNode: (id: string | null) => selectedNodeId.set(id),
		setSearchQuery: (query: string) => searchQuery.set(query),
		setZoomLevel: (level: number) => zoomLevel.set(level)
	};
}

export const sitemapStore = createSitemapStore();
