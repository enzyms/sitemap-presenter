<script lang="ts">
	import { page } from '$app/state';
	import { replaceState, afterNavigate } from '$app/navigation';
	import { onMount, onDestroy, tick } from 'svelte';
	import AppHeader from '$lib/components/ui/AppHeader.svelte';
	import YoutrackModal from '$lib/components/ui/YoutrackModal.svelte';
	import AutofixModal from '$lib/components/ui/AutofixModal.svelte';
	import { feedbackStore } from '$lib/stores/feedback.svelte';
	import { convertSupabaseMarkerToFeedback } from '$lib/utils/markerConverters';
	import { formatDateTime } from '$lib/utils/formatDate';
	import type { MarkerWithComments, MarkerStatus } from '$lib/services/supabase';
	import type { FeedbackMarker } from '$lib/types';

	let siteId = $derived(page.params.id!);
	let initialMarkerId = page.params.markerId ?? null;

	let routerReady = $state(false);
	afterNavigate(() => { routerReady = true; });

	let statusFilter = $state<'all' | 'open' | 'resolved' | 'archived'>('all');
	let pageFilter = $state<string | null>(null);
	let commentText: Record<string, string> = $state({});
	let openMenuId = $state<string | null>(null);
	let showCommentInputId = $state<string | null>(null);

	// YouTrack / Autofix modals
	let showYoutrackModal = $state<FeedbackMarker | null>(null);
	let showAutofixModal = $state<FeedbackMarker | null>(null);
	let youtrackSending = $state(false);
	let youtrackError = $state<string | null>(null);

	let youtrackConfig = $derived(feedbackStore.site?.settings?.youtrack);
	let isYoutrackConfigured = $derived(
		!!(youtrackConfig?.baseUrl && youtrackConfig?.projectId && youtrackConfig?.token)
	);
	let youtrackBaseUrl = $derived(youtrackConfig?.baseUrl?.replace(/\/+$/, '') ?? '');

	// Grouped markers by page path
	let groupedByPage = $derived.by(() => {
		const filtered =
			statusFilter === 'all' ? feedbackStore.markers : feedbackStore.markers.filter((m) => m.status === statusFilter);

		const groups: Record<string, MarkerWithComments[]> = {};
		for (const marker of filtered) {
			if (pageFilter && marker.page_path !== pageFilter) continue;
			if (!groups[marker.page_path]) {
				groups[marker.page_path] = [];
			}
			groups[marker.page_path].push(marker);
		}
		return groups;
	});

	let uniquePages = $derived([...new Set(feedbackStore.markers.map((m) => m.page_path))].sort());

	let filteredCount = $derived(
		Object.values(groupedByPage).reduce((sum, arr) => sum + arr.length, 0)
	);

	// Auto-scroll to marker from URL on load
	$effect(() => {
		if (feedbackStore.markers.length > 0 && initialMarkerId) {
			const id = initialMarkerId;
			initialMarkerId = null;
			tick().then(() => {
				document.getElementById(`marker-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
			});
		}
	});

	// Sync URL when viewing a specific marker
	$effect(() => {
		if (!routerReady || !siteId) return;
		replaceState(new URL(`/sites/${siteId}/feedbacks`, page.url.origin), {});
	});

	async function handleStatusChange(markerId: string, status: MarkerStatus): Promise<void> {
		await feedbackStore.updateMarkerStatus(markerId, status);
	}

	async function handleDelete(markerId: string): Promise<void> {
		if (!confirm('Delete this feedback marker?')) return;
		await feedbackStore.deleteMarker(markerId);
	}

	async function handleCommentSubmit(markerId: string): Promise<void> {
		const text = commentText[markerId]?.trim();
		if (!text) return;
		await feedbackStore.addComment(markerId, text);
		commentText[markerId] = '';
	}

	function toggleMenu(event: MouseEvent, markerId: string): void {
		event.stopPropagation();
		openMenuId = openMenuId === markerId ? null : markerId;
	}

	function handleWindowClick(): void {
		openMenuId = null;
	}

	function openYoutrackModal(event: MouseEvent, marker: MarkerWithComments): void {
		event.stopPropagation();
		showYoutrackModal = convertSupabaseMarkerToFeedback(marker);
		openMenuId = null;
	}

	function openAutofixModal(event: MouseEvent, marker: MarkerWithComments): void {
		event.stopPropagation();
		showAutofixModal = convertSupabaseMarkerToFeedback(marker);
		openMenuId = null;
	}

	async function handleSendToYoutrack(summary: string, description: string): Promise<void> {
		if (!showYoutrackModal) return;
		const markerId = showYoutrackModal.id;
		youtrackSending = true;
		youtrackError = null;

		try {
			const res = await fetch('/youtrack', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ siteId, markerId, summary, description })
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || 'Failed to create YouTrack issue');
			showYoutrackModal = null;
			// Refresh to pick up the new youtrack_issue_id
			await feedbackStore.initializeBySiteId(siteId);
		} catch (e) {
			youtrackError = e instanceof Error ? e.message : 'Failed to send to YouTrack';
		} finally {
			youtrackSending = false;
		}
	}

	function handleSendToAutofix(text: string, includeScreenshot: boolean): void {
		console.log('Send to Claude for autofix:', { marker: showAutofixModal, text, includeScreenshot });
		alert('Sent to Claude! (integration pending)');
		showAutofixModal = null;
	}

	onMount(async () => {
		await feedbackStore.initializeBySiteId(siteId);
	});

	onDestroy(() => {
		feedbackStore.destroy();
	});
</script>

<svelte:head>
	<title>{feedbackStore.site?.name || 'Loading...'} - Feedback</title>
</svelte:head>

<svelte:window onclick={handleWindowClick} />

<div class="min-h-screen bg-gray-100 flex flex-col">
	<AppHeader siteName={feedbackStore.site?.name} {siteId} showNewSite={false} />

	<!-- Stats bar -->
	<div class="bg-white border-b border-gray-200 px-6 py-3">
		<div class="max-w-6xl mx-auto flex items-center gap-6">
			{#if feedbackStore.loading}
				<div class="h-6 w-32 bg-gray-200 animate-pulse rounded"></div>
			{:else}
				<div class="flex items-center gap-2">
					<span class="text-xl font-bold text-gray-800">{feedbackStore.markers.length}</span>
					<span class="text-gray-500">total markers</span>
				</div>
				{#if feedbackStore.openCount > 0}
					<div class="flex items-center gap-2">
						<span class="w-3 h-3 bg-orange-500 rounded-full"></span>
						<span class="text-gray-700 font-medium">{feedbackStore.openCount} open</span>
					</div>
				{/if}
				{#if feedbackStore.resolvedCount > 0}
					<div class="flex items-center gap-2">
						<span class="w-3 h-3 bg-green-500 rounded-full"></span>
						<span class="text-gray-700 font-medium">{feedbackStore.resolvedCount} resolved</span>
					</div>
				{/if}
				{#if feedbackStore.archivedCount > 0}
					<div class="flex items-center gap-2">
						<span class="w-3 h-3 bg-gray-400 rounded-full"></span>
						<span class="text-gray-700 font-medium">{feedbackStore.archivedCount} archived</span>
					</div>
				{/if}
			{/if}
		</div>
	</div>

	<!-- Main content -->
	<main class="max-w-5xl w-full mx-auto px-6 py-8">
		{#if feedbackStore.error}
			<div class="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
				{feedbackStore.error}
			</div>
		{/if}

		{#if feedbackStore.loading}
			<div class="flex items-center justify-center py-20">
				<svg class="w-8 h-8 animate-spin text-orange-500" fill="none" viewBox="0 0 24 24">
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
			</div>
		{:else if feedbackStore.markers.length === 0}
			<div class="text-center py-20">
				<svg
					class="w-16 h-16 mx-auto text-gray-300 mb-4"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="1.5"
						d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
					/>
				</svg>
				<h2 class="text-xl font-medium text-gray-600 mb-2">No feedback yet</h2>
				<p class="text-gray-400">Install the widget on your site to start collecting feedback</p>
			</div>
		{:else}
			<!-- Filters -->
			<div class="flex items-center gap-4 mb-6">
				<select
					bind:value={statusFilter}
					class="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
				>
					<option value="all">All status ({feedbackStore.markers.length})</option>
					<option value="open">Open ({feedbackStore.openCount})</option>
					<option value="resolved">Resolved ({feedbackStore.resolvedCount})</option>
					<option value="archived">Archived ({feedbackStore.archivedCount})</option>
				</select>

				<select
					bind:value={pageFilter}
					class="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
				>
					<option value={null}>All pages ({uniquePages.length})</option>
					{#each uniquePages as pagePath (pagePath)}
						<option value={pagePath}>{pagePath}</option>
					{/each}
				</select>

				<span class="text-sm text-gray-500">
					Showing {filteredCount} marker{filteredCount !== 1 ? 's' : ''}
				</span>
			</div>

			<!-- Markers grouped by page -->
			<div class="space-y-8">
				{#each Object.entries(groupedByPage) as [pagePath, pageMarkers] (pagePath)}
					<div>
						<h2 class="">
							
							<a
								href="/sites/{siteId}/map?page={encodeURIComponent(pagePath)}"
								class="text-sm font-medium mb-3 flex items-center gap-2 text-orange-500 hover:text-orange-600 transition-colors"
							>
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
								/>
							</svg>
							{pagePath}
							<span class="text-gray-400">({pageMarkers.length})</span>
							</a>
						</h2>

						<div class="space-y-4">
							{#each pageMarkers as marker (marker.id)}
								<div id="marker-{marker.id}" class="bg-white rounded-lg shadow-sm border border-gray-200">
									<!-- Marker header row -->
									<div class="p-4">
										<div class="flex items-start gap-3">
											<!-- Number badge -->
											<div
												class="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
												class:bg-orange-500={marker.status === 'open'}
												class:bg-green-500={marker.status === 'resolved'}
												class:bg-gray-400={marker.status === 'archived'}
											>
												{marker.number}
											</div>

											<div class="flex-1 min-w-0">
												<div class="flex items-center gap-2 mb-1">
													<span class="text-xs font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
														{marker.anchor.tagName}
													</span>
													<span
														class="text-xs px-2 py-0.5 rounded-full"
														class:bg-orange-100={marker.status === 'open'}
														class:text-orange-700={marker.status === 'open'}
														class:bg-green-100={marker.status === 'resolved'}
														class:text-green-700={marker.status === 'resolved'}
														class:bg-gray-100={marker.status === 'archived'}
														class:text-gray-600={marker.status === 'archived'}
													>
														{marker.status}
													</span>
													{#if marker.youtrack_issue_id && youtrackBaseUrl}
														<a
															href="{youtrackBaseUrl}/issue/{marker.youtrack_issue_id}"
															target="_blank"
															rel="noopener noreferrer"
															class="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 font-mono transition-colors"
															title="View in YouTrack"
														>
															{marker.youtrack_issue_id}
														</a>
													{/if}
												</div>
												<p class="text-xs text-gray-400">
													{formatDateTime(marker.created_at)}
												</p>
											</div>

											<!-- Kebab menu -->
											<div class="relative">
												<button
													onclick={(e) => toggleMenu(e, marker.id)}
													class="p-1 rounded hover:bg-gray-200 transition-colors"
													title="Actions"
												>
													<svg class="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
														<circle cx="12" cy="5" r="2" />
														<circle cx="12" cy="12" r="2" />
														<circle cx="12" cy="19" r="2" />
													</svg>
												</button>

												{#if openMenuId === marker.id}
													<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events -->
													<div
														class="absolute right-0 top-full mt-1 w-44 bg-white rounded-md shadow-lg border z-10"
														onclick={(e) => e.stopPropagation()}
													>
														{#if marker.youtrack_issue_id && youtrackBaseUrl}
															<a
																href="{youtrackBaseUrl}/issue/{marker.youtrack_issue_id}"
																target="_blank"
																rel="noopener noreferrer"
																class="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 text-blue-600 flex items-center gap-2"
															>
																<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																	<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
																</svg>
																View in YouTrack
															</a>
														{:else if !marker.youtrack_issue_id}
															<button
																onclick={(e) => openYoutrackModal(e, marker)}
																class="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 text-blue-600 flex items-center gap-2"
															>
																<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																	<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
																</svg>
																Add to YouTrack
															</button>
														{/if}
														{#if marker.status === 'open'}
															<button
																onclick={(e) => openAutofixModal(e, marker)}
																class="w-full px-3 py-2 text-left text-sm hover:bg-purple-50 text-purple-600 flex items-center gap-2"
															>
																<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																	<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
																</svg>
																Autofix
															</button>
														{/if}
														{#if marker.status === 'open'}
															<button
																onclick={() => { handleStatusChange(marker.id, 'resolved'); openMenuId = null; }}
																disabled={marker.comments.length === 0}
																class="w-full px-3 py-2 text-left text-sm flex items-center gap-2"
																class:hover:bg-gray-50={marker.comments.length > 0}
																class:opacity-40={marker.comments.length === 0}
																class:cursor-not-allowed={marker.comments.length === 0}
																title={marker.comments.length === 0 ? 'Add a comment first' : ''}
															>
																<svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																	<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
																</svg>
																Mark resolved
															</button>
														{:else if marker.status === 'resolved'}
															<button
																onclick={() => { handleStatusChange(marker.id, 'archived'); openMenuId = null; }}
																class="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
															>
																<svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																	<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v1a2 2 0 01-2 2M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
																</svg>
																Archive
															</button>
														{/if}
														{#if marker.status !== 'open'}
															<button
																onclick={() => { handleStatusChange(marker.id, 'open'); openMenuId = null; }}
																class="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
															>
																<svg class="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																	<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
																</svg>
																Reopen
															</button>
														{/if}
														<button
															onclick={() => { showCommentInputId = showCommentInputId === marker.id ? null : marker.id; openMenuId = null; }}
															class="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
														>
															<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
															</svg>
															Add a comment
														</button>
														<button
															onclick={(e) => { e.stopPropagation(); openMenuId = null; handleDelete(marker.id); }}
															class="w-full px-3 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
														>
															<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
															</svg>
															Delete
														</button>
													</div>
												{/if}
											</div>
										</div>
									</div>

									<!-- Comments (always visible) -->
									<div class="px-4 pb-4">
										{#if marker.comments.length > 0}
											<div class="space-y-2 mb-3">
												{#each marker.comments as comment (comment.id)}
													<div class="bg-gray-50 p-3 rounded-lg">
														<p class="text-sm text-gray-700">{comment.content}</p>
														<p class="text-xs text-gray-400 mt-1">
															{comment.author_name || 'Anonymous'} &bull; {formatDateTime(comment.created_at)}
														</p>
													</div>
												{/each}
											</div>
										{/if}

										<!-- Add comment (toggled from kebab menu) -->
										{#if showCommentInputId === marker.id}
											<div class="flex gap-2">
												<input
													type="text"
													bind:value={commentText[marker.id]}
													placeholder="Add a comment..."
													class="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
													onkeydown={(e) => {
														if (e.key === 'Enter' && commentText[marker.id]?.trim()) {
															handleCommentSubmit(marker.id);
														}
													}}
												/>
												<button
													onclick={() => handleCommentSubmit(marker.id)}
													disabled={!commentText[marker.id]?.trim()}
													class="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
												>
													Send
												</button>
											</div>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</main>
</div>

{#if showYoutrackModal}
	<YoutrackModal
		marker={showYoutrackModal}
		{isYoutrackConfigured}
		{siteId}
		sending={youtrackSending}
		error={youtrackError}
		onclose={() => { showYoutrackModal = null; youtrackError = null; }}
		onsend={handleSendToYoutrack}
	/>
{/if}

{#if showAutofixModal}
	<AutofixModal
		marker={showAutofixModal}
		onclose={() => (showAutofixModal = null)}
		onsend={handleSendToAutofix}
	/>
{/if}
