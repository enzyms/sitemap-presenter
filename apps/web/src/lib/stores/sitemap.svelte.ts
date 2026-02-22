import { browser } from '$app/environment';
import type { PageNode, LinkEdge, CrawlProgress, CrawlDiffEvent, PageDiscoveredEvent, PageScreenshotEvent } from '$lib/types';
import { applyLayout, reorganizeByUrlHierarchy, type LayoutMode } from '$lib/services/layoutEngine';
import { layoutPositions } from '$lib/services/layoutPositions';
import type { Edge } from '@xyflow/svelte';

const defaultProgress: CrawlProgress = {
	sessionId: '',
	status: 'idle',
	found: 0,
	crawled: 0,
	screenshotted: 0,
	errors: 0
};

const POSITIONS_STORAGE_KEY = 'sitemap-node-positions';
const LAYOUT_MODE_STORAGE_KEY = 'sitemap-layout-mode';

class SitemapStore {
	nodes = $state<PageNode[]>([]);
	edges = $state<LinkEdge[]>([]);
	progress = $state<CrawlProgress>({ ...defaultProgress });
	selectedNodeId = $state<string | null>(null);
	searchQuery = $state('');
	zoomLevel = $state(1);
	layoutMode = $state<LayoutMode>(
		(browser ? (localStorage.getItem(LAYOUT_MODE_STORAGE_KEY) as LayoutMode) : null) ||
			'hierarchical'
	);

	// Crawl diff (new/modified/deleted pages after recrawl)
	crawlDiff = $state<CrawlDiffEvent | null>(null);

	// Layout lock/meta state
	isLayoutLocked = $state(false);
	layoutUpdatedBy = $state<string | null>(null);
	layoutUpdatedAt = $state<string | null>(null);

	// Internal state (not reactive)
	private urlToNodeId = new Map<string, string>();
	private manuallyPositioned = new Set<string>();
	private currentSiteId: string | null = null;
	private _dragOrigin: { x: number; y: number } | null = null;
	private _dragDescendants: Map<string, { x: number; y: number }> | null = null;

	// Derived values
	filteredNodes = $derived.by(() => {
		if (!this.searchQuery) return this.nodes;
		const query = this.searchQuery.toLowerCase();
		return this.nodes.filter(
			(node) =>
				node.data.url.toLowerCase().includes(query) ||
				node.data.title.toLowerCase().includes(query)
		);
	});

	selectedNode = $derived.by(() => {
		if (!this.selectedNodeId) return null;
		return this.nodes.find((n) => n.id === this.selectedNodeId) || null;
	});

	nodesWithFeedback = $derived.by(() => {
		return this.nodes
			.filter((n) => n.data.feedbackStats && n.data.feedbackStats.total > 0)
			.sort((a, b) => {
				try {
					const pathA = new URL(a.data.url).pathname;
					const pathB = new URL(b.data.url).pathname;
					return pathA.localeCompare(pathB);
				} catch {
					return 0;
				}
			});
	});

	setSiteId(siteId: string) {
		this.currentSiteId = siteId;
	}

	savePositions() {
		if (!browser || !this.currentSiteId) return;

		const positions: Record<string, { x: number; y: number }> = {};
		for (const node of this.nodes) {
			positions[node.id] = node.position;
		}

		layoutPositions.savePositions(this.currentSiteId, this.layoutMode, positions, this.layoutUpdatedBy);
	}

	flushPositions() {
		layoutPositions.flushPendingSave();
	}

	private loadPositionsSync(mode?: LayoutMode): Record<string, { x: number; y: number }> | null {
		if (!browser || !this.currentSiteId) return null;
		const targetMode = mode || this.layoutMode;
		return layoutPositions.loadPositionsSync(this.currentSiteId, targetMode);
	}

	/** Fetch positions from Supabase and apply to current nodes. */
	async applySupabasePositions(): Promise<void> {
		if (!this.currentSiteId) return;
		const positions = await layoutPositions.loadPositions(this.currentSiteId, this.layoutMode);
		if (!positions) return;

		this.nodes = this.nodes.map((node) => {
			if (positions[node.id]) {
				this.manuallyPositioned.add(node.id);
				return { ...node, position: positions[node.id] };
			}
			return node;
		});
	}

	async loadLayoutMeta(): Promise<void> {
		if (!this.currentSiteId) return;
		const meta = await layoutPositions.getLayoutMeta(this.currentSiteId, this.layoutMode);
		this.isLayoutLocked = meta.is_locked;
		this.layoutUpdatedBy = meta.updated_by;
		this.layoutUpdatedAt = meta.updated_at;
	}

