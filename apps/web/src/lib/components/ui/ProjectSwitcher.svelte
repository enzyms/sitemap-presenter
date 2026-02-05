<script lang="ts">
	import { projectsStore } from '$lib/stores/projects';
	import { sitemapStore } from '$lib/stores/sitemap';
	import { configStore } from '$lib/stores/config';

	const projects = projectsStore.projects;
	const currentProjectId = projectsStore.currentProjectId;

	let isOpen = $state(false);

	let currentProject = $derived($currentProjectId ? $projects.find(p => p.id === $currentProjectId) : null);

	function toggleDropdown() {
		isOpen = !isOpen;
	}

	function selectProject(id: string) {
		projectsStore.selectProject(id);
		const project = projectsStore.getProject(id);

		if (project) {
			configStore.setUrl(project.baseUrl);

			const cachedData = projectsStore.getCachedData(id);
			if (cachedData) {
				sitemapStore.loadFromCache(cachedData.nodes, cachedData.edges);
			} else {
				sitemapStore.reset();
			}
		}

		isOpen = false;
	}

	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('[data-project-switcher]')) {
			isOpen = false;
		}
	}
</script>

<svelte:window onclick={handleClickOutside} />

<div class="relative" data-project-switcher>
	<button
		onclick={toggleDropdown}
		class="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-sm"
	>
		<svg class="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
		</svg>
		<span class="font-medium text-gray-700 max-w-32 truncate">
			{currentProject?.name || 'Select project'}
		</span>
		<svg class="w-4 h-4 text-gray-500 transition-transform" class:rotate-180={isOpen} fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
		</svg>
	</button>

	{#if isOpen}
		<div class="absolute right-0 top-full mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden z-50">
			<div class="p-2 border-b border-gray-100">
				<p class="text-xs font-medium text-gray-500 uppercase px-2">Switch Project</p>
			</div>
			<div class="max-h-64 overflow-y-auto">
				{#if $projects.length === 0}
					<div class="p-4 text-center text-gray-400 text-sm">
						No projects yet
					</div>
				{:else}
					{#each $projects as project (project.id)}
						<button
							onclick={() => selectProject(project.id)}
							class="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors flex items-center justify-between gap-2"
							class:bg-blue-50={$currentProjectId === project.id}
						>
							<div class="min-w-0">
								<p class="font-medium text-gray-800 truncate">{project.name}</p>
								<p class="text-xs text-gray-500 truncate">{project.baseUrl}</p>
							</div>
							{#if $currentProjectId === project.id}
								<svg class="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
								</svg>
							{/if}
						</button>
					{/each}
				{/if}
			</div>
		</div>
	{/if}
</div>
