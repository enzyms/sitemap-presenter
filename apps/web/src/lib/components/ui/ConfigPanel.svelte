<script lang="ts">
	import { configStore } from '$lib/stores/config';
	import { sitemapStore } from '$lib/stores/sitemap';
	import { projectsStore } from '$lib/stores/projects';
	import { apiService } from '$lib/services/api';
	import { socketService } from '$lib/services/socket';

	interface Props {
		onClose?: () => void;
	}

	let { onClose }: Props = $props();

	const config = configStore;
	const progress = sitemapStore.progress;
	const currentProjectId = projectsStore.currentProjectId;

	let isLoading = $state(false);
	let error = $state('');

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

	async function handleSubmit(event: Event) {
		event.preventDefault();
		error = '';

		// Validate URL
		try {
			new URL($config.url);
		} catch {
			error = 'Please enter a valid URL';
			return;
		}

		isLoading = true;
		sitemapStore.reset();

		try {
			const response = await apiService.startCrawl($config);
			sitemapStore.setSessionId(response.sessionId);
			sitemapStore.setStatus('crawling');
			socketService.connect(response.sessionId);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to start crawl';
			sitemapStore.setStatus('error');
		} finally {
			isLoading = false;
		}
	}

	async function handleCancel() {
		if ($progress.sessionId) {
			try {
				await apiService.cancelCrawl($progress.sessionId);
				socketService.disconnect();
				sitemapStore.setStatus('idle');
			} catch (err) {
				console.error('Failed to cancel crawl:', err);
			}
		}
	}

	function loadCachedData() {
		if ($currentProjectId) {
			const cachedData = projectsStore.getCachedData($currentProjectId);
			if (cachedData) {
				sitemapStore.loadFromCache(cachedData.nodes, cachedData.edges);
			}
		}
	}

	let isCrawling = $derived($progress.status === 'crawling' || $progress.status === 'screenshotting');
	let currentProject = $derived($currentProjectId ? projectsStore.getProject($currentProjectId) : null);
	let hasCachedData = $derived(currentProject?.cachedData ? true : false);
</script>

<div class="bg-white rounded-lg shadow-lg w-80 overflow-hidden">
	<!-- Header -->
	<div class="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
		<h2 class="text-lg font-semibold text-gray-800">Config and crawling</h2>
		{#if onClose}
			<button
				onclick={onClose}
				class="p-1 rounded hover:bg-gray-200 transition-colors text-gray-500 hover:text-gray-700"
				title="Close panel"
			>
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		{/if}
	</div>

	<div class="p-4">
		<!-- Current Project Info -->
		{#if currentProject}
			<div class="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
				<div class="flex items-center justify-between mb-1">
					<span class="text-xs font-medium text-blue-700">Current Project</span>
					{#if hasCachedData}
						<button
							onclick={loadCachedData}
							class="text-xs text-blue-600 hover:text-blue-800 underline"
							title="Reload cached data"
						>
							Load Cache
						</button>
					{/if}
				</div>
				<p class="text-sm font-semibold text-blue-900">{currentProject.name}</p>
				{#if hasCachedData}
					<p class="text-xs text-blue-600 mt-1">
						{currentProject.cachedData?.nodes.length || 0} pages cached
					</p>
				{/if}
			</div>
		{/if}

		<form onsubmit={handleSubmit} class="space-y-4">
			<!-- URL Input -->
			<div>
				<label for="url" class="block text-sm font-medium text-gray-700 mb-1">
					Website URL
				</label>
				<input
					type="url"
					id="url"
					value={$config.url}
					oninput={handleUrlChange}
					placeholder="https://example.com"
					class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
					disabled={isCrawling}
					required
				/>
			</div>

			<!-- Max Depth -->
			<div>
				<label for="maxDepth" class="block text-sm font-medium text-gray-700 mb-1">
					Max Depth: {$config.maxDepth}
				</label>
				<input
					type="range"
					id="maxDepth"
					value={$config.maxDepth}
					oninput={handleMaxDepthChange}
					min="1"
					max="5"
					class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
					disabled={isCrawling}
				/>
				<div class="flex justify-between text-xs text-gray-500 mt-1">
					<span>1</span>
					<span>2</span>
					<span>3</span>
					<span>4</span>
					<span>5</span>
				</div>
			</div>

			<!-- Max Pages -->
			<div>
				<label for="maxPages" class="block text-sm font-medium text-gray-700 mb-1">
					Max Pages: {$config.maxPages}
				</label>
				<input
					type="range"
					id="maxPages"
					value={$config.maxPages}
					oninput={handleMaxPagesChange}
					min="3"
					max="500"
					step="1"
					class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
					disabled={isCrawling}
				/>
				<div class="flex justify-between text-xs text-gray-500 mt-1">
					<span>3</span>
					<span>50</span>
					<span>250</span>
					<span>500</span>
				</div>
			</div>

			<!-- Error message -->
			{#if error}
				<div class="p-3 bg-red-50 border border-red-200 rounded-md">
					<p class="text-sm text-red-600">{error}</p>
				</div>
			{/if}

			<!-- Submit / Cancel buttons -->
			<div class="flex gap-2">
				{#if isCrawling}
					<button
						type="button"
						onclick={handleCancel}
						class="flex-1 px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
					>
						Cancel
					</button>
				{:else}
					<button
						type="submit"
						disabled={isLoading || !$config.url}
						class="flex-1 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
					>
						{#if isLoading}
							<span class="flex items-center justify-center gap-2">
								<svg class="animate-spin h-4 w-4" viewBox="0 0 24 24">
									<circle
										class="opacity-25"
										cx="12"
										cy="12"
										r="10"
										stroke="currentColor"
										stroke-width="4"
										fill="none"
									/>
									<path
										class="opacity-75"
										fill="currentColor"
										d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
									/>
								</svg>
								Starting...
							</span>
						{:else}
							Start Crawl
						{/if}
					</button>
				{/if}
			</div>
		</form>
	</div>
</div>
