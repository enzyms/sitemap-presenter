<script lang="ts">
	import SitemapCanvas from '$lib/components/canvas/SitemapCanvas.svelte';
	import ConfigPanel from '$lib/components/ui/ConfigPanel.svelte';
	import ProgressBar from '$lib/components/ui/ProgressBar.svelte';
	import SearchBar from '$lib/components/ui/SearchBar.svelte';
	import ProjectDashboard from '$lib/components/ui/ProjectDashboard.svelte';
	import ProjectSwitcher from '$lib/components/ui/ProjectSwitcher.svelte';
	import PageViewer from '$lib/components/viewer/PageViewer.svelte';
	import { sitemapStore } from '$lib/stores/sitemap';
	import { projectsStore } from '$lib/stores/projects';
	import { onMount } from 'svelte';

	const nodes = sitemapStore.nodes;
	const zoomLevel = sitemapStore.zoomLevel;
	const currentProjectId = projectsStore.currentProjectId;
	const projects = projectsStore.projects;

	let hasNodes = $derived($nodes.length > 0);
	let currentProject = $derived($currentProjectId ? projectsStore.getProject($currentProjectId) : null);
	let showDashboard = $state(false);
	let showConfig = $state(true);

	// Count total feedbacks for current project
	let totalFeedbacks = $derived.by(() => {
		if (!currentProject?.cachedData?.feedbackMarkers) return 0;
		return Object.values(currentProject.cachedData.feedbackMarkers).reduce(
			(sum, markers) => sum + markers.length,
			0
		);
	});

	function toggleDashboard() {
		showDashboard = !showDashboard;
	}

	function toggleConfig() {
		showConfig = !showConfig;
	}

	onMount(() => {
		projectsStore.initialize();
	});
</script>

<svelte:head>
	<title>{currentProject ? `Feedbacks - ${currentProject.name}` : 'Sitemap Presenter'}</title>
	<meta name="description" content="Interactive sitemap visualization tool" />
</svelte:head>

<div class="h-screen w-screen bg-gray-100 flex flex-col">
	<!-- Project Dashboard Modal -->
	<ProjectDashboard bind:showDashboard />

	<!-- Header -->
	<header class="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between z-10">
		<div class="flex items-center gap-4">
			<!-- Burger menu -->
			<button
				onclick={toggleDashboard}
				class="p-2 rounded-lg hover:bg-gray-100 transition-colors"
				title="Projects Dashboard"
			>
				<svg class="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M4 6h16M4 12h16M4 18h16"
					/>
				</svg>
			</button>

			<!-- Title -->
			<h1 class="text-xl font-bold text-gray-800">
				{#if currentProject}
					Feedbacks for {currentProject.name}
				{:else}
					Sitemap Presenter
				{/if}
			</h1>

			{#if hasNodes}
				<SearchBar />
			{/if}
		</div>

		<div class="flex items-center gap-3">
			{#if hasNodes && currentProject && totalFeedbacks > 0}
				<span class="px-2 py-1 bg-orange-100 text-orange-700 rounded text-sm font-medium">
					{totalFeedbacks} feedbacks
				</span>
			{/if}
			<ProjectSwitcher />
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

		<!-- Left sidebar - Config panel (togglable) -->
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
					Config and crawling
				</button>
			{/if}
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
