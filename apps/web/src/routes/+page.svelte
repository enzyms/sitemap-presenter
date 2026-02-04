<script lang="ts">
	import SitemapCanvas from '$lib/components/canvas/SitemapCanvas.svelte';
	import ConfigPanel from '$lib/components/ui/ConfigPanel.svelte';
	import ProgressBar from '$lib/components/ui/ProgressBar.svelte';
	import SearchBar from '$lib/components/ui/SearchBar.svelte';
	import ProjectDashboard from '$lib/components/ui/ProjectDashboard.svelte';
	import PageViewer from '$lib/components/viewer/PageViewer.svelte';
	import { sitemapStore } from '$lib/stores/sitemap';

	const nodes = sitemapStore.nodes;
	const zoomLevel = sitemapStore.zoomLevel;

	let hasNodes = $derived($nodes.length > 0);
</script>

<svelte:head>
	<title>Sitemap Presenter</title>
	<meta name="description" content="Interactive sitemap visualization tool" />
</svelte:head>

<div class="h-screen w-screen bg-gray-100 flex flex-col">
	<!-- Project Dashboard -->
	<ProjectDashboard />

	<!-- Header -->
	<header class="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between z-10">
		<div class="flex items-center gap-4">
			<h1 class="text-xl font-bold text-gray-800">Sitemap Presenter</h1>
			{#if hasNodes}
				<SearchBar />
			{/if}
		</div>
		<div class="flex items-center gap-2 text-sm text-gray-500">
			{#if hasNodes}
				<span class="px-2 py-1 bg-gray-100 rounded">
					{$nodes.length} pages
				</span>
			{/if}
		</div>
	</header>

	<!-- Main content -->
	<main class="flex-1 relative overflow-hidden">
		<!-- Canvas -->
		<div class="absolute inset-0">
			{#if hasNodes}
				<SitemapCanvas />
			{:else}
				<!-- Empty state -->
				<div class="w-full h-full flex items-center justify-center bg-gray-50">
					<div class="text-center">
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
						<h2 class="text-xl font-medium text-gray-600 mb-2">No sitemap loaded</h2>
						<p class="text-gray-400">Enter a URL in the panel to start crawling</p>
					</div>
				</div>
			{/if}
		</div>

		<!-- Left sidebar - Config panel -->
		<div class="absolute top-4 left-4 z-10 space-y-4">
			<ConfigPanel />
			<ProgressBar />
		</div>

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
</div>
