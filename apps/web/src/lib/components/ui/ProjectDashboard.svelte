<script lang="ts">
	import { projectsStore } from '$lib/stores/projects.svelte';
	import { sitemapStore } from '$lib/stores/sitemap.svelte';
	import { configStore } from '$lib/stores/config.svelte';

	interface Props {
		showDashboard: boolean;
	}

	let { showDashboard = $bindable(false) }: Props = $props();

	let showCreateForm = $state(false);
	let newProjectName = $state('');
	let newProjectDescription = $state('');
	let newProjectUrl = $state('');

	function createProject() {
		if (!newProjectName.trim() || !newProjectUrl.trim()) return;

		const project = projectsStore.createProject(
			newProjectName.trim(),
			newProjectDescription.trim(),
			newProjectUrl.trim()
		);

		projectsStore.selectProject(project.id);
		configStore.setUrl(project.baseUrl);

		// Reset form
		newProjectName = '';
		newProjectDescription = '';
		newProjectUrl = '';
		showCreateForm = false;
	}

	function selectProject(id: string) {
		projectsStore.selectProject(id);
		const project = projectsStore.getProject(id);

		if (project) {
			// Set the URL in config
			configStore.setUrl(project.baseUrl);

			// Load cached data if available
			const cachedData = projectsStore.getCachedData(id);
			if (cachedData) {
				sitemapStore.loadFromCache(cachedData.nodes, cachedData.edges);
			} else {
				// Clear existing sitemap if no cache
				sitemapStore.reset();
			}
		}

		showDashboard = false;
	}

	function deleteProject(id: string, event: Event) {
		event.stopPropagation();
		if (confirm('Are you sure you want to delete this project?')) {
			projectsStore.deleteProject(id);
		}
	}

	function formatDate(date: string) {
		return new Date(date).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function closeDashboard() {
		showDashboard = false;
	}
</script>

{#if showDashboard}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4" onclick={closeDashboard}>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col" onclick={(e) => e.stopPropagation()}>
			<!-- Header -->
			<div class="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
				<h2 class="text-2xl font-bold text-gray-800">Projects Dashboard</h2>
				<button
					onclick={closeDashboard}
					class="text-gray-400 hover:text-gray-600 transition-colors"
					aria-label="Close dashboard"
					type="button"
				>
					<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
			</div>

			<!-- Content -->
			<div class="flex-1 overflow-y-auto p-6">
				<!-- Create new project button -->
				{#if !showCreateForm}
					<button
						onclick={() => (showCreateForm = true)}
						class="w-full mb-6 px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
					>
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 4v16m8-8H4"
							/>
						</svg>
						New Project
					</button>
				{/if}

				<!-- Create project form -->
				{#if showCreateForm}
					<div class="mb-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
						<h3 class="text-lg font-semibold mb-4">Create New Project</h3>
						<div class="space-y-3">
							<div>
								<label for="project-name" class="block text-sm font-medium text-gray-700 mb-1">Name</label>
								<input
									id="project-name"
									type="text"
									bind:value={newProjectName}
									placeholder="My Awesome Site"
									class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
							</div>
							<div>
								<label for="project-description" class="block text-sm font-medium text-gray-700 mb-1">Description</label>
								<input
									id="project-description"
									type="text"
									bind:value={newProjectDescription}
									placeholder="Optional description"
									class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
							</div>
							<div>
								<label for="project-url" class="block text-sm font-medium text-gray-700 mb-1">Base URL</label>
								<input
									id="project-url"
									type="url"
									bind:value={newProjectUrl}
									placeholder="https://example.com"
									class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
								/>
							</div>
							<div class="flex gap-2">
								<button
									onclick={createProject}
									class="flex-1 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
								>
									Create
								</button>
								<button
									onclick={() => (showCreateForm = false)}
									class="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
								>
									Cancel
								</button>
							</div>
						</div>
					</div>
				{/if}

				<!-- Projects list -->
				{#if projectsStore.projects.length === 0}
					<div class="text-center py-12 text-gray-400">
						<svg class="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="1.5"
								d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
							/>
						</svg>
						<p>No projects yet. Create your first project to get started!</p>
					</div>
				{:else}
					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						{#each projectsStore.projects as project (project.id)}
							<div
								class="bg-white border-2 rounded-lg p-4 hover:shadow-md transition-shadow relative"
								class:border-blue-500={projectsStore.currentProjectId === project.id}
								class:border-gray-200={projectsStore.currentProjectId !== project.id}
							>
								<button
									onclick={() => selectProject(project.id)}
									class="w-full text-left"
									type="button"
									aria-label={`Select project ${project.name}`}
								>
									<div class="flex items-start justify-between mb-2">
										<h3 class="font-semibold text-lg text-gray-800 pr-8">{project.name}</h3>
									</div>

									{#if project.description}
										<p class="text-sm text-gray-600 mb-3">{project.description}</p>
									{/if}

									<div class="space-y-1 text-sm">
										<div class="text-blue-600 truncate" title={project.baseUrl}>
											{project.baseUrl}
										</div>
										<div class="text-gray-500">
											Created: {formatDate(project.createdAt)}
										</div>
										{#if project.lastCrawledAt}
											<div class="flex items-center gap-1 text-green-600">
												<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M5 13l4 4L19 7"
													/>
												</svg>
												Cached: {formatDate(project.lastCrawledAt)}
											</div>
										{/if}
										{#if project.cachedData}
											<div class="text-gray-600">
												{project.cachedData.nodes.length} pages cached
											</div>
										{/if}
									</div>

									{#if projectsStore.currentProjectId === project.id}
										<div class="mt-3 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded text-center">
											Currently Active
										</div>
									{/if}
								</button>

								<!-- Delete button positioned absolutely -->
								<button
									onclick={(e) => deleteProject(project.id, e)}
									class="absolute top-4 right-4 text-red-400 hover:text-red-600 transition-colors"
									title="Delete project"
									aria-label={`Delete project ${project.name}`}
									type="button"
								>
									<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
										/>
									</svg>
								</button>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
