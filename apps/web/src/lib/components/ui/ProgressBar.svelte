<script lang="ts">
	import { sitemapStore } from '$lib/stores/sitemap.svelte';

	let statusText = $derived(
		sitemapStore.progress.status === 'idle'
			? 'Ready'
			: sitemapStore.progress.status === 'crawling'
				? 'Crawling pages...'
				: sitemapStore.progress.status === 'screenshotting'
					? 'Generating screenshots...'
					: sitemapStore.progress.status === 'complete'
						? 'Complete!'
						: sitemapStore.progress.status === 'error'
							? 'Error'
							: ''
	);

	let statusColor = $derived(
		sitemapStore.progress.status === 'complete'
			? 'text-green-600'
			: sitemapStore.progress.status === 'error'
				? 'text-red-600'
				: 'text-blue-600'
	);

	let isActive = $derived(
		sitemapStore.progress.status === 'crawling' || sitemapStore.progress.status === 'screenshotting'
	);

	let crawlPercent = $derived(
		sitemapStore.progress.found > 0 ? Math.round((sitemapStore.progress.crawled / sitemapStore.progress.found) * 100) : 0
	);

	let screenshotPercent = $derived(
		sitemapStore.progress.crawled > 0 ? Math.round((sitemapStore.progress.screenshotted / sitemapStore.progress.crawled) * 100) : 0
	);
</script>

{#if sitemapStore.progress.status !== 'idle'}
	<div class="bg-white rounded-lg shadow-lg p-4 w-80">
		<div class="flex items-center justify-between mb-3">
			<h3 class="text-sm font-medium text-gray-700">Progress</h3>
			<span class="text-sm font-medium {statusColor}">
				{#if isActive}
					<span class="inline-flex items-center gap-1">
						<svg class="animate-spin h-3 w-3" viewBox="0 0 24 24">
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
						{statusText}
					</span>
				{:else}
					{statusText}
				{/if}
			</span>
		</div>

		<!-- Stats grid -->
		<div class="grid grid-cols-2 gap-3 mb-4">
			<div class="bg-gray-50 rounded-md p-2">
				<p class="text-xs text-gray-500">Pages Found</p>
				<p class="text-lg font-semibold text-gray-800">{sitemapStore.progress.found}</p>
			</div>
			<div class="bg-gray-50 rounded-md p-2">
				<p class="text-xs text-gray-500">Crawled</p>
				<p class="text-lg font-semibold text-gray-800">{sitemapStore.progress.crawled}</p>
			</div>
			<div class="bg-gray-50 rounded-md p-2">
				<p class="text-xs text-gray-500">Screenshots</p>
				<p class="text-lg font-semibold text-gray-800">{sitemapStore.progress.screenshotted}</p>
			</div>
			<div class="bg-gray-50 rounded-md p-2">
				<p class="text-xs text-gray-500">Errors</p>
				<p class="text-lg font-semibold {sitemapStore.progress.errors > 0 ? 'text-red-600' : 'text-gray-800'}">
					{sitemapStore.progress.errors}
				</p>
			</div>
		</div>

		<!-- Progress bars -->
		<div class="space-y-3">
			<!-- Crawl progress -->
			<div>
				<div class="flex justify-between text-xs text-gray-500 mb-1">
					<span>Crawl Progress</span>
					<span>{crawlPercent}%</span>
				</div>
				<div class="w-full bg-gray-200 rounded-full h-2">
					<div
						class="bg-blue-500 h-2 rounded-full transition-all duration-300"
						style="width: {crawlPercent}%"
					></div>
				</div>
			</div>

			<!-- Screenshot progress -->
			<div>
				<div class="flex justify-between text-xs text-gray-500 mb-1">
					<span>Screenshot Progress</span>
					<span>{screenshotPercent}%</span>
				</div>
				<div class="w-full bg-gray-200 rounded-full h-2">
					<div
						class="bg-green-500 h-2 rounded-full transition-all duration-300"
						style="width: {screenshotPercent}%"
					></div>
				</div>
			</div>
		</div>
	</div>
{/if}
