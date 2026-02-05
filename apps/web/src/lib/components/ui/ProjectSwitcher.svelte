<script lang="ts">
	import { projectsStore } from '$lib/stores/projects';
	import { sitemapStore } from '$lib/stores/sitemap';
	import { configStore } from '$lib/stores/config';
	import type { Project } from '$lib/types';

	const projects = projectsStore.projects;
	const currentProjectId = projectsStore.currentProjectId;

	let isOpen = $state(false);
	let showProjectInfo = $state<Project | null>(null);
	let openKebabId = $state<string | null>(null);

	let currentProject = $derived($currentProjectId ? $projects.find(p => p.id === $currentProjectId) : null);

	function toggleDropdown() {
		isOpen = !isOpen;
		openKebabId = null;
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
		openKebabId = null;
	}

	function toggleKebab(event: MouseEvent, projectId: string) {
		event.stopPropagation();
		openKebabId = openKebabId === projectId ? null : projectId;
	}

	function openProjectInfo(event: MouseEvent, project: Project) {
		event.stopPropagation();
		showProjectInfo = project;
		openKebabId = null;
		isOpen = false;
	}

	function handleDelete(project: Project) {
		if (confirm(`Delete project "${project.name}"? This cannot be undone.`)) {
			projectsStore.deleteProject(project.id);
			if ($currentProjectId === project.id) {
				sitemapStore.clearAll();
			}
		}
		showProjectInfo = null;
	}

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString('fr-FR', {
			day: 'numeric',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('[data-project-switcher]') && !target.closest('[data-project-info-modal]')) {
			isOpen = false;
			openKebabId = null;
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
		<div class="absolute right-0 top-full mt-2 w-72 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden z-50">
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
						<div
							class="relative flex items-center hover:bg-gray-50 transition-colors"
							class:bg-blue-50={$currentProjectId === project.id}
						>
							<button
								onclick={() => selectProject(project.id)}
								class="flex-1 px-4 py-3 text-left flex items-center justify-between gap-2"
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

							<!-- Kebab menu -->
							<div class="relative pr-2">
								<button
									onclick={(e) => toggleKebab(e, project.id)}
									class="p-1.5 rounded hover:bg-gray-200 transition-colors"
									title="Options"
								>
									<svg class="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
										<circle cx="12" cy="5" r="2" />
										<circle cx="12" cy="12" r="2" />
										<circle cx="12" cy="19" r="2" />
									</svg>
								</button>

								{#if openKebabId === project.id}
									<!-- svelte-ignore a11y_click_events_have_key_events -->
									<!-- svelte-ignore a11y_no_static_element_interactions -->
									<div
										class="absolute right-0 top-full mt-1 w-32 bg-white rounded-md shadow-lg border z-10"
										onclick={(e) => e.stopPropagation()}
									>
										<button
											onclick={(e) => openProjectInfo(e, project)}
											class="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
										>
											<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
											</svg>
											Details
										</button>
									</div>
								{/if}
							</div>
						</div>
					{/each}
				{/if}
			</div>
		</div>
	{/if}
</div>

<!-- Project Info Modal -->
{#if showProjectInfo}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onclick={() => (showProjectInfo = null)}>
		<div
			data-project-info-modal
			class="bg-white rounded-xl shadow-2xl w-full max-w-md p-6"
			onclick={(e) => e.stopPropagation()}
		>
			<div class="flex items-start justify-between mb-4">
				<h2 class="text-xl font-bold text-gray-800">{showProjectInfo.name}</h2>
				<button
					onclick={() => (showProjectInfo = null)}
					class="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
				>
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<div class="space-y-3 mb-6">
				<div>
					<p class="text-xs font-medium text-gray-500 uppercase mb-1">Base URL</p>
					<a
						href={showProjectInfo.baseUrl}
						target="_blank"
						rel="noopener noreferrer"
						class="text-blue-600 hover:underline break-all"
					>
						{showProjectInfo.baseUrl}
					</a>
				</div>

				{#if showProjectInfo.description}
					<div>
						<p class="text-xs font-medium text-gray-500 uppercase mb-1">Description</p>
						<p class="text-gray-700">{showProjectInfo.description}</p>
					</div>
				{/if}

				<div>
					<p class="text-xs font-medium text-gray-500 uppercase mb-1">Created</p>
					<p class="text-gray-700">{formatDate(showProjectInfo.createdAt)}</p>
				</div>

				<div>
					<p class="text-xs font-medium text-gray-500 uppercase mb-1">Last updated</p>
					<p class="text-gray-700">{formatDate(showProjectInfo.updatedAt)}</p>
				</div>

				{#if showProjectInfo.lastCrawledAt}
					<div>
						<p class="text-xs font-medium text-gray-500 uppercase mb-1">Last crawled</p>
						<p class="text-gray-700">{formatDate(showProjectInfo.lastCrawledAt)}</p>
					</div>
				{/if}

				{#if showProjectInfo.cachedData}
					<div>
						<p class="text-xs font-medium text-gray-500 uppercase mb-1">Cached data</p>
						<p class="text-gray-700">
							{showProjectInfo.cachedData.nodes.length} pages,
							{Object.values(showProjectInfo.cachedData.feedbackMarkers || {}).flat().length} feedbacks
						</p>
					</div>
				{/if}
			</div>

			<div class="flex justify-between pt-4 border-t">
				<button
					onclick={() => handleDelete(showProjectInfo!)}
					class="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2"
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
					</svg>
					Delete project
				</button>
				<button
					onclick={() => (showProjectInfo = null)}
					class="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
				>
					Close
				</button>
			</div>
		</div>
	</div>
{/if}
