<script lang="ts">
	import { page } from '$app/state';
	import { replaceState, afterNavigate } from '$app/navigation';
	import { onMount } from 'svelte';
	import AppHeader from '$lib/components/ui/AppHeader.svelte';
	import SitemapCanvas from '$lib/components/canvas/SitemapCanvas.svelte';
	import PageViewer from '$lib/components/viewer/PageViewer.svelte';
	import { sitemapStore } from '$lib/stores/sitemap.svelte';
	import { pageViewerStore } from '$lib/stores/pageViewer.svelte';
	import { configStore } from '$lib/stores/config.svelte';
	import { feedbackStore } from '$lib/stores/feedback.svelte';
	import { getSupabase, type Site } from '$lib/services/supabase';
	import { screenshotCache } from '$lib/services/screenshotCache';
	import { layoutPositions } from '$lib/services/layoutPositions';
	import { crawlCacheService } from '$lib/services/crawlCacheService';
	import { crawlSessionService } from '$lib/services/crawlSession';
	import { apiService } from '$lib/services/api';
	import { socketService } from '$lib/services/socket';
	import type { PageNode, FeedbackStats } from '$lib/types';

	let siteId = $derived(page.params.id!);
	let site = $state<Site | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let initialNodeId = page.params.nodeId ?? null;
	let initialMarkerId = page.url.searchParams.get('marker');
	let initialView = page.url.searchParams.get('view');

	let routerReady = $state(false);
	afterNavigate(() => { routerReady = true; });

	let hasNodes = $derived(sitemapStore.nodes.length > 0);

	// Load site from Supabase
	async function loadSite() {
		loading = true;
		error = null;

		try {
			const supabase = getSupabase();
			const { data, error: fetchError } = await supabase
				.from('sites')
				.select('*')
				.eq('id', siteId)
				.single();

			if (fetchError) throw fetchError;
			site = data;

			// Prefill config with site's domain and saved crawl settings
			if (site?.domain) {
				configStore.setUrl(site.domain.startsWith('http') ? site.domain : `https://${site.domain}`);
			}
			if (site?.settings?.crawl) {
				configStore.loadFromSiteSettings(site.settings.crawl);
			}

			// Initialize feedback store for this site
			await feedbackStore.initializeBySiteId(siteId);

			// Load cached sitemap data
			await loadCachedSitemap();

			// Reconnect to an active crawl if one was running before page reload
			await attemptCrawlReconnection();
		} catch (e) {
			console.error('Failed to load site:', e);
			error = e instanceof Error ? e.message : 'Failed to load site';
		} finally {
			loading = false;
		}
	}

	// Load cached sitemap — tries Supabase first, falls back to localStorage
	async function loadCachedSitemap() {
		try {
			// Clear any stale data from a previous site before loading
			sitemapStore.reset();
			sitemapStore.setSiteId(siteId);

			// Apply initial layout mode from URL BEFORE loading cache
			// so positions and layout are computed for the correct mode
			if (initialView === 'radial') {
				sitemapStore.layoutMode = 'radial';
			}
			initialView = null;

			// Load crawl data (Supabase-first, localStorage fallback)
			const cached = await crawlCacheService.load(siteId);

			if (cached && cached.nodes?.length > 0) {
				// Augment nodes with Supabase marker counts
				let nodesWithFeedback = await loadSupabaseMarkerCounts(cached.nodes);

				// Ensure server URLs are persisted to Supabase (before blob overwrite)
				crawlCacheService.save(siteId, { nodes: nodesWithFeedback, edges: cached.edges });

				// Restore screenshots from IndexedDB cache (replaces server URLs with local blobs)
				nodesWithFeedback = await restoreScreenshotsFromCache(nodesWithFeedback);

				sitemapStore.loadFromCache(nodesWithFeedback, cached.edges);

				// Overwrite with Supabase positions (shared across browsers)
				await sitemapStore.applySupabasePositions();

				// Load layout meta (lock state, last editor)
				await sitemapStore.loadLayoutMeta();
			}
		} catch (e) {
			console.error('Failed to load cached sitemap:', e);
		}
	}

	// Reconnect to an active crawl session after page reload
	async function attemptCrawlReconnection() {
		const sessionId = crawlSessionService.load(siteId);
		if (!sessionId) return;

		try {
			const resp = await apiService.getCrawlStatus(sessionId);

			// The backend response has session.status at top-level and
			// session.progress as { found, crawled, screenshotted } — which
			// differs from the frontend CrawlSession type. Cast to access
			// the actual shape.
			const session = resp.session as Record<string, any>;
			const status: string = session.status ?? session.progress?.status;

			if (status === 'complete') {
				// Crawl finished while we were away — fetch the final sitemap
				const sitemap = await apiService.getSitemap(sessionId);
				if (sitemap.nodes?.length > 0) {
					sitemapStore.loadFromCache(sitemap.nodes, sitemap.edges);
					sitemapStore.applyUrlHierarchy();
				}
				crawlSessionService.clear(siteId);
			} else if (status === 'crawling' || status === 'screenshotting') {
				// Still running — load current snapshot and reconnect socket
				const sitemap = await apiService.getSitemap(sessionId);
				if (sitemap.nodes?.length > 0) {
					sitemapStore.loadFromCache(sitemap.nodes, sitemap.edges);
				}

				const progress = session.progress ?? {};
				sitemapStore.setSessionId(sessionId);
				sitemapStore.setStatus(status as 'crawling' | 'screenshotting');
				sitemapStore.updateProgress({
					found: progress.found ?? 0,
					crawled: progress.crawled ?? 0,
					screenshotted: progress.screenshotted ?? 0,
					errors: session.errorCount ?? 0
				});

				socketService.connect(sessionId, siteId);
			} else {
				// Terminal states: 'error', 'cancelled', or unknown
				crawlSessionService.clear(siteId);
			}
		} catch {
			// Server unreachable or session gone (404) — clear stale session
			crawlSessionService.clear(siteId);
		}
	}

	// Restore screenshot URLs from IndexedDB cache
	async function restoreScreenshotsFromCache(nodes: PageNode[]): Promise<PageNode[]> {
		const updatedNodes: PageNode[] = [];

		for (const node of nodes) {
			try {
				const cachedUrls = await screenshotCache.getObjectUrl(siteId, node.data.url);
				if (cachedUrls) {
					updatedNodes.push({
						...node,
						data: {
							...node.data,
							thumbnailUrl: cachedUrls.thumbnailObjectUrl,
							screenshotStatus: 'ready' as const
						}
					});
				} else {
					updatedNodes.push(node);
				}
			} catch (e) {
				console.error('Failed to restore screenshot for', node.data.url, e);
				updatedNodes.push(node);
			}
		}

		return updatedNodes;
	}

	// Save sitemap to localStorage + Supabase (debounced)
	function saveSitemapCache() {
		const { nodes, edges } = sitemapStore.getCurrentData();
		if (nodes.length > 0) {
			crawlCacheService.save(siteId, { nodes, edges });
		}
	}

	// Fetch marker counts from Supabase
	async function loadSupabaseMarkerCounts(nodes: PageNode[]): Promise<PageNode[]> {
		try {
			const supabase = getSupabase();
			const { data: markers, error } = await supabase
				.from('markers')
				.select('page_path, status')
				.eq('site_id', siteId);

			if (error) {
				console.error('Failed to fetch markers:', error);
				return nodes;
			}

			// Group markers by page_path
			const markersByPath: Record<string, { total: number; open: number; resolved: number; archived: number }> = {};
			for (const marker of markers || []) {
				if (!markersByPath[marker.page_path]) {
					markersByPath[marker.page_path] = { total: 0, open: 0, resolved: 0, archived: 0 };
				}
				markersByPath[marker.page_path].total++;
				if (marker.status === 'open') {
					markersByPath[marker.page_path].open++;
				} else if (marker.status === 'resolved') {
					markersByPath[marker.page_path].resolved++;
				} else {
					markersByPath[marker.page_path].archived++;
				}
			}

			// Augment nodes
			return nodes.map(node => {
				try {
					const url = new URL(node.data.url);
					const pagePath = url.pathname;
					const stats = markersByPath[pagePath];
					if (stats) {
						return {
							...node,
							data: {
								...node.data,
								feedbackStats: {
									total: stats.total,
									open: stats.open,
									resolved: stats.resolved,
									archived: stats.archived,
									allResolved: stats.total > 0 && stats.open === 0
								} as FeedbackStats
							}
						};
					}
				} catch {
					// Invalid URL
				}
				return node;
			});
		} catch (e) {
			console.error('Failed to load markers:', e);
			return nodes;
		}
	}

	// Save cache when nodes change
	$effect(() => {
		if (sitemapStore.nodes.length > 0 && site) {
			saveSitemapCache();
		}
	});

	// Apply initial URL state once nodes are loaded
	$effect(() => {
		if (sitemapStore.nodes.length > 0 && initialNodeId) {
			const nodeId = initialNodeId;
			// Clear so this only runs once
			initialNodeId = null;

			const node = sitemapStore.nodes.find((n) => n.id === nodeId);
			if (node) {
				const markerId = initialMarkerId;
				initialMarkerId = null;
				sitemapStore.selectNode(nodeId);
				pageViewerStore.openViewer(
					node.data.url,
					node.data.title,
					node.data.thumbnailUrl || null,
					nodeId,
					markerId
				);
				// Set highlighted marker immediately so URL sync preserves ?marker=
				if (markerId) {
					pageViewerStore.highlightedMarkerId = markerId;
				}
			}
		}
	});

	// Sync selectedNodeId + layoutMode + marker → URL (only after router is ready)
	$effect(() => {
		const nodeId = sitemapStore.selectedNodeId;
		const layoutMode = sitemapStore.layoutMode;
		const markerId = pageViewerStore.highlightedMarkerId;

		if (!routerReady || !siteId) return;

		const path = nodeId
			? `/sites/${siteId}/map/${nodeId}`
			: `/sites/${siteId}/map`;

		const url = new URL(path, page.url.origin);
		if (layoutMode === 'radial') {
			url.searchParams.set('view', 'radial');
		}
		if (markerId && nodeId) {
			url.searchParams.set('marker', markerId);
		}

		replaceState(url, { selectedNodeId: nodeId });
	});

	function handleBeforeUnload() {
		layoutPositions.flushPendingSave();
		crawlCacheService.flushPendingSave();
	}

	onMount(() => {
		// Initialize screenshot cache and clear old entries
		screenshotCache.init().then(() => {
			screenshotCache.clearOldCache(7);
		});

		loadSite();

		window.addEventListener('beforeunload', handleBeforeUnload);

		return () => {
			window.removeEventListener('beforeunload', handleBeforeUnload);
			socketService.disconnect();
			layoutPositions.flushPendingSave();
			crawlCacheService.flushPendingSave();
			feedbackStore.destroy();
			screenshotCache.revokeAll();
			sitemapStore.reset();
		};
	});
