<script lang="ts">
	import {
		SvelteFlow,
		Controls,
		MiniMap,
		Background,
		BackgroundVariant,
		Panel,
		MarkerType,
		SelectionMode,
		useSvelteFlow,
		type NodeTypes,
		type EdgeTypes
	} from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';
	import { onMount } from 'svelte';

	import PageNode from './PageNode.svelte';
	import LinkEdge from './LinkEdge.svelte';
	import { sitemapStore } from '$lib/stores/sitemap.svelte';
	import { configStore } from '$lib/stores/config.svelte';
	import { apiService } from '$lib/services/api';
	import { socketService } from '$lib/services/socket';

	interface Props {
		siteId?: string;
	}

	let { siteId }: Props = $props();

	// Set site ID for position storage
	onMount(() => {
		if (siteId) {
			sitemapStore.setSiteId(siteId);
		}
	});

	// Cast to any to avoid Svelte 4/5 component type mismatch
	const nodeTypes: NodeTypes = {
		page: PageNode as any
	};

	const edgeTypes: EdgeTypes = {
		smoothstep: LinkEdge as any
	};

	// Time ago helper
	function timeAgo(dateString: string): string {
		const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
		if (seconds < 60) return 'just now';
		const minutes = Math.floor(seconds / 60);
		if (minutes < 60) return `${minutes}m ago`;
		const hours = Math.floor(minutes / 60);
		if (hours < 24) return `${hours}h ago`;
		const days = Math.floor(hours / 24);
		return `${days}d ago`;
	}

	// Search state
	let searchValue = $state('');

	// Crawl settings popover
	let showCrawlSettings = $state(false);
	let isLoading = $state(false);
	let crawlError = $state('');

	let isCrawling = $derived(sitemapStore.progress.status === 'crawling' || sitemapStore.progress.status === 'screenshotting');
	let resultCount = $derived(sitemapStore.filteredNodes.length);
	let totalCount = $derived(sitemapStore.nodes.length);
	let showSearchResults = $derived(searchValue.length > 0 && totalCount > 0);

	function handleViewportChange(event: { viewport: { zoom?: number } }) {
		if (event.viewport?.zoom !== undefined) {
			sitemapStore.setZoomLevel(event.viewport.zoom);
		}
	}

	function handleNodeClick(event: { node: { id: string } }) {
		if (event.node?.id) {
			sitemapStore.selectNode(event.node.id);
		}
	}

	function handlePaneClick() {
		sitemapStore.selectNode(null);
		showCrawlSettings = false;
	}

	function handleNodeDragStart(event: { targetNode: { id: string } | null }) {
		if (event.targetNode?.id) {
			sitemapStore.onNodeDragStart(event.targetNode.id);
		}
	}

	function handleNodeDrag(event: { targetNode: { id: string; position: { x: number; y: number } } | null }) {
		if (event.targetNode?.id && event.targetNode?.position) {
			sitemapStore.onNodeDrag(event.targetNode.id, event.targetNode.position);
		}
	}

	function handleNodeDragStop(event: { targetNode: { id: string; position: { x: number; y: number } } | null; nodes?: Array<{ id: string; position: { x: number; y: number } }> }) {
		// Multi-selection drag: save all dragged node positions
		if (event.nodes && event.nodes.length > 1) {
			sitemapStore.onMultiNodeDragStop(event.nodes);
			return;
		}
		if (event.targetNode?.id && event.targetNode?.position) {
			sitemapStore.onNodeDragStop(event.targetNode.id, event.targetNode.position);
		}
	}

	function getNodeColor(node: { data?: { depth?: number } }): string {
		const depth = node.data?.depth ?? 0;
		const colors = ['#3b82f6', '#22c55e', '#eab308', '#f97316', '#ef4444'];
		return colors[Math.min(depth, colors.length - 1)];
	}

	// Search handlers
	function handleSearchInput(event: Event) {
		const target = event.target as HTMLInputElement;
		searchValue = target.value;
		sitemapStore.setSearchQuery(target.value);
	}

	function handleClearSearch() {
		searchValue = '';
		sitemapStore.setSearchQuery('');
	}

	// Crawl handlers
	function handleUrlChange(event: Event) {
		const target = event.target as HTMLInputElement;
		configStore.setUrl(target.value);
	}

	function handleMaxDepthChange(event: Event) {
		const target = event.target as HTMLInputElement;
		configStore.setMaxDepth(parseInt(target.value, 10));
	}

	function handleMaxPagesChange(event: Event) {
		const target = event.target as HTMLInputElement;
		configStore.setMaxPages(parseInt(target.value, 10));
	}

	async function handleStartCrawl() {
		crawlError = '';

		try {
			new URL(configStore.url);
		} catch {
			crawlError = 'Please enter a valid URL';
			return;
		}

		isLoading = true;
		sitemapStore.reset();

		try {
			const response = await apiService.startCrawl(configStore.current);
			sitemapStore.setSessionId(response.sessionId);
			sitemapStore.setStatus('crawling');
			socketService.connect(response.sessionId, siteId);
			showCrawlSettings = false;
		} catch (err) {
			crawlError = err instanceof Error ? err.message : 'Failed to start crawl';
			sitemapStore.setStatus('error');
		} finally {
			isLoading = false;
		}
	}

	async function handleCancelCrawl() {
		if (sitemapStore.progress.sessionId) {
			try {
				await apiService.cancelCrawl(sitemapStore.progress.sessionId);
				socketService.disconnect();
				sitemapStore.setStatus('idle');
			} catch (err) {
				console.error('Failed to cancel crawl:', err);
			}
		}
	}
