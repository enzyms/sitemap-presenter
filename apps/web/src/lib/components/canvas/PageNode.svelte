<script lang="ts">
	import { Handle, Position } from '@xyflow/svelte';
	import type { PageData } from '$lib/types';
	import { sitemapStore } from '$lib/stores/sitemap';
	import { pageViewerStore } from '$lib/stores/pageViewer';

	interface Props {
		id: string;
		data: PageData;
		selected?: boolean;
	}

	let { id, data, selected = false }: Props = $props();

	const zoomLevel = sitemapStore.zoomLevel;

	// Level of Detail based on zoom - removed minimal, always show at least thumbnail
	let lod = $derived($zoomLevel > 0.3 ? 'thumbnail' : 'full');
	let showIframe = $derived(lod === 'full' && selected);

	// Status indicator color
	let statusColor = $derived(
		data.screenshotStatus === 'ready'
			? 'bg-green-500'
			: data.screenshotStatus === 'processing'
				? 'bg-yellow-500'
				: data.screenshotStatus === 'error'
					? 'bg-red-500'
					: 'bg-gray-400'
	);

	// Depth color coding
	let depthColor = $derived(
		data.depth === 0
			? 'border-blue-500'
			: data.depth === 1
				? 'border-green-500'
				: data.depth === 2
					? 'border-yellow-500'
					: data.depth === 3
						? 'border-orange-500'
						: 'border-red-500'
	);

	function handleClick() {
		// Open viewer directly instead of showing PageDetail
		pageViewerStore.openViewer(
			data.url,
			data.title,
			data.thumbnailUrl || null,
			data.fullScreenshotUrl || null
		);
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="relative cursor-pointer transition-all duration-200"
	class:ring-2={selected}
	class:ring-blue-500={selected}
	class:ring-offset-2={selected}
	onclick={handleClick}
>
	<Handle type="target" position={Position.Top} class="!bg-gray-400" />

	{#if lod === 'thumbnail'}
		<!-- Thumbnail view: screenshot + title (larger size) -->
		<div
			class="w-96 h-64 rounded-lg overflow-hidden shadow-lg bg-white border-2 {depthColor}"
		>
			<div class="relative h-48 bg-gray-100">
				{#if data.thumbnailUrl}
					<img
						src={data.thumbnailUrl}
						alt={data.title}
						class="w-full h-full object-cover object-top"
					/>
				{:else}
					<div class="w-full h-full flex items-center justify-center text-gray-400">
						<svg
							class="w-12 h-12 animate-pulse"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
							/>
						</svg>
					</div>
				{/if}
				<!-- Status indicator -->
				<div class="absolute top-2 right-2 w-3 h-3 rounded-full {statusColor}"></div>
				<!-- Depth badge -->
				<div
					class="absolute top-2 left-2 px-2 py-0.5 bg-black/50 text-white text-xs rounded"
				>
					Depth: {data.depth}
				</div>
			</div>
			<div class="p-3 bg-white">
				<p class="truncate text-base font-medium text-gray-800">{data.title}</p>
				<p class="truncate text-sm text-gray-500">{data.url}</p>
			</div>
		</div>
	{:else}
		<!-- Full view: larger with potential iframe -->
		<div
			class="w-[480px] h-[400px] rounded-lg overflow-hidden shadow-xl bg-white border-2 {depthColor}"
		>
			<div class="relative h-[340px] bg-gray-100">
				{#if showIframe}
					<iframe
						src={data.url}
						title={data.title}
						class="w-full h-full border-0"
						sandbox="allow-same-origin allow-scripts"
					></iframe>
				{:else if data.thumbnailUrl}
					<img
						src={data.thumbnailUrl}
						alt={data.title}
						class="w-full h-full object-cover object-top"
					/>
				{:else}
					<div class="w-full h-full flex items-center justify-center text-gray-400">
						<svg class="w-16 h-16 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
							/>
						</svg>
					</div>
				{/if}
				<!-- Status indicator -->
				<div class="absolute top-2 right-2 w-4 h-4 rounded-full {statusColor}"></div>
				<!-- Depth badge -->
				<div class="absolute top-2 left-2 px-2 py-1 bg-black/50 text-white text-sm rounded">
					Depth: {data.depth}
				</div>
				<!-- Links count -->
				<div class="absolute bottom-2 left-2 flex gap-2">
					<span class="px-2 py-1 bg-blue-500/80 text-white text-xs rounded">
						{data.internalLinks.length} internal
					</span>
					<span class="px-2 py-1 bg-purple-500/80 text-white text-xs rounded">
						{data.externalLinks.length} external
					</span>
				</div>
			</div>
			<div class="p-3 bg-white">
				<p class="truncate text-base font-medium text-gray-800">{data.title}</p>
				<p class="truncate text-sm text-gray-500">{data.url}</p>
			</div>
		</div>
	{/if}

	<Handle type="source" position={Position.Bottom} class="!bg-gray-400" />
</div>
