<script lang="ts">
	import type { FeedbackMarker, MarkerStatus } from '$lib/types';

	interface Props {
		markers: FeedbackMarker[];
		highlightedMarkerId: string | null;
		onMarkerHover: (markerId: string | null) => void;
		onMarkerClick: (marker: FeedbackMarker) => void;
		onStatusChange: (markerId: string, status: MarkerStatus) => void;
		onDelete: (markerId: string) => void;
		onComment: (markerId: string, content: string) => void;
	}

	let {
		markers,
		highlightedMarkerId,
		onMarkerHover,
		onMarkerClick,
		onStatusChange,
		onDelete,
		onComment
	}: Props = $props();

	let statusFilter = $state<'all' | 'open' | 'resolved'>('all');
	let expandedMarkerId = $state<string | null>(null);
	let commentText = $state('');

	let filteredMarkers = $derived(
		statusFilter === 'all' ? markers : markers.filter((m) => m.status === statusFilter)
	);

	let openCount = $derived(markers.filter((m) => m.status === 'open').length);
	let resolvedCount = $derived(markers.filter((m) => m.status === 'resolved').length);

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString('fr-FR', {
			day: 'numeric',
			month: 'short',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function handleMouseEnter(marker: FeedbackMarker): void {
		onMarkerHover(marker.id);
	}

	function handleMouseLeave(): void {
		onMarkerHover(null);
	}

	function handleClick(marker: FeedbackMarker): void {
		onMarkerClick(marker);
		expandedMarkerId = expandedMarkerId === marker.id ? null : marker.id;
	}

	function handleStatusToggle(event: MouseEvent, marker: FeedbackMarker): void {
		event.stopPropagation();
		const newStatus: MarkerStatus = marker.status === 'open' ? 'resolved' : 'open';
		onStatusChange(marker.id, newStatus);
	}

	function handleDelete(event: MouseEvent, markerId: string): void {
		event.stopPropagation();
		if (confirm('Delete this marker?')) {
			onDelete(markerId);
		}
	}

	function handleCommentSubmit(event: Event, markerId: string): void {
		event.preventDefault();
		if (!commentText.trim()) return;
		onComment(markerId, commentText.trim());
		commentText = '';
	}

	function handleCommentKeyDown(event: KeyboardEvent, markerId: string): void {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			handleCommentSubmit(event, markerId);
		}
	}
</script>

<div class="w-80 border-l bg-white flex flex-col h-full overflow-hidden">
	<!-- Header -->
	<div class="p-4 border-b">
		<h3 class="font-semibold text-gray-800 flex items-center gap-2">
			<svg class="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
				/>
			</svg>
			Feedbacks
		</h3>
	</div>

	<!-- Filter -->
	{#if markers.length > 0}
		<div class="px-4 py-2 border-b">
			<select
				bind:value={statusFilter}
				class="w-full text-sm px-2 py-1.5 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
			>
				<option value="all">All markers ({markers.length})</option>
				<option value="open">Open only ({openCount})</option>
				<option value="resolved">Resolved only ({resolvedCount})</option>
			</select>
		</div>
	{/if}

	<!-- Markers list -->
	<div class="flex-1 overflow-y-auto">
		{#if filteredMarkers.length === 0}
			<div class="p-4 text-center text-gray-400">
				{#if markers.length === 0}
					<svg
						class="w-12 h-12 mx-auto mb-2 opacity-50"
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
					<p>No markers on this page</p>
					<p class="text-xs mt-1">Use the feedback tool in the app to add markers</p>
				{:else}
					<p>No {statusFilter} markers</p>
				{/if}
			</div>
		{:else}
			<ul class="divide-y">
				{#each filteredMarkers as marker (marker.id)}
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
					<li
						class="transition-colors"
						class:bg-orange-50={highlightedMarkerId === marker.id}
						onmouseenter={() => handleMouseEnter(marker)}
						onmouseleave={handleMouseLeave}
					>
						<!-- Main row -->
						<div class="p-3 cursor-pointer hover:bg-gray-50" onclick={() => handleClick(marker)}>
							<div class="flex items-start gap-3">
								<!-- Marker number -->
								<div
									class="w-7 h-7 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
									class:bg-orange-500={marker.status === 'open'}
									class:bg-green-500={marker.status === 'resolved'}
								>
									{marker.number}
								</div>

								<div class="flex-1 min-w-0">
									<!-- Element info + actions -->
									<div class="flex items-center justify-between gap-2">
										<div class="flex items-center gap-2">
											<span class="text-xs font-mono text-gray-500"
												>{marker.anchor.tagName}</span
											>
											<span
												class="text-xs px-1.5 py-0.5 rounded"
												class:bg-orange-100={marker.status === 'open'}
												class:text-orange-700={marker.status === 'open'}
												class:bg-green-100={marker.status === 'resolved'}
												class:text-green-700={marker.status === 'resolved'}
											>
												{marker.status}
											</span>
										</div>

										<!-- Quick actions -->
										<div class="flex items-center gap-1">
											<button
												onclick={(e) => handleStatusToggle(e, marker)}
												class="p-1 rounded hover:bg-gray-200 transition-colors"
												title={marker.status === 'open' ? 'Mark resolved' : 'Reopen'}
											>
												{#if marker.status === 'open'}
													<svg
														class="w-4 h-4 text-green-600"
														fill="none"
														stroke="currentColor"
														viewBox="0 0 24 24"
													>
														<path
															stroke-linecap="round"
															stroke-linejoin="round"
															stroke-width="2"
															d="M5 13l4 4L19 7"
														/>
													</svg>
												{:else}
													<svg
														class="w-4 h-4 text-orange-600"
														fill="none"
														stroke="currentColor"
														viewBox="0 0 24 24"
													>
														<path
															stroke-linecap="round"
															stroke-linejoin="round"
															stroke-width="2"
															d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
														/>
													</svg>
												{/if}
											</button>
											<button
												onclick={(e) => handleDelete(e, marker.id)}
												class="p-1 rounded hover:bg-red-100 transition-colors"
												title="Delete"
											>
												<svg
													class="w-4 h-4 text-red-500"
													fill="none"
													stroke="currentColor"
													viewBox="0 0 24 24"
												>
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
													/>
												</svg>
											</button>
										</div>
									</div>

									<!-- Latest comment preview -->
									{#if marker.comments.length > 0}
										<p class="text-sm text-gray-700 mt-1 line-clamp-2">
											{marker.comments[marker.comments.length - 1].content}
										</p>
										{#if marker.comments.length > 1}
											<p class="text-xs text-gray-400 mt-0.5">
												+{marker.comments.length - 1} more comment{marker.comments.length > 2
													? 's'
													: ''}
											</p>
										{/if}
									{:else}
										<p class="text-sm text-gray-400 mt-1 italic">No comments</p>
									{/if}

									<!-- Date -->
									<p class="text-xs text-gray-400 mt-1">{formatDate(marker.createdAt)}</p>
								</div>
							</div>
						</div>

						<!-- Expanded panel -->
						{#if expandedMarkerId === marker.id}
							<div class="px-3 pb-3 border-t bg-gray-50">
								<!-- All comments -->
								{#if marker.comments.length > 0}
									<div class="py-2 space-y-2 max-h-40 overflow-y-auto">
										{#each marker.comments as comment}
											<div class="text-sm">
												<p class="text-gray-700">{comment.content}</p>
												<p class="text-xs text-gray-400">
													{comment.author} - {formatDate(comment.createdAt)}
												</p>
											</div>
										{/each}
									</div>
								{/if}

								<!-- Add comment form -->
								<form
									onsubmit={(e) => handleCommentSubmit(e, marker.id)}
									class="flex gap-2 pt-2"
								>
									<input
										bind:value={commentText}
										onkeydown={(e) => handleCommentKeyDown(e, marker.id)}
										type="text"
										placeholder="Add a comment..."
										class="flex-1 text-sm px-2 py-1.5 border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-orange-500"
									/>
									<button
										type="submit"
										disabled={!commentText.trim()}
										class="px-3 py-1.5 bg-orange-500 text-white text-sm rounded hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
									>
										Send
									</button>
								</form>
							</div>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</div>
