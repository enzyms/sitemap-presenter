<script lang="ts">
	import { onMount } from 'svelte';
	import { pageViewerStore } from '$lib/stores/pageViewer.svelte';
	import { sitemapStore } from '$lib/stores/sitemap.svelte';
	import { projectsStore } from '$lib/stores/projects.svelte';
	import { feedbackStore } from '$lib/stores/feedback.svelte';
	import { IframeMessenger } from '$lib/services/iframeMessenger';
	import { markerSync } from '$lib/services/markerSync';
	import { convertSupabaseMarkerToFeedback } from '$lib/utils/markerConverters';
	import FeedbackSidebar from './FeedbackSidebar.svelte';
	import type { FeedbackMarker, IframeToSitemapMessage, MarkerStatus } from '$lib/types';

	const messenger = new IframeMessenger();

	let iframeLoaded = $state(false);
	let iframeError = $state(false);
	let loadTimeout: ReturnType<typeof setTimeout>;
	let iframeRef = $state<HTMLIFrameElement | null>(null);
	let highlightedMarkerId = $state<string | null>(null);
	let showFeedbackSidebar = $state(true);
	let initialLoadComplete = $state(false);

	// Viewport-aware resizable iframe state
	let iframeWidth = $state<number | 'auto'>('auto');
	let isResizing = $state(false);
	let containerRef = $state<HTMLDivElement | null>(null);
	let containerWidth = $state(0);
	let effectiveWidth = $derived(
		iframeWidth === 'auto' ? containerWidth : Math.min(iframeWidth, containerWidth)
	);
	let activeMarkerViewportWidth = $derived.by(() => {
		if (!highlightedMarkerId) return null;
		const marker = feedbackMarkers.find((m) => m.id === highlightedMarkerId);
		return marker?.viewport?.width ?? null;
	});

	// Iframe src is set once when the viewer opens; never updated on in-iframe navigation
	// so that changing the display URL doesn't cause the iframe to reload.
	let iframeSrc = $state<string | null>(null);

	let feedbackMarkers = $derived(feedbackStore.markersForCurrentPage.map(convertSupabaseMarkerToFeedback));

	// Feedback navigation
	let feedbackNodeCount = $derived(sitemapStore.nodesWithFeedback.length);
	let currentFeedbackIndex = $derived.by(() => {
		if (feedbackNodeCount === 0) return -1;
		return sitemapStore.nodesWithFeedback.findIndex((n) => n.id === sitemapStore.selectedNodeId);
	});
	let showFeedbackNav = $derived(feedbackNodeCount >= 2);

	// Keep messenger iframe ref in sync
	$effect(() => {
		messenger.setIframe(iframeRef);
	});

	$effect(() => {
		if (pageViewerStore.pageUrl) {
			messenger.setTargetUrl(pageViewerStore.pageUrl);
		}
	});

	// Track container width for clamping
	$effect(() => {
		if (!containerRef) return;
		const observer = new ResizeObserver((entries) => {
			for (const entry of entries) {
				containerWidth = entry.contentRect.width;
			}
		});
		observer.observe(containerRef);
		return () => observer.disconnect();
	});

	function startResize(event: MouseEvent, side: 'left' | 'right') {
		event.preventDefault();
		const startX = event.clientX;
		const startWidth = iframeWidth === 'auto' ? containerWidth : effectiveWidth;
		isResizing = true;

		function onMouseMove(e: MouseEvent) {
			const delta = side === 'right' ? e.clientX - startX : startX - e.clientX;
			// Multiply by 2 because the iframe is centered — handle follows cursor
			const newWidth = Math.max(320, Math.min(startWidth + delta * 2, containerWidth));
			iframeWidth = newWidth;
		}

		function onMouseUp() {
			isResizing = false;
			window.removeEventListener('mousemove', onMouseMove);
			window.removeEventListener('mouseup', onMouseUp);
		}

		window.addEventListener('mousemove', onMouseMove);
		window.addEventListener('mouseup', onMouseUp);
	}

	// Reactively filter feedbacks to the current page.
	// feedbackStore is already initialized by the map page — we just set the filter.
	$effect(() => {
		if (pageViewerStore.isOpen && pageViewerStore.pageUrl) {
			try {
				const pathname = new URL(pageViewerStore.pageUrl).pathname;
				feedbackStore.setCurrentPage(pathname);
			} catch {
				// invalid URL — leave filter as-is
			}
		}
	});

	function handleClose() {
		pageViewerStore.closeViewer();
		feedbackStore.setCurrentPage(null);
		iframeLoaded = false;
		iframeError = false;
		highlightedMarkerId = null;
		initialLoadComplete = false;
		iframeSrc = null;
		iframeWidth = 'auto';
		isResizing = false;
		if (loadTimeout) clearTimeout(loadTimeout);
	}

	function navigateToFeedbackNode(direction: 'prev' | 'next') {
		const node = sitemapStore.navigateToFeedbackNode(direction);
		if (!node) return;

		// Update PageViewer content
		pageViewerStore.openViewer(
			node.data.url,
			node.data.title,
			node.data.thumbnailUrl || null,
			node.id
		);

		// Reset iframe state for new page
		iframeLoaded = false;
		iframeError = false;
		initialLoadComplete = false;
		iframeSrc = null;
		highlightedMarkerId = null;
		iframeWidth = 'auto';
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (pageViewerStore.isOpen && event.key === 'Escape') handleClose();
	}

	/** Normalize URL for comparison: strip trailing slash */
	function normalizeUrl(url: string): string {
		try {
			const u = new URL(url);
			const pathname = u.pathname.replace(/\/+$/, '') || '/';
			return `${u.origin}${pathname}${u.search}`;
		} catch {
			return url;
		}
	}

	function findNodeByUrl(url: string): (typeof sitemapStore.nodes)[number] | undefined {
		const normalized = normalizeUrl(url);
		return sitemapStore.nodes.find((n) => normalizeUrl(n.data.url) === normalized);
	}

	function handleIframeLoad() {
		iframeLoaded = true;
		if (loadTimeout) clearTimeout(loadTimeout);

		if (!initialLoadComplete) {
			initialLoadComplete = true;
			return;
		}

		// Subsequent load events mean navigation happened inside the iframe.
		// Try to read the new URL (works when same-origin, throws when cross-origin).
		if (!iframeRef) return;
		try {
			const newUrl = iframeRef.contentWindow?.location.href;
			const newTitle = iframeRef.contentDocument?.title || '';
			if (newUrl && normalizeUrl(newUrl) !== normalizeUrl(pageViewerStore.pageUrl || '')) {
				handleIframeNavigation(newUrl, newTitle);
			}
		} catch {
			// Cross-origin – cannot read URL.
			// Navigation detection relies on the widget's FEEDBACK_NAVIGATION postMessage.
		}
	}

	function handleIframeError() {
		iframeError = true;
		iframeLoaded = true;
		if (loadTimeout) clearTimeout(loadTimeout);
	}

	// Handle messages from iframe (widget postMessage)
	function handleIframeMessage(data: IframeToSitemapMessage) {
		switch (data.type) {
			case 'FEEDBACK_ACTION_CONFIRMED':
				if (data.success) messenger.getMarkers();
				break;
			case 'FEEDBACK_NAVIGATION':
				handleIframeNavigation(data.url, data.title, data.markers);
				break;
		}
	}

	function handleIframeNavigation(newUrl: string, newTitle: string, markers?: FeedbackMarker[]) {
		// Update the display URL + title (does NOT touch iframeSrc, so no iframe reload).
		// This also triggers the $effect above which filters feedbacks to this page.
		pageViewerStore.updateCurrentPage(newUrl, newTitle);

		// Reset viewport to full width on page change
		iframeWidth = 'auto';

		// Find & select the matching node
		const matchingNode = findNodeByUrl(newUrl);
		if (matchingNode) {
			sitemapStore.selectNode(matchingNode.id);
			if (matchingNode.data.thumbnailUrl) {
				pageViewerStore.updateScreenshot(matchingNode.data.thumbnailUrl || null);
			}
		} else {
			sitemapStore.selectNode(null);
			pageViewerStore.updateScreenshot(null);
		}

		highlightedMarkerId = null;

		// Cache widget-provided markers on the project
		if (markers && markers.length > 0 && projectsStore.currentProjectId && pageViewerStore.pageUrl) {
			markerSync.saveToProjectCache(projectsStore.currentProjectId, pageViewerStore.pageUrl, markers);
		}
	}

	// Sidebar callbacks
	function handleMarkerHover(markerId: string | null) {
		highlightedMarkerId = markerId;
	}

	function handleMarkerClick(marker: FeedbackMarker) {
		highlightedMarkerId = marker.id;
		messenger.highlightMarker(marker.id);
		// Resize iframe to marker's viewport width
		iframeWidth = marker.viewport.width;
	}

	async function handleMarkerStatusChange(markerId: string, status: MarkerStatus) {
		await feedbackStore.updateMarkerStatus(markerId, status);
		messenger.updateStatus(markerId, status);
	}

	async function handleMarkerDelete(markerId: string) {
		await feedbackStore.deleteMarker(markerId);
		messenger.deleteMarker(markerId);
	}

	async function handleMarkerComment(markerId: string, content: string) {
		await feedbackStore.addComment(markerId, content);
		messenger.addComment(markerId, content);
	}

	// Manage iframe loading state
	$effect(() => {
		if (pageViewerStore.isOpen) {
			if (!iframeSrc) {
				iframeSrc = pageViewerStore.pageUrl;
			}

			iframeLoaded = false;
			iframeError = false;
			loadTimeout = setTimeout(() => {
				if (!iframeLoaded) {
					iframeError = true;
					iframeLoaded = true;
				}
			}, 8000);
		}
		return () => {
			if (loadTimeout) clearTimeout(loadTimeout);
		};
	});

	onMount(() => {
		const cleanup = messenger.listen(handleIframeMessage);
		return () => {
			cleanup();
			messenger.destroy();
		};
	});
