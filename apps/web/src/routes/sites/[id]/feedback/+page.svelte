<script lang="ts">
	import { page } from '$app/stores';
	import { onMount, onDestroy } from 'svelte';
	import AppHeader from '$lib/components/ui/AppHeader.svelte';
	import { feedbackStore } from '$lib/stores/feedback.svelte';
	import { formatDateTime } from '$lib/utils/formatDate';
	import type { MarkerWithComments, MarkerStatus } from '$lib/services/supabase';

	let siteId = $derived($page.params.id!);

	let statusFilter = $state<'all' | 'open' | 'resolved' | 'archived'>('all');
	let pageFilter = $state<string | null>(null);
	let expandedMarkerId = $state<string | null>(null);
	let commentText = $state('');

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

	async function handleStatusChange(markerId: string, status: MarkerStatus): Promise<void> {
		await feedbackStore.updateMarkerStatus(markerId, status);
	}

	async function handleDelete(markerId: string): Promise<void> {
		if (!confirm('Delete this feedback marker?')) return;
		await feedbackStore.deleteMarker(markerId);
		if (expandedMarkerId === markerId) {
			expandedMarkerId = null;
		}
	}

	async function handleCommentSubmit(markerId: string): Promise<void> {
		if (!commentText.trim()) return;
		await feedbackStore.addComment(markerId, commentText.trim());
		commentText = '';
	}

	function toggleExpand(markerId: string): void {
		expandedMarkerId = expandedMarkerId === markerId ? null : markerId;
		commentText = '';
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
	<main class="max-w-6xl mx-auto px-6 py-8">
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
					{#each uniquePages as pagePath}
						<option value={pagePath}>{pagePath}</option>
					{/each}
				</select>

				<span class="text-sm text-gray-500">
					Showing {filteredCount} marker{filteredCount !== 1 ? 's' : ''}
				</span>
			</div>

			<!-- Markers grouped by page -->
			<div class="space-y-8">
				{#each Object.entries(groupedByPage) as [pagePath, pageMarkers]}
					<div>
						<h2 class="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
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
						</h2>

						<div class="space-y-3">
							{#each pageMarkers as marker (marker.id)}
								<div class="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
									<!-- Marker header -->
									<div
										class="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
										onclick={() => toggleExpand(marker.id)}
										onkeydown={(e) => e.key === 'Enter' && toggleExpand(marker.id)}
										role="button"
										tabindex="0"
									>
										<div class="flex items-start gap-4">
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
												</div>

												{#if marker.comments.length > 0}
													<p class="text-sm text-gray-700 line-clamp-2">
														{marker.comments[marker.comments.length - 1].content}
													</p>
													{#if marker.comments.length > 1}
														<p class="text-xs text-gray-400 mt-1">
															+{marker.comments.length - 1} more comment{marker.comments.length > 2
																? 's'
																: ''}
														</p>
													{/if}
												{:else}
													<p class="text-sm text-gray-400 italic">No comments</p>
												{/if}

												<p class="text-xs text-gray-400 mt-2">
													{formatDateTime(marker.created_at)}
												</p>
											</div>

											<svg
												class="w-5 h-5 text-gray-400 transition-transform"
												class:rotate-180={expandedMarkerId === marker.id}
												fill="none"
												stroke="currentColor"
												viewBox="0 0 24 24"
											>
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M19 9l-7 7-7-7"
												/>
											</svg>
										</div>
									</div>

									<!-- Expanded content -->
									{#if expandedMarkerId === marker.id}
										<div class="border-t border-gray-200 bg-gray-50">
											<!-- Element info -->
											<div class="p-4 border-b border-gray-200">
												<h4 class="text-xs font-medium text-gray-500 uppercase mb-2">Element</h4>
												<code class="text-xs text-gray-600 bg-white px-2 py-1 rounded border block overflow-x-auto">
													{marker.anchor.selector}
												</code>
											</div>

											<!-- Comments -->
											<div class="p-4 border-b border-gray-200">
												<h4 class="text-xs font-medium text-gray-500 uppercase mb-3">
													Comments ({marker.comments.length})
												</h4>

												{#if marker.comments.length > 0}
													<div class="space-y-3 mb-4 max-h-60 overflow-y-auto">
														{#each marker.comments as comment}
															<div class="bg-white p-3 rounded-lg border border-gray-200">
																<p class="text-sm text-gray-700">{comment.content}</p>
																<p class="text-xs text-gray-400 mt-1">
																	{comment.author_name || 'Anonymous'} &bull; {formatDateTime(
																		comment.created_at
																	)}
																</p>
															</div>
														{/each}
													</div>
												{/if}

												<!-- Add comment -->
												<div class="flex gap-2">
													<input
														type="text"
														bind:value={commentText}
														placeholder="Add a comment..."
														class="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
														onkeydown={(e) => {
															if (e.key === 'Enter' && commentText.trim()) {
																handleCommentSubmit(marker.id);
															}
														}}
													/>
													<button
														onclick={() => handleCommentSubmit(marker.id)}
														disabled={!commentText.trim()}
														class="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
													>
														Send
													</button>
												</div>
											</div>

											<!-- Actions -->
											<div class="p-4 flex items-center gap-3">
												{#if marker.status === 'open'}
													<button
														onclick={() => handleStatusChange(marker.id, 'resolved')}
														class="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors"
													>
														<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
															<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
														</svg>
														Resolve
													</button>
												{:else if marker.status === 'resolved'}
													<button
														onclick={() => handleStatusChange(marker.id, 'archived')}
														class="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg text-sm font-medium hover:bg-gray-600 transition-colors"
													>
														<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
															<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v1a2 2 0 01-2 2M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
														</svg>
														Archive
													</button>
												{:else}
													<button
														onclick={() => handleStatusChange(marker.id, 'open')}
														class="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
													>
														<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
															<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
														</svg>
														Reopen
													</button>
												{/if}

												<button
													onclick={() => handleDelete(marker.id)}
													class="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors"
												>
													<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
														<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
													</svg>
													Delete
												</button>
											</div>
										</div>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</main>
</div>