	async toggleLayoutLock(): Promise<void> {
		if (!this.currentSiteId) return;
		const newLocked = await layoutPositions.toggleLock(this.currentSiteId, this.layoutMode);
		this.isLayoutLocked = newLocked;
	}

	private clearAllSavedPositions() {
		if (!browser || !this.currentSiteId) return;

		try {
			localStorage.removeItem(`${POSITIONS_STORAGE_KEY}-${this.currentSiteId}-hierarchical`);
			localStorage.removeItem(`${POSITIONS_STORAGE_KEY}-${this.currentSiteId}-radial`);
		} catch (e) {
			console.error('Failed to clear node positions:', e);
		}
	}

	private generateNodeId(url: string): string {
		const existingId = this.urlToNodeId.get(url);
		if (existingId) return existingId;

		const id = `node-${this.urlToNodeId.size + 1}`;
		this.urlToNodeId.set(url, id);
		return id;
	}

	addPage(event: PageDiscoveredEvent) {
		const nodeId = this.generateNodeId(event.url);

		const newNode: PageNode = {
			id: nodeId,
			type: 'page',
			position: { x: 0, y: 0 },
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

		const existingIndex = this.nodes.findIndex((n) => n.id === nodeId);
		if (existingIndex >= 0) {
			this.nodes[existingIndex] = { ...this.nodes[existingIndex], data: newNode.data };
		} else {
			this.nodes = [...this.nodes, newNode];
		}

		// Only add edge from parent to child
		if (event.parentUrl) {
			const parentId = this.urlToNodeId.get(event.parentUrl);
			if (parentId) {
				const edgeId = `edge-${parentId}-${nodeId}`;
				if (!this.edges.some((e) => e.id === edgeId)) {
					this.edges = [
						...this.edges,
						{
							id: edgeId,
							source: parentId,
							target: nodeId,
							type: 'smoothstep',
							animated: false,
							data: {
								sourceUrl: event.parentUrl!,
								targetUrl: event.url
							}
						}
					];
				}
			}
		}

		// Update progress
		this.progress = {
			...this.progress,
			found: this.progress.found + 1,
			crawled: this.progress.crawled + 1
		};
	}

	updateScreenshot(event: PageScreenshotEvent) {
		const nodeId = this.urlToNodeId.get(event.url);
		if (!nodeId) return;

		this.nodes = this.nodes.map((node) => {
			if (node.id === nodeId) {
				return {
					...node,
					data: {
						...node.data,
						thumbnailUrl: event.thumbnailUrl,
						screenshotStatus: 'ready' as const
					}
				};
			}
			return node;
		});

		this.progress = {
			...this.progress,
			screenshotted: this.progress.screenshotted + 1
		};
	}

	applyCrawlDiff(diff: CrawlDiffEvent) {
		this.crawlDiff = diff;

		// Tag nodes with changeStatus for badge rendering
		const newSet = new Set(diff.newPages);
		const modifiedSet = new Set(diff.modifiedPages);

		this.nodes = this.nodes.map((node) => {
			if (newSet.has(node.data.url)) {
				return { ...node, data: { ...node.data, changeStatus: 'new' as const } };
			}
			if (modifiedSet.has(node.data.url)) {
				return { ...node, data: { ...node.data, changeStatus: 'modified' as const } };
			}
			return node;
		});
	}

	layoutNodes() {
		if (this.nodes.length === 0) return;

		const layoutedNodes = applyLayout(
			this.nodes,
			this.edges as Edge[],
			this.layoutMode
		).map((node) => {
			if (this.manuallyPositioned.has(node.id)) {
				const original = this.nodes.find((n) => n.id === node.id);
				if (original) return { ...node, position: original.position };
			}
			return node;
		});

		this.nodes = layoutedNodes;
	}

	setLayoutMode(mode: LayoutMode) {
		const currentMode = this.layoutMode;

		// Save positions for the current mode before switching
		if (currentMode !== mode && this.currentSiteId) {
			this.savePositions();
		}

		this.manuallyPositioned.clear();
		this.layoutMode = mode;

		if (browser) {
			localStorage.setItem(LAYOUT_MODE_STORAGE_KEY, mode);
		}

		// First, re-layout all nodes with the new mode's algorithm
		// (manuallyPositioned is empty, so all nodes get fresh positions)
		this.layoutNodes();

		// Then overlay any saved positions for nodes the user had manually arranged
		const savedPositions = this.loadPositionsSync(mode);

		if (savedPositions) {
			this.nodes = this.nodes.map((node) => {
				if (savedPositions[node.id]) {
					this.manuallyPositioned.add(node.id);
					return { ...node, position: savedPositions[node.id] };
				}
				return node;
			});
		}

		this.savePositions();

		// Load meta for new mode
		this.loadLayoutMeta();
	}

	onNodeDragStart(nodeId: string) {
		// Snapshot positions of all descendants at drag start
		const descendantIds = this.getDescendantIds(nodeId, this.edges as Edge[]);
		const draggedNode = this.nodes.find((n) => n.id === nodeId);
		if (!draggedNode) return;

		this._dragOrigin = { ...draggedNode.position };
		this._dragDescendants = new Map();
		for (const id of descendantIds) {
			const node = this.nodes.find((n) => n.id === id);
			if (node) {
				this._dragDescendants.set(id, { ...node.position });
			}
		}
	}

	onNodeDrag(nodeId: string, position: { x: number; y: number }) {
		if (!this._dragOrigin || !this._dragDescendants) return;

		const dx = position.x - this._dragOrigin.x;
		const dy = position.y - this._dragOrigin.y;

		this.nodes = this.nodes.map((n) => {
			if (n.id === nodeId) return { ...n, position };
			const origPos = this._dragDescendants!.get(n.id);
			if (origPos) {
				return { ...n, position: { x: origPos.x + dx, y: origPos.y + dy } };
			}
			return n;
		});
	}

	onNodeDragStop(nodeId: string, position: { x: number; y: number }) {
		if (this.isLayoutLocked) {
			this._dragOrigin = null;
			this._dragDescendants = null;
			return;
		}
		// Apply final delta to all descendants
		if (this._dragOrigin && this._dragDescendants) {
			const dx = position.x - this._dragOrigin.x;
			const dy = position.y - this._dragOrigin.y;

			const descendantIds = new Set(this._dragDescendants.keys());
			this.manuallyPositioned.add(nodeId);

			this.nodes = this.nodes.map((n) => {
				if (n.id === nodeId) {
					return { ...n, position };
				}
				if (descendantIds.has(n.id)) {
					const origPos = this._dragDescendants!.get(n.id)!;
					this.manuallyPositioned.add(n.id);
					return { ...n, position: { x: origPos.x + dx, y: origPos.y + dy } };
				}
				return n;
			});
		} else {
			this.manuallyPositioned.add(nodeId);
			this.nodes = this.nodes.map((n) => (n.id === nodeId ? { ...n, position } : n));
		}

		this._dragOrigin = null;
		this._dragDescendants = null;
		this.savePositions();
	}

	onMultiNodeDragStop(movedNodes: Array<{ id: string; position: { x: number; y: number } }>) {
		if (this.isLayoutLocked) {
			this._dragOrigin = null;
			this._dragDescendants = null;
			return;
		}
		const posMap = new Map(movedNodes.map((n) => [n.id, n.position]));
		this.nodes = this.nodes.map((n) => {
			const newPos = posMap.get(n.id);
			if (newPos) {
				this.manuallyPositioned.add(n.id);
				return { ...n, position: newPos };
			}
			return n;
		});
		this._dragOrigin = null;
		this._dragDescendants = null;
		this.savePositions();
	}

	resetLayout() {
		this.manuallyPositioned.clear();
		this.clearAllSavedPositions();

		this.nodes = this.nodes.map((n) => ({
			...n,
			hidden: false,
			data: { ...n.data, isExpanded: true }
		}));

		this.layoutNodes();
	}

	private getDescendantIds(nodeId: string, edgeList: Edge[]): string[] {
		const children: string[] = [];
		const directChildren = edgeList.filter((e) => e.source === nodeId).map((e) => e.target);

		for (const childId of directChildren) {
			children.push(childId);
			children.push(...this.getDescendantIds(childId, edgeList));
		}
		return children;
	}

	toggleNodeExpanded(nodeId: string) {
		const node = this.nodes.find((n) => n.id === nodeId);
		if (!node) return;

		const isExpanding = node.data.isExpanded === false;
		const childIds = this.getDescendantIds(nodeId, this.edges as Edge[]);

		this.nodes = this.nodes.map((n) => {
			if (n.id === nodeId) {
				return { ...n, data: { ...n.data, isExpanded: isExpanding } };
			}
			if (childIds.includes(n.id)) {
				return { ...n, hidden: !isExpanding };
			}
			return n;
		});

		this.layoutNodes();
		this.savePositions();
	}

	expandAll() {
		this.nodes = this.nodes.map((n) => ({
			...n,
			hidden: false,
			data: { ...n.data, isExpanded: true }
		}));
		this.layoutNodes();
	}

	collapseToDepth(maxDepth: number) {
		this.nodes = this.nodes.map((n) => ({
			...n,
			hidden: n.data.depth > maxDepth,
			data: { ...n.data, isExpanded: n.data.depth < maxDepth }
		}));
		this.layoutNodes();
	}

	setSessionId(sessionId: string) {
		this.progress = { ...this.progress, sessionId };
	}

	setStatus(status: CrawlProgress['status']) {
		this.progress = { ...this.progress, status };
	}

	/** Update progress fields from external consumers (e.g., socket.ts) */
	updateProgress(updates: Partial<CrawlProgress>) {
		this.progress = { ...this.progress, ...updates };
	}

	reset() {
		this.nodes = [];
		this.edges = [];
		this.progress = { ...defaultProgress };
		this.selectedNodeId = null;
		this.searchQuery = '';
		this.crawlDiff = null;
		this.urlToNodeId.clear();
		this.manuallyPositioned.clear();
		this.layoutMode = 'hierarchical';
		this.isLayoutLocked = false;
		this.layoutUpdatedBy = null;
		this.layoutUpdatedAt = null;
		this._dragOrigin = null;
		this._dragDescendants = null;
	}

	clearAll() {
		this.reset();
	}

	loadFromCache(cachedNodes: PageNode[], cachedEdges: LinkEdge[]) {
		this.urlToNodeId.clear();
		this.manuallyPositioned.clear();

		for (const node of cachedNodes) {
			this.urlToNodeId.set(node.data.url, node.id);
		}

		const nodesWithExpanded = cachedNodes.map((node) => ({
			...node,
			hidden: false,
			data: {
				...node.data,
				isExpanded: node.data.isExpanded ?? true
			}
		}));

		const { nodes: reorganizedNodes, edges: reorganizedEdges } = reorganizeByUrlHierarchy(
			nodesWithExpanded,
			cachedEdges as Edge[]
		);

		// Use sync localStorage for instant render; async Supabase overwrite handled by caller
		const savedPositions = this.loadPositionsSync(this.layoutMode);

		const nodesWithPositions = reorganizedNodes.map((node) => {
			if (savedPositions && savedPositions[node.id]) {
				this.manuallyPositioned.add(node.id);
				return { ...node, position: savedPositions[node.id] };
			}
			return node;
		});

		this.nodes = nodesWithPositions;
		this.edges = reorganizedEdges as LinkEdge[];

		this.layoutNodes();

		this.progress = { ...defaultProgress };
		this.selectedNodeId = null;
		this.searchQuery = '';
	}

	applyUrlHierarchy() {
		if (this.nodes.length === 0) return;

		this.urlToNodeId.clear();
		for (const node of this.nodes) {
			this.urlToNodeId.set(node.data.url, node.id);
		}

		const { nodes: reorganizedNodes, edges: reorganizedEdges } = reorganizeByUrlHierarchy(
			this.nodes,
			this.edges as Edge[]
		);

		this.nodes = reorganizedNodes;
		this.edges = reorganizedEdges as LinkEdge[];

		this.layoutNodes();
	}

	refreshNodes() {
		this.nodes = this.nodes.map((n) => ({ ...n, data: { ...n.data } }));
	}

	getCurrentData() {
		return {
			nodes: this.nodes,
			edges: this.edges
		};
	}

	selectNode(id: string | null) {
		this.selectedNodeId = id;
	}

	navigateToFeedbackNode(direction: 'prev' | 'next'): PageNode | null {
		const feedbackNodes = this.nodesWithFeedback;
		if (feedbackNodes.length === 0) return null;

		const currentIndex = feedbackNodes.findIndex((n) => n.id === this.selectedNodeId);
		let targetIndex: number;

		if (currentIndex === -1) {
			targetIndex = 0;
		} else if (direction === 'next') {
			targetIndex = (currentIndex + 1) % feedbackNodes.length;
		} else {
			targetIndex = (currentIndex - 1 + feedbackNodes.length) % feedbackNodes.length;
		}

		const target = feedbackNodes[targetIndex];
		this.selectedNodeId = target.id;
		return target;
	}

	setSearchQuery(query: string) {
		this.searchQuery = query;
	}

	setZoomLevel(level: number) {
		this.zoomLevel = level;
	}
}

export const sitemapStore = new SitemapStore();
