<script lang="ts">
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { pageViewerStore } from '$lib/stores/pageViewer';
	import { sitemapStore } from '$lib/stores/sitemap';
	import { projectsStore } from '$lib/stores/projects';
	import FeedbackSidebar from './FeedbackSidebar.svelte';
	import type {
		FeedbackMarker,
		IframeToSitemapMessage,
		SitemapToIframeMessage,
		MarkerStatus
	} from '$lib/types';

	const currentProjectId = projectsStore.currentProjectId;

	const isOpen = pageViewerStore.isOpen;
	const pageUrl = pageViewerStore.pageUrl;
	const pageTitle = pageViewerStore.pageTitle;
	const screenshotUrl = pageViewerStore.screenshotUrl;

	let iframeLoaded = $state(false);
	let iframeError = $state(false);
	let useScreenshot = $state(false);
	let loadTimeout: ReturnType<typeof setTimeout>;

	// Feedback markers from iframe
	let iframeRef = $state<HTMLIFrameElement | null>(null);
	let feedbackMarkers = $state<FeedbackMarker[]>([]);
	let highlightedMarkerId = $state<string | null>(null);
	let showFeedbackSidebar = $state(true);

	// Send message to iframe
	function sendToIframe(message: SitemapToIframeMessage): void {
		if (!iframeRef?.contentWindow || !$pageUrl) return;

		try {
			const url = new URL($pageUrl);
			iframeRef.contentWindow.postMessage(message, url.origin);
		} catch (e) {
			console.error('Failed to send message to iframe:', e);
		}
	}

	// Request markers from iframe for its current page
	function requestMarkers(): void {
		// Don't specify pagePath - let the iframe use its current window.location.pathname
		// This way, when user navigates within the iframe, we get markers for the new page
		sendToIframe({
			type: 'FEEDBACK_GET_MARKERS'
		});
	}

	// Update marker status via iframe
	function updateMarkerStatus(markerId: string, status: MarkerStatus): void {
		sendToIframe({
			type: 'FEEDBACK_UPDATE_STATUS',
			markerId,
			status
		});
	}

	// Add comment via iframe
	function addMarkerComment(markerId: string, content: string): void {
		sendToIframe({
			type: 'FEEDBACK_ADD_COMMENT',
			markerId,
			content
		});
	}

	// Delete marker via iframe
	function deleteMarker(markerId: string): void {
		sendToIframe({
			type: 'FEEDBACK_DELETE_MARKER',
			markerId
		});
	}

	// Highlight marker in iframe
	function highlightMarker(markerId: string | null): void {
		highlightedMarkerId = markerId;
		sendToIframe({
			type: 'FEEDBACK_HIGHLIGHT_MARKER',
			markerId
		});
	}

	function handleClose() {
		pageViewerStore.closeViewer();
		iframeLoaded = false;
		iframeError = false;
		useScreenshot = false;
		feedbackMarkers = [];
		highlightedMarkerId = null;
		if (loadTimeout) clearTimeout(loadTimeout);
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (!$isOpen) return;

		if (event.key === 'Escape') {
			handleClose();
		}
	}

	function handleIframeLoad() {
		iframeLoaded = true;
		if (loadTimeout) clearTimeout(loadTimeout);
		// Markers are now received via FEEDBACK_NAVIGATION message from the iframe
		// No need to request them separately
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

	// Save current markers to project cache
	function saveMarkersToCache(markers: FeedbackMarker[]): void {
		if (!$currentProjectId || !$pageUrl) return;

		try {
			const url = new URL($pageUrl);
			const pagePath = url.pathname;
			const project = projectsStore.getProject($currentProjectId);
			const existingMarkers = project?.cachedData?.feedbackMarkers || {};

			console.log(`[PageViewer] Saving ${markers.length} markers for path "${pagePath}" to project ${$currentProjectId}`);

			projectsStore.saveFeedbackMarkers($currentProjectId, {
				...existingMarkers,
				[pagePath]: markers
			});
		} catch (e) {
			console.error('Failed to save feedback markers:', e);
		}
	}

	// Handle messages from iframe
	function handleMessage(event: MessageEvent) {
		const data = event.data as IframeToSitemapMessage | undefined;
		if (!data?.type?.startsWith('FEEDBACK_')) return;

		console.log('[PageViewer] Received message:', data.type, data);

		switch (data.type) {
			case 'FEEDBACK_MARKERS_RESPONSE':
				console.log('[PageViewer] MARKERS_RESPONSE:', data.markers.length, 'markers');
				feedbackMarkers = data.markers;
				saveMarkersToCache(data.markers);
				break;

			case 'FEEDBACK_MARKER_CREATED':
				console.log('[PageViewer] MARKER_CREATED:', data.marker);
				feedbackMarkers = [...feedbackMarkers, data.marker];
				saveMarkersToCache(feedbackMarkers);
				break;

			case 'FEEDBACK_MARKER_UPDATED':
				console.log('[PageViewer] MARKER_UPDATED:', data.marker);
				feedbackMarkers = feedbackMarkers.map((m) =>
					m.id === data.marker.id ? data.marker : m
				);
				saveMarkersToCache(feedbackMarkers);
				break;

			case 'FEEDBACK_MARKER_DELETED':
				console.log('[PageViewer] MARKER_DELETED:', data.markerId);
				feedbackMarkers = feedbackMarkers.filter((m) => m.id !== data.markerId);
				saveMarkersToCache(feedbackMarkers);
				break;

			case 'FEEDBACK_ACTION_CONFIRMED':
				if (data.success) {
					requestMarkers();
				}
				break;

			case 'FEEDBACK_NAVIGATION':
				// Iframe navigated to a new page - update viewer, node, and markers
				console.log('[PageViewer] NAVIGATION:', data.url, 'with', data.markers?.length || 0, 'markers');
				handleIframeNavigation(data.url, data.title, data.markers);
				break;
		}
	}

	// Handle navigation within the iframe
	function handleIframeNavigation(newUrl: string, newTitle: string, markers: FeedbackMarker[]) {
		// Update the viewer's displayed URL and title
		pageViewerStore.updateCurrentPage(newUrl, newTitle);

		// Find the node with this URL in the sitemap
		const nodes = get(sitemapStore.nodes);
		const matchingNode = nodes.find((n) => n.data.url === newUrl);

		if (matchingNode) {
			// Select the node in the sitemap canvas
			sitemapStore.selectNode(matchingNode.id);

			// Update screenshot if available
			if (matchingNode.data.fullScreenshotUrl || matchingNode.data.thumbnailUrl) {
				pageViewerStore.updateScreenshot(
					matchingNode.data.fullScreenshotUrl || matchingNode.data.thumbnailUrl || null
				);
			}
		}

		// Update markers directly from the navigation message (spread to ensure new reference)
		feedbackMarkers = markers ? [...markers] : [];
		highlightedMarkerId = null;

		// Save markers to project cache for display on nodes
		saveMarkersToCache(feedbackMarkers);
	}

	// Sidebar callbacks
	function handleMarkerHover(markerId: string | null) {
		// Only update local highlight state for visual feedback in sidebar
		// Don't send to iframe - that happens only on click
		highlightedMarkerId = markerId;
	}

	function handleMarkerClick(marker: FeedbackMarker) {
		// Send highlight to iframe only on click
		highlightMarker(marker.id);
	}

	function handleMarkerStatusChange(markerId: string, status: MarkerStatus) {
		updateMarkerStatus(markerId, status);
	}

	function handleMarkerDelete(markerId: string) {
		deleteMarker(markerId);
	}

	function handleMarkerComment(markerId: string, content: string) {
		addMarkerComment(markerId, content);
	}

	// Reset and start timeout when viewer opens
	$effect(() => {
		if ($isOpen && !useScreenshot) {
			iframeLoaded = false;
			iframeError = false;
			feedbackMarkers = [];
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

	// Listen for postMessage responses
	onMount(() => {
		window.addEventListener('message', handleMessage);
		return () => {
			window.removeEventListener('message', handleMessage);
		};
	});
</script>

<svelte:window onkeydown={handleKeyDown} />

{#if $isOpen}
	<!-- Backdrop -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 bg-black/60 z-50" onclick={handleClose}></div>

	<!-- Viewer -->
	<div class="fixed inset-4 z-50 flex flex-col bg-white rounded-xl shadow-2xl overflow-hidden">
		<!-- Header -->
		<header class="flex items-center justify-between px-4 py-3 border-b bg-gray-200">
			<div class="flex items-center gap-4 flex-1 min-w-0">
				<h2 class="text-lg font-semibold text-gray-800 truncate">{$pageTitle}</h2>
				<a
					href={$pageUrl}
					target="_blank"
					rel="noopener noreferrer"
					class="text-sm text-blue-600 hover:text-blue-800 hover:underline truncate hidden sm:block"
				>
					{$pageUrl}
				</a>
			</div>

			<div class="flex items-center gap-3">
				<!-- Feedback sidebar toggle -->
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
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
						/>
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

				<!-- Close button -->
				<button
					onclick={handleClose}
					aria-label="Close viewer"
					class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
				>
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
			</div>
		</header>

		<!-- Main content area with sidebar -->
		<div class="flex-1 flex overflow-hidden">
			<!-- Main viewer -->
			<div class="flex-1 relative overflow-hidden bg-gray-100">
				{#if useScreenshot}
					<!-- Screenshot mode -->
					<div class="absolute inset-0 overflow-auto">
						{#if $screenshotUrl}
							<div class="relative inline-block min-w-full">
								<img src={$screenshotUrl} alt={$pageTitle} class="block max-w-none" />
							</div>
						{:else}
							<div class="w-full h-full flex items-center justify-center text-gray-400">
								<div class="text-center">
									<svg
										class="w-16 h-16 mx-auto mb-4"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="1.5"
											d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
										/>
									</svg>
									<p>No screenshot available</p>
								</div>
							</div>
						{/if}
					</div>
				{:else}
					<!-- Iframe mode -->
					{#if !iframeLoaded}
						<div class="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
							<div class="text-center">
								<svg
									class="w-12 h-12 mx-auto mb-4 animate-spin text-blue-500"
									fill="none"
									viewBox="0 0 24 24"
								>
									<circle
										class="opacity-25"
										cx="12"
										cy="12"
										r="10"
										stroke="currentColor"
										stroke-width="4"
									></circle>
									<path
										class="opacity-75"
										fill="currentColor"
										d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
									></path>
								</svg>
								<p class="text-gray-500">Loading page...</p>
							</div>
						</div>
					{/if}

					{#if iframeError}
						<div class="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
							<div class="text-center max-w-md px-4">
								<svg
									class="w-16 h-16 mx-auto mb-4 text-yellow-500"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
									/>
								</svg>
								<p class="text-gray-700 font-medium mb-2">
									This site cannot be loaded in the viewer
								</p>
								<p class="text-gray-500 text-sm mb-4">
									Some sites block embedding for security reasons (X-Frame-Options).
								</p>
								{#if $screenshotUrl}
									<button
										onclick={switchToScreenshot}
										class="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
									>
										View screenshot instead
									</button>
								{/if}
							</div>
						</div>
					{/if}

					{#if $pageUrl && !iframeError}
						<iframe
							bind:this={iframeRef}
							src={$pageUrl}
							title={$pageTitle}
							class="absolute inset-0 w-full h-full border-0"
							onload={handleIframeLoad}
							onerror={handleIframeError}
						></iframe>
					{/if}
				{/if}
			</div>

			<!-- Feedback sidebar -->
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

		<!-- Footer -->
		<footer class="flex items-center justify-center px-4 py-2 border-t bg-gray-50">
			<span class="text-xs text-gray-400">Press Esc to close</span>
		</footer>
	</div>
{/if}