</script>

<div class="w-full h-full">
	<SvelteFlow
		{nodeTypes}
		{edgeTypes}
		nodes={sitemapStore.nodes}
		edges={sitemapStore.edges}
		fitView
		nodesDraggable={!sitemapStore.isLayoutLocked}
		selectionOnDrag
		panOnDrag={[1, 2]}
		selectionMode={SelectionMode.Partial}
		defaultEdgeOptions={{
			type: 'smoothstep',
			animated: false,
			markerEnd: {
				type: MarkerType.ArrowClosed,
				color: '#94a3b8'
			}
		}}
		minZoom={0.1}
		maxZoom={2}
		onnodeclick={handleNodeClick}
		onpaneclick={handlePaneClick}
		{...({ onviewportchange: handleViewportChange } as any)}
		onnodedragstart={handleNodeDragStart}
		onnodedrag={handleNodeDrag}
		onnodedragstop={handleNodeDragStop}
	>
		<!-- Unified Action Bar -->
		<Panel position="top-center">
			<div
				class="flex items-center gap-2 bg-white/95 backdrop-blur rounded-lg shadow-lg p-2 border border-gray-200"
			>
				<!-- Crawl Section -->
				<div class="relative">
					{#if isCrawling}
						<button
							class="px-3 py-1.5 rounded-md bg-red-100 hover:bg-red-200 text-red-700 text-sm font-medium transition-colors flex items-center gap-1.5"
							onclick={handleCancelCrawl}
							title="Cancel crawl"
						>
							<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
							</svg>
							Cancel
						</button>
					{:else}
						<button
							class="px-3 py-1.5 rounded-md bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium transition-colors flex items-center gap-1.5"
							onclick={() => (showCrawlSettings = !showCrawlSettings)}
							title="Crawl settings"
						>
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
							</svg>
							Crawl
						</button>
					{/if}

					<!-- Crawl Settings Dropdown -->
					{#if showCrawlSettings}
						<div class="absolute top-full left-0 mt-2 w-72 bg-white rounded-lg shadow-xl border border-gray-200 p-4 z-50">
							<div class="space-y-3">
								<div>
									<label class="block text-xs font-medium text-gray-600 mb-1">Website URL</label>
									<input
										type="url"
										value={configStore.url}
										oninput={handleUrlChange}
										placeholder="https://example.com"
										class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-orange-500"
									/>
								</div>

								<div>
									<label class="block text-xs font-medium text-gray-600 mb-1">
										Max Depth: {configStore.maxDepth}
									</label>
									<input
										type="range"
										value={configStore.maxDepth}
										oninput={handleMaxDepthChange}
										min="1"
										max="5"
										class="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
									/>
								</div>

								<div>
									<label class="block text-xs font-medium text-gray-600 mb-1">
										Max Pages: {configStore.maxPages}
									</label>
									<input
										type="range"
										value={configStore.maxPages}
										oninput={handleMaxPagesChange}
										min="3"
										max="500"
										class="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
									/>
								</div>

								{#if crawlError}
									<p class="text-xs text-red-600">{crawlError}</p>
								{/if}

								<button
									onclick={handleStartCrawl}
									disabled={isLoading || !configStore.url}
									class="w-full px-3 py-2 bg-orange-500 text-white text-sm font-medium rounded hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
								>
									{isLoading ? 'Starting...' : 'Start Crawl'}
								</button>
							</div>
						</div>
					{/if}
				</div>

				<div class="w-px h-6 bg-gray-300"></div>

				<!-- Layout Mode Toggle -->
				<select
					class="px-3 py-1.5 rounded-md border border-gray-300 text-sm bg-white cursor-pointer
					       hover:border-gray-400 focus:border-orange-500 focus:ring-1 focus:ring-orange-500"
					value={sitemapStore.layoutMode}
					onchange={(e) => sitemapStore.setLayoutMode(e.currentTarget.value as 'hierarchical' | 'radial')}
				>
					<option value="hierarchical">Rows</option>
					<option value="radial">Circular</option>
				</select>

				<!-- Reset Button -->
				<button
					class="px-3 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200 text-sm font-medium
					       transition-colors flex items-center gap-1.5"
					onclick={() => sitemapStore.resetLayout()}
					title="Reset layout to default (expand all, auto-position)"
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
						/>
					</svg>
					Reset
				</button>

				<!-- Lock Toggle -->
				<button
					class="px-3 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5
					       {sitemapStore.isLayoutLocked ? 'bg-orange-100 hover:bg-orange-200 text-orange-700' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}"
					onclick={() => sitemapStore.toggleLayoutLock()}
					title={sitemapStore.isLayoutLocked ? 'Layout locked — click to unlock' : 'Layout unlocked — click to lock'}
				>
					{#if sitemapStore.isLayoutLocked}
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
						</svg>
					{:else}
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
						</svg>
					{/if}
				</button>

				<div class="w-px h-6 bg-gray-300"></div>

				<!-- Search -->
				<div class="relative">
					<svg
						class="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
						/>
					</svg>
					<input
						type="text"
						value={searchValue}
						oninput={handleSearchInput}
						placeholder="Search..."
						class="w-40 pl-8 pr-6 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500"
					/>
					{#if searchValue}
						<button
							onclick={handleClearSearch}
							class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
						>
							<svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					{/if}
					{#if showSearchResults}
						<div class="absolute top-full left-0 mt-1 px-2 py-0.5 bg-gray-800 text-white text-xs rounded">
							{resultCount}/{totalCount}
						</div>
					{/if}
				</div>
			</div>
		</Panel>

		<!-- Progress indicator -->
		{#if isCrawling}
			<Panel position="top-left">
				<div class="bg-white/95 backdrop-blur rounded-lg shadow-lg p-3 border border-gray-200 text-sm">
					<div class="flex items-center gap-2 text-gray-600">
						<svg class="w-4 h-4 animate-spin text-orange-500" fill="none" viewBox="0 0 24 24">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
						</svg>
						<span>
							{sitemapStore.progress.crawled} crawled, {sitemapStore.progress.screenshotted} screenshots
						</span>
					</div>
				</div>
			</Panel>
		{/if}

		<!-- Last arranged by indicator -->
		{#if sitemapStore.layoutUpdatedBy}
			<Panel position="bottom-right">
				<div class="bg-white/80 backdrop-blur px-3 py-1.5 rounded-lg shadow text-xs text-gray-500">
					Arranged by {sitemapStore.layoutUpdatedBy}{sitemapStore.layoutUpdatedAt ? `, ${timeAgo(sitemapStore.layoutUpdatedAt)}` : ''}
				</div>
			</Panel>
		{/if}

		<Controls />
		<MiniMap nodeColor={getNodeColor} maskColor="rgb(0, 0, 0, 0.1)" />
		<Background variant={BackgroundVariant.Dots} gap={20} size={1} />
	</SvelteFlow>
</div>
