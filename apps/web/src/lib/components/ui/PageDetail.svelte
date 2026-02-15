<script lang="ts">
	import { sitemapStore } from '$lib/stores/sitemap.svelte';
	import { pageViewerStore } from '$lib/stores/pageViewer.svelte';

	function handleClose() {
		sitemapStore.selectNode(null);
	}

	function handleOpenUrl() {
		if (sitemapStore.selectedNode?.data.url) {
			window.open(sitemapStore.selectedNode.data.url, '_blank');
		}
	}

	function handleOpenViewer() {
		if (sitemapStore.selectedNode) {
			pageViewerStore.openViewer(
				sitemapStore.selectedNode.data.url,
				sitemapStore.selectedNode.data.title,
				sitemapStore.selectedNode.data.thumbnailUrl || null
			);
		}
	}
</script>

{#if sitemapStore.selectedNode}
	<div class="bg-white rounded-lg shadow-lg w-80 max-h-[calc(100vh-200px)] flex flex-col">
		<!-- Header -->
		<div class="flex items-center justify-between p-4 border-b">
			<h3 class="text-sm font-medium text-gray-700">Page Details</h3>
			<button
				onclick={handleClose}
				aria-label="Close panel"
				class="text-gray-400 hover:text-gray-600 transition-colors"
			>
				<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		</div>

		<!-- Content -->
		<div class="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
			<!-- Screenshot preview -->
			{#if sitemapStore.selectedNode.data.thumbnailUrl}
				<div class="rounded-md overflow-hidden border">
					<img
						src={sitemapStore.selectedNode.data.thumbnailUrl}
						alt={sitemapStore.selectedNode.data.title}
						class="w-full h-auto"
					/>
				</div>
			{/if}

			<!-- Title -->
			<div>
				<span class="block text-xs text-gray-500 mb-1">Title</span>
				<p class="text-sm font-medium text-gray-800">{sitemapStore.selectedNode.data.title}</p>
			</div>

			<!-- URL -->
			<div>
				<span class="block text-xs text-gray-500 mb-1">URL</span>
				<a
					href={sitemapStore.selectedNode.data.url}
					target="_blank"
					rel="noopener noreferrer"
					class="text-sm text-blue-600 hover:underline break-all"
				>
					{sitemapStore.selectedNode.data.url}
				</a>
			</div>

			<!-- Depth -->
			<div>
				<span class="block text-xs text-gray-500 mb-1">Depth Level</span>
				<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
					Level {sitemapStore.selectedNode.data.depth}
				</span>
			</div>

			<!-- Screenshot Status -->
			<div>
				<span class="block text-xs text-gray-500 mb-1">Screenshot Status</span>
				<span
					class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
					class:bg-green-100={sitemapStore.selectedNode.data.screenshotStatus === 'ready'}
					class:text-green-800={sitemapStore.selectedNode.data.screenshotStatus === 'ready'}
					class:bg-yellow-100={sitemapStore.selectedNode.data.screenshotStatus === 'processing'}
					class:text-yellow-800={sitemapStore.selectedNode.data.screenshotStatus === 'processing'}
					class:bg-gray-100={sitemapStore.selectedNode.data.screenshotStatus === 'pending'}
					class:text-gray-800={sitemapStore.selectedNode.data.screenshotStatus === 'pending'}
					class:bg-red-100={sitemapStore.selectedNode.data.screenshotStatus === 'error'}
					class:text-red-800={sitemapStore.selectedNode.data.screenshotStatus === 'error'}
				>
					{sitemapStore.selectedNode.data.screenshotStatus}
				</span>
			</div>

			<!-- Links stats -->
			<div class="grid grid-cols-2 gap-3">
				<div class="bg-gray-50 rounded-md p-3">
					<p class="text-xs text-gray-500">Internal Links</p>
					<p class="text-lg font-semibold text-blue-600">
						{sitemapStore.selectedNode.data.internalLinks.length}
					</p>
				</div>
				<div class="bg-gray-50 rounded-md p-3">
					<p class="text-xs text-gray-500">External Links</p>
					<p class="text-lg font-semibold text-purple-600">
						{sitemapStore.selectedNode.data.externalLinks.length}
					</p>
				</div>
			</div>

			<!-- Internal links list -->
			{#if sitemapStore.selectedNode.data.internalLinks.length > 0}
				<div>
					<span class="block text-xs text-gray-500 mb-2">Internal Links</span>
					<div class="max-h-40 overflow-y-auto custom-scrollbar space-y-1">
						{#each sitemapStore.selectedNode.data.internalLinks.slice(0, 10) as link}
							<a
								href={link}
								target="_blank"
								rel="noopener noreferrer"
								class="block text-xs text-blue-600 hover:underline truncate"
							>
								{link}
							</a>
						{/each}
						{#if sitemapStore.selectedNode.data.internalLinks.length > 10}
							<p class="text-xs text-gray-500">
								... and {sitemapStore.selectedNode.data.internalLinks.length - 10} more
							</p>
						{/if}
					</div>
				</div>
			{/if}
		</div>

		<!-- Footer -->
		<div class="p-4 border-t space-y-2">
			<button
				onclick={handleOpenViewer}
				class="w-full px-4 py-2 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors flex items-center justify-center gap-2"
			>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
				</svg>
				Open in Viewer
			</button>
			<button
				onclick={handleOpenUrl}
				class="w-full px-4 py-2 text-gray-600 text-sm rounded-md border border-gray-200 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 transition-colors"
			>
				Open in New Tab
			</button>
		</div>
	</div>
{/if}
