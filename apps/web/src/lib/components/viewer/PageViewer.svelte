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
	let useScreenshot = $state(false);
	let loadTimeout: ReturnType<typeof setTimeout>;
	let iframeRef = $state<HTMLIFrameElement | null>(null);
	let highlightedMarkerId = $state<string | null>(null);
	let showFeedbackSidebar = $state(true);
	let initialLoadComplete = $state(false);

	// Iframe src is set once when the viewer opens; never updated on in-iframe navigation
	// so that changing the display URL doesn't cause the iframe to reload.
	let iframeSrc = $state<string | null>(null);

	let feedbackMarkers = $derived(feedbackStore.markersForCurrentPage.map(convertSupabaseMarkerToFeedback));

	// Keep messenger iframe ref in sync
	$effect(() => {
		messenger.setIframe(iframeRef);
	});

	$effect(() => {
		if (pageViewerStore.pageUrl) {
			messenger.setTargetUrl(pageViewerStore.pageUrl);
		}
	});

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
		useScreenshot = false;
		highlightedMarkerId = null;
		initialLoadComplete = false;
		iframeSrc = null;
		if (loadTimeout) clearTimeout(loadTimeout);
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

	function switchToScreenshot() {
		useScreenshot = true;
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
		if (pageViewerStore.isOpen && !useScreenshot) {
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

		<!-- Main content area with sidebar -->
		<div class="flex-1 flex overflow-hidden">
			<div class="flex-1 relative overflow-hidden bg-gray-100">
				{#if useScreenshot}
					<div class="absolute inset-0 overflow-auto">
						{#if pageViewerStore.screenshotUrl}
							<div class="relative inline-block min-w-full">
								<img src={pageViewerStore.screenshotUrl} alt={pageViewerStore.pageTitle} class="block max-w-none" />
							</div>
						{:else}
							<div class="w-full h-full flex items-center justify-center text-gray-400">
								<div class="text-center">
									<svg class="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
									</svg>
									<p>No screenshot available</p>
								</div>
							</div>
						{/if}
					</div>
				{:else}
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
								{#if pageViewerStore.screenshotUrl}
									<button onclick={switchToScreenshot} class="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors">
										View screenshot instead
									</button>
								{/if}
							</div>
						</div>
					{/if}

					{#if iframeSrc && !iframeError}
						<iframe
							bind:this={iframeRef}
							src={iframeSrc}
							title={pageViewerStore.pageTitle}
							class="absolute inset-0 w-full h-full border-0"
							onload={handleIframeLoad}
							onerror={handleIframeError}
						></iframe>
					{/if}
				{/if}
			</div>

			{#if showFeedbackSidebar && !useScreenshot}
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