</script>

<svelte:window onkeydown={handleKeyDown} />

{#if pageViewerStore.isOpen}
	<!-- Backdrop -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 bg-black/60 z-50" onclick={handleClose}></div>

	<!-- Viewer -->
	<div class="fixed inset-4 z-50 flex flex-col bg-white rounded-xl shadow-2xl overflow-hidden">
		<!-- Header -->
		<header class="flex items-center justify-between px-4 py-3 border-b bg-gray-200">
			<div class="flex items-center gap-4 flex-1 min-w-0">
				<h2 class="text-lg font-semibold text-gray-800 truncate">{pageViewerStore.pageTitle}</h2>
				<a
					href={pageViewerStore.pageUrl}
					target="_blank"
					rel="noopener noreferrer"
					class="text-sm text-blue-600 hover:text-blue-800 hover:underline truncate hidden sm:block"
				>
					{pageViewerStore.pageUrl}
				</a>
			</div>

			<div class="flex items-center gap-3">
				{#if showFeedbackNav}
					<div class="flex items-center gap-1">
						<button
							onclick={() => navigateToFeedbackNode('prev')}
							class="p-1.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
							title="Previous page with feedback"
						>
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
							</svg>
						</button>
						<button
							onclick={() => navigateToFeedbackNode('next')}
							class="p-1.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
							title="Next page with feedback"
						>
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
							</svg>
						</button>
					</div>
				{/if}

				<button
					onclick={() => (showFeedbackSidebar = !showFeedbackSidebar)}
					class="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
					class:bg-orange-500={showFeedbackSidebar}
					class:text-white={showFeedbackSidebar}
					class:bg-gray-100={!showFeedbackSidebar}
					class:text-gray-700={!showFeedbackSidebar}
					class:hover:bg-gray-200={!showFeedbackSidebar}
					title="Toggle feedback sidebar"
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
					</svg>
					{#if feedbackMarkers.length > 0}
						<span
							class="px-1.5 py-0.5 text-xs rounded-full"
							class:bg-orange-600={showFeedbackSidebar}
							class:bg-orange-500={!showFeedbackSidebar}
							class:text-white={true}
						>
							{feedbackMarkers.length}
						</span>
					{/if}
				</button>

				<button
					onclick={handleClose}
					aria-label="Close viewer"
					class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
				>
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>
		</header>

		<!-- Viewport toolbar -->
		<div class="flex items-center gap-3 px-4 py-1.5 border-b bg-gray-50">
			<div class="flex items-center gap-1">
				{#each [{ label: 'Mobile', w: 375 }, { label: 'Tablet', w: 768 }, { label: 'Desktop', w: 1280 }] as preset (preset.w)}
					<button
						onclick={() => (iframeWidth = preset.w)}
						class="px-2.5 py-1 rounded text-xs font-medium transition-colors"
						class:bg-blue-500={iframeWidth === preset.w}
						class:text-white={iframeWidth === preset.w}
						class:text-gray-600={iframeWidth !== preset.w}
						class:hover:bg-gray-200={iframeWidth !== preset.w}
					>
						{preset.label}
					</button>
				{/each}
				<button
					onclick={() => (iframeWidth = 'auto')}
					class="px-2.5 py-1 rounded text-xs font-medium transition-colors"
					class:bg-blue-500={iframeWidth === 'auto'}
					class:text-white={iframeWidth === 'auto'}
					class:text-gray-600={iframeWidth !== 'auto'}
					class:hover:bg-gray-200={iframeWidth !== 'auto'}
				>
					Full
				</button>
			</div>
			<span class="font-mono text-xs text-gray-500 tabular-nums">
				{iframeWidth === 'auto' ? `${containerWidth}px` : `${effectiveWidth}px`}
			</span>
			{#if activeMarkerViewportWidth && iframeWidth === activeMarkerViewportWidth}
				<span class="text-xs text-blue-500">Marker viewport ({activeMarkerViewportWidth}px)</span>
			{/if}
		</div>

		<!-- Main content area with sidebar -->
		<div class="flex-1 flex overflow-hidden">
			<div class="flex-1 relative overflow-hidden bg-gray-100 flex items-stretch justify-center" bind:this={containerRef}>
				{#if !iframeLoaded}
					<div class="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
						<div class="text-center">
							<svg class="w-12 h-12 mx-auto mb-4 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
							</svg>
							<p class="text-gray-500">Loading page...</p>
						</div>
					</div>
				{/if}

				{#if iframeError}
					<div class="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
						<div class="text-center max-w-md px-4">
							<svg class="w-16 h-16 mx-auto mb-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
							</svg>
							<p class="text-gray-700 font-medium mb-2">This site cannot be loaded in the viewer</p>
							<p class="text-gray-500 text-sm mb-4">Some sites block embedding for security reasons (X-Frame-Options).</p>
						</div>
					</div>
				{/if}

				{#if iframeSrc && !iframeError}
					<div
						class="relative h-full bg-white"
						class:shadow-lg={iframeWidth !== 'auto'}
						class:transition-[width]={!isResizing}
						class:duration-300={!isResizing}
						class:ease-out={!isResizing}
						style:width={iframeWidth === 'auto' ? '100%' : `${effectiveWidth}px`}
						style:max-width="100%"
					>
						{#if iframeWidth !== 'auto'}
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<div
								class="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize z-20 group"
								onmousedown={(e) => startResize(e, 'left')}
							>
								<div class="absolute left-0 top-0 bottom-0 w-1 bg-transparent group-hover:bg-blue-400 transition-colors"></div>
							</div>
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<div
								class="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize z-20 group"
								onmousedown={(e) => startResize(e, 'right')}
							>
								<div class="absolute right-0 top-0 bottom-0 w-1 bg-transparent group-hover:bg-blue-400 transition-colors"></div>
							</div>
						{/if}
						<iframe
							bind:this={iframeRef}
							src={iframeSrc}
							title={pageViewerStore.pageTitle}
							class="absolute inset-0 w-full h-full border-0"
							onload={handleIframeLoad}
							onerror={handleIframeError}
						></iframe>
					</div>
				{/if}
			</div>

			{#if showFeedbackSidebar}
				<FeedbackSidebar
					markers={feedbackMarkers}
					{highlightedMarkerId}
					onMarkerHover={handleMarkerHover}
					onMarkerClick={handleMarkerClick}
					onStatusChange={handleMarkerStatusChange}
					onDelete={handleMarkerDelete}
					onComment={handleMarkerComment}
				/>
			{/if}
		</div>

		<footer class="flex items-center justify-center px-4 py-2 border-t bg-gray-50">
			<span class="text-xs text-gray-400">Press Esc to close</span>
		</footer>
	</div>
{/if}