</script>

<svelte:head>
	<title>{site?.name || 'Site'} - Map - Sitemap Presenter</title>
</svelte:head>

<div class="h-screen w-screen bg-gray-100 flex flex-col">
	<AppHeader siteName={site?.name} siteId={siteId} showNewSite={false} />

	{#if loading}
		<div class="flex-1 flex items-center justify-center">
			<svg class="w-8 h-8 animate-spin text-orange-500" fill="none" viewBox="0 0 24 24">
				<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
				<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
			</svg>
		</div>
	{:else if error}
		<div class="flex-1 flex items-center justify-center">
			<div class="bg-red-50 border border-red-200 rounded-lg p-6 text-center max-w-md">
				<p class="text-red-700 mb-4">{error}</p>
				<a href="/" class="text-orange-500 hover:text-orange-600 font-medium">Back to Dashboard</a>
			</div>
		</div>
	{:else}
		<!-- Main content -->
		<main class="flex-1 relative overflow-hidden">
			<!-- Canvas -->
			<div class="absolute inset-0">
				<SitemapCanvas {siteId} />
			</div>

			<!-- Zoom level indicator -->
			{#if hasNodes}
				<div class="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
					<div class="bg-white/80 backdrop-blur px-3 py-1 rounded-full shadow text-sm text-gray-600">
						Zoom: {Math.round(sitemapStore.zoomLevel * 100)}%
					</div>
				</div>
			{/if}
		</main>

		<!-- Page Viewer Modal -->
		<PageViewer />
	{/if}
</div>
