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

	const CONFIG_PANEL_KEY = 'sitemap-presenter-config-panel';

	const nodes = sitemapStore.nodes;
	const zoomLevel = sitemapStore.zoomLevel;
	const currentProjectId = projectsStore.currentProjectId;
	const projects = projectsStore.projects;

	let hasNodes = $derived($nodes.length > 0);
	let showDashboard = $state(false);
	let showConfig = $state(true);
	let showNewProjectModal = $state(false);
	let newProjectName = $state('');
	let newProjectDescription = $state('');
	let newProjectBaseUrl = $state('');

	// Compute current project directly from $projects for full reactivity
	let currentProject = $derived.by(() => {
		if (!$currentProjectId) return null;
		return $projects.find(p => p.id === $currentProjectId) ?? null;
	});

	// Count feedbacks for current project (open vs resolved)
	let feedbackCounts = $derived.by(() => {
		if (!$currentProjectId) return { open: 0, resolved: 0 };
		const project = $projects.find(p => p.id === $currentProjectId);
		if (!project?.cachedData?.feedbackMarkers) return { open: 0, resolved: 0 };
		const allMarkers = Object.values(project.cachedData.feedbackMarkers).flat();
		return {
			open: allMarkers.filter(m => m.status === 'open').length,
			resolved: allMarkers.filter(m => m.status === 'resolved').length
		};
	});

	// Debug: track when projects/feedbacks change
	$effect(() => {
		const projectId = $currentProjectId;
		const allProjects = $projects;
		const project = projectId ? allProjects.find(p => p.id === projectId) : null;
		if (project) {
			const markers = project.cachedData?.feedbackMarkers;
			const count = markers ? Object.values(markers).flat().length : 0;
			console.log(`[+page] Current project "${project.name}" has ${count} feedback markers, projects.length=${allProjects.length}`);
		} else {
			console.log(`[+page] No current project. projectId=${projectId}, projects.length=${allProjects.length}`);
		}
	});

	function toggleDashboard() {
		showDashboard = !showDashboard;
	}

	function toggleConfig() {
		showConfig = !showConfig;
		try {
			localStorage.setItem(CONFIG_PANEL_KEY, JSON.stringify(showConfig));
		} catch (e) {
			console.error('Failed to save config panel state:', e);
		}
	}

	function handleCreateProject() {
		if (!newProjectName.trim() || !newProjectBaseUrl.trim()) return;

		const project = projectsStore.createProject(
			newProjectName.trim(),
			newProjectDescription.trim(),
			newProjectBaseUrl.trim()
		);
		projectsStore.selectProject(project.id);
		sitemapStore.clearAll();

		// Reset form
		newProjectName = '';
		newProjectDescription = '';
		newProjectBaseUrl = '';
		showNewProjectModal = false;
	}

	onMount(() => {
		projectsStore.initialize();

		// Load config panel state
		try {
			const savedConfig = localStorage.getItem(CONFIG_PANEL_KEY);
			if (savedConfig !== null) {
				showConfig = JSON.parse(savedConfig);
			}
		} catch (e) {
			console.error('Failed to load config panel state:', e);
		}

		// Load cached data for restored project after a tick
		setTimeout(() => {
			if ($currentProjectId && $nodes.length === 0) {
				const cachedData = projectsStore.getCachedData($currentProjectId);
				if (cachedData) {
					// Augment nodes with feedback stats before loading
					const feedbackMarkers = cachedData.feedbackMarkers || {};
					const nodesWithFeedback = cachedData.nodes.map(node => {
						try {
							const url = new URL(node.data.url);
							const pagePath = url.pathname;
							const markers = feedbackMarkers[pagePath] || [];
							const open = markers.filter(m => m.status === 'open').length;
							const resolved = markers.filter(m => m.status === 'resolved').length;
							return {
								...node,
								data: {
									...node.data,
									feedbackStats: {
										total: markers.length,
										open,
										resolved,
										allResolved: markers.length > 0 && open === 0
									}
								}
							};
						} catch {
							return node;
						}
					});

					sitemapStore.loadFromCache(nodesWithFeedback, cachedData.edges);

					// Log feedback markers loaded from cache
					const totalMarkers = Object.values(feedbackMarkers).flat().length;
					const pagesWithFeedback = Object.keys(feedbackMarkers).length;
					console.log(`[Sitemap] Loaded ${totalMarkers} feedback markers across ${pagesWithFeedback} pages`);
				}
			}
		}, 0);
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
	<header class="bg-white border-b border-gray-200 px-4 py-3 flex items-center z-10">
		<!-- Left: Title + badges -->
		<div class="flex items-center gap-4 flex-1">
			<h1 class="text-xl font-bold text-gray-800">
				{#if currentProject}
					{currentProject.name}
				{:else}
					Sitemap Presenter
				{/if}
			</h1>

			{#if hasNodes && currentProject && (feedbackCounts.open > 0 || feedbackCounts.resolved > 0)}
				<div class="flex items-center gap-2">
					{#if feedbackCounts.open > 0}
						<span class="px-2 py-1 bg-orange-100 text-orange-700 rounded text-sm font-medium">
							{feedbackCounts.open} open
						</span>
					{/if}
					{#if feedbackCounts.resolved > 0}
						<span class="px-2 py-1 bg-green-100 text-green-700 rounded text-sm font-medium">
							{feedbackCounts.resolved} resolved
						</span>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Center: Search -->
		{#if hasNodes}
			<div class="flex-1 flex justify-center">
				<SearchBar />
			</div>
		{:else}
			<div class="flex-1"></div>
		{/if}

		<!-- Right: New project button + Dropdown -->
		<div class="flex items-center gap-3 flex-1 justify-end">
			<button
				onclick={() => (showNewProjectModal = true)}
				class="flex items-center gap-2 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
			>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
				</svg>
				New project
			</button>
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

	<!-- New Project Modal -->
	{#if showNewProjectModal}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onclick={() => (showNewProjectModal = false)}>
			<div class="bg-white rounded-xl shadow-2xl w-full max-w-md p-6" onclick={(e) => e.stopPropagation()}>
				<h2 class="text-xl font-bold text-gray-800 mb-4">New Project</h2>
				<form onsubmit={(e) => { e.preventDefault(); handleCreateProject(); }}>
					<div class="space-y-4">
						<div>
							<label for="project-name" class="block text-sm font-medium text-gray-700 mb-1">Project name *</label>
							<input
								id="project-name"
								type="text"
								bind:value={newProjectName}
								placeholder="My Website"
								class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
								required
							/>
						</div>
						<div>
							<label for="project-url" class="block text-sm font-medium text-gray-700 mb-1">Base URL *</label>
							<input
								id="project-url"
								type="url"
								bind:value={newProjectBaseUrl}
								placeholder="https://example.com"
								class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
								required
							/>
						</div>
						<div>
							<label for="project-description" class="block text-sm font-medium text-gray-700 mb-1">Description</label>
							<textarea
								id="project-description"
								bind:value={newProjectDescription}
								placeholder="Optional description..."
								rows="2"
								class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
							></textarea>
						</div>
					</div>
					<div class="flex justify-end gap-3 mt-6">
						<button
							type="button"
							onclick={() => (showNewProjectModal = false)}
							class="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={!newProjectName.trim() || !newProjectBaseUrl.trim()}
							class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
						>
							Create
						</button>
					</div>
				</form>
			</div>
		</div>
	{/if}
</div>
