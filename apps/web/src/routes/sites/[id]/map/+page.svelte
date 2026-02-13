<script lang="ts">
	import { page } from '$app/stores';
	import { onMount, onDestroy } from 'svelte';
	import AppHeader from '$lib/components/ui/AppHeader.svelte';
	import SitemapCanvas from '$lib/components/canvas/SitemapCanvas.svelte';
	import ConfigPanel from '$lib/components/ui/ConfigPanel.svelte';
	import ProgressBar from '$lib/components/ui/ProgressBar.svelte';
	import SearchBar from '$lib/components/ui/SearchBar.svelte';
	import PageViewer from '$lib/components/viewer/PageViewer.svelte';
	import { sitemapStore } from '$lib/stores/sitemap';
	import { configStore } from '$lib/stores/config';
	import { feedbackStore } from '$lib/stores/feedback';
	import { getSupabase, type Site } from '$lib/services/supabase';
	import type { PageNode, FeedbackStats } from '$lib/types';

	const CONFIG_PANEL_KEY = 'sitemap-presenter-config-panel';
	const SITEMAP_CACHE_PREFIX = 'sitemap-cache-';

	let siteId = $derived($page.params.id);
	let site = $state<Site | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);

	const nodes = sitemapStore.nodes;
	const zoomLevel = sitemapStore.zoomLevel;

	let hasNodes = $derived($nodes.length > 0);
	let showConfig = $state(true);

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

			// Prefill config with site's domain
			if (site?.domain) {
				const url = site.domain.startsWith('http') ? site.domain : `https://${site.domain}`;
				configStore.setUrl(url);
			}

			// Initialize feedback store for this site
			await feedbackStore.initializeBySiteId(siteId);

			// Load cached sitemap data
			loadCachedSitemap();
		} catch (e) {
			console.error('Failed to load site:', e);
			error = e instanceof Error ? e.message : 'Failed to load site';
		} finally {
			loading = false;
		}
	}

	// Load cached sitemap from localStorage
	function loadCachedSitemap() {
		try {
			const cached = localStorage.getItem(`${SITEMAP_CACHE_PREFIX}${siteId}`);
			if (cached) {
				const data = JSON.parse(cached);
				if (data.nodes && data.edges) {
					// Augment nodes with Supabase marker counts
					loadSupabaseMarkerCounts(data.nodes).then(nodesWithFeedback => {
						sitemapStore.loadFromCache(nodesWithFeedback, data.edges);
					});
				}
			}
		} catch (e) {
			console.error('Failed to load cached sitemap:', e);
		}
	}

	// Save sitemap to localStorage
	function saveSitemapCache() {
		try {
			const { nodes, edges } = sitemapStore.getCurrentData();
			if (nodes.length > 0) {
				localStorage.setItem(`${SITEMAP_CACHE_PREFIX}${siteId}`, JSON.stringify({ nodes, edges }));
			}
		} catch (e) {
			console.error('Failed to save sitemap cache:', e);
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
			const markersByPath: Record<string, { total: number; open: number; resolved: number }> = {};
			for (const marker of markers || []) {
				if (!markersByPath[marker.page_path]) {
					markersByPath[marker.page_path] = { total: 0, open: 0, resolved: 0 };
				}
				markersByPath[marker.page_path].total++;
				if (marker.status === 'open') {
					markersByPath[marker.page_path].open++;
				} else {
					markersByPath[marker.page_path].resolved++;
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

	function toggleConfig() {
		showConfig = !showConfig;
		try {
			localStorage.setItem(CONFIG_PANEL_KEY, JSON.stringify(showConfig));
		} catch (e) {
			console.error('Failed to save config panel state:', e);
		}
	}

	// Save cache when nodes change
	$effect(() => {
		if ($nodes.length > 0 && site) {
			saveSitemapCache();
		}
	});

	onMount(() => {
		// Load config panel state
		try {
			const savedConfig = localStorage.getItem(CONFIG_PANEL_KEY);
			if (savedConfig !== null) {
				showConfig = JSON.parse(savedConfig);
			}
		} catch (e) {
			console.error('Failed to load config panel state:', e);
		}

		loadSite();

		return () => {
			feedbackStore.destroy();
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
				{#if hasNodes}
					<SitemapCanvas />
				{:else}
					<!-- Empty state -->
					<div class="w-full h-full flex items-center justify-center bg-gray-50">
						<div class="text-center max-w-md">
							<svg
								class="w-24 h-24 mx-auto text-gray-300 mb-4"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="1.5"
									d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
								/>
							</svg>
							<h2 class="text-xl font-medium text-gray-600 mb-2">No sitemap yet</h2>
							<p class="text-gray-400 mb-4">Use the crawl panel to map your website</p>
							{#if !showConfig}
								<button
									onclick={toggleConfig}
									class="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
								>
									Open Crawl Panel
								</button>
							{/if}
						</div>
					</div>
				{/if}
			</div>

			<!-- Left sidebar - Config panel -->
			<div class="absolute top-4 left-4 z-10 space-y-4">
				{#if showConfig}
					<div class="transform transition-all duration-300 ease-out origin-top">
						<ConfigPanel onClose={toggleConfig} />
					</div>
				{:else}
					<button
						onclick={toggleConfig}
						class="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-lg hover:shadow-xl transition-shadow border border-gray-200 text-sm font-medium text-gray-700"
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
						</svg>
						Crawl Settings
					</button>
				{/if}
				<ProgressBar />
			</div>

			<!-- Top right - Search bar -->
			{#if hasNodes}
				<div class="absolute top-4 right-4 z-10">
					<SearchBar />
				</div>
			{/if}

			<!-- Zoom level indicator -->
			{#if hasNodes}
				<div class="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
					<div class="bg-white/80 backdrop-blur px-3 py-1 rounded-full shadow text-sm text-gray-600">
						Zoom: {Math.round($zoomLevel * 100)}%
					</div>
				</div>
			{/if}
		</main>

		<!-- Page Viewer Modal -->
		<PageViewer />
	{/if}
</div>
