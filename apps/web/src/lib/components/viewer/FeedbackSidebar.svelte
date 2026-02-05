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
	let openMenuId = $state<string | null>(null);
	let commentText = $state('');

	// Youtrack & Autofix modals
	let showYoutrackModal = $state<FeedbackMarker | null>(null);
	let showAutofixModal = $state<FeedbackMarker | null>(null);
	let youtrackText = $state('');
	let autofixText = $state('');
	let includeYoutrackScreenshot = $state(false);
	let includeAutofixScreenshot = $state(false);

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
		// Highlight the marker in the iframe (opens popup there via MarkerDisplay)
		// Do NOT toggle expandedMarkerId here - comments panel in sidebar stays via kebab menu only
		onMarkerClick(marker);
	}

	function toggleMenu(event: MouseEvent, markerId: string): void {
		event.stopPropagation();
		openMenuId = openMenuId === markerId ? null : markerId;
	}

	function handleExpandComments(event: MouseEvent, markerId: string): void {
		event.stopPropagation();
		expandedMarkerId = expandedMarkerId === markerId ? null : markerId;
		openMenuId = null;
	}

	function handleStatusToggle(event: MouseEvent, marker: FeedbackMarker): void {
		event.stopPropagation();
		const newStatus: MarkerStatus = marker.status === 'open' ? 'resolved' : 'open';
		onStatusChange(marker.id, newStatus);
		openMenuId = null;
	}

	function handleDelete(event: MouseEvent, markerId: string): void {
		event.stopPropagation();
		if (confirm('Delete this marker?')) {
			onDelete(markerId);
		}
		openMenuId = null;
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

	// Close menu when clicking outside
	function handleWindowClick(): void {
		openMenuId = null;
	}

	// Get default text for modals with element path and comments
	function getMarkerDefaultText(marker: FeedbackMarker): string {
		const parts: string[] = [];

		// Add element selector path
		if (marker.anchor.selector) {
			parts.push(`Element: ${marker.anchor.selector}`);
		}

		// Add comments
		if (marker.comments.length > 0) {
			parts.push('');
			parts.push('Comments:');
			marker.comments.forEach(c => {
				parts.push(`- ${c.content}`);
			});
		}

		return parts.join('\n');
	}

	function openYoutrackModal(event: MouseEvent, marker: FeedbackMarker): void {
		event.stopPropagation();
		youtrackText = getMarkerDefaultText(marker);
		includeYoutrackScreenshot = false;
		showYoutrackModal = marker;
		openMenuId = null;
	}

	function openAutofixModal(event: MouseEvent, marker: FeedbackMarker): void {
		event.stopPropagation();
		autofixText = getMarkerDefaultText(marker);
		includeAutofixScreenshot = false;
		showAutofixModal = marker;
		openMenuId = null;
	}

	function handleSendToYoutrack(): void {
		if (!showYoutrackModal || !youtrackText.trim()) return;
		// TODO: Implement Youtrack API integration
		console.log('Send to Youtrack:', {
			marker: showYoutrackModal,
			text: youtrackText,
			includeScreenshot: includeYoutrackScreenshot
		});
		alert('Sent to Youtrack! (integration pending)');
		showYoutrackModal = null;
		youtrackText = '';
		includeYoutrackScreenshot = false;
	}

	function handleSendToAutofix(): void {
		if (!showAutofixModal || !autofixText.trim()) return;
		// TODO: Implement Claude API integration
		console.log('Send to Claude for autofix:', {
			marker: showAutofixModal,
			text: autofixText,
			includeScreenshot: includeAutofixScreenshot
		});
		alert('Sent to Claude! (integration pending)');
		showAutofixModal = null;
		autofixText = '';
		includeAutofixScreenshot = false;
	}
</script>

<svelte:window onclick={handleWindowClick} />

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
						<!-- Main row - click only highlights -->
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
									<!-- Element info + kebab menu -->
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

										<!-- Kebab menu -->
										<div class="relative">
											<button
												onclick={(e) => toggleMenu(e, marker.id)}
												class="p-1 rounded hover:bg-gray-200 transition-colors"
												title="Actions"
											>
												<svg
													class="w-4 h-4 text-gray-500"
													fill="currentColor"
													viewBox="0 0 24 24"
												>
													<circle cx="12" cy="5" r="2" />
													<circle cx="12" cy="12" r="2" />
													<circle cx="12" cy="19" r="2" />
												</svg>
											</button>

											<!-- Dropdown menu -->
											{#if openMenuId === marker.id}
												<!-- svelte-ignore a11y_no_static_element_interactions -->
												<div
													class="absolute right-0 top-full mt-1 w-44 bg-white rounded-md shadow-lg border z-10"
													onclick={(e) => e.stopPropagation()}
												>
													<button
														onclick={(e) => handleExpandComments(e, marker.id)}
														class="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
													>
														<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
															<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
														</svg>
														{expandedMarkerId === marker.id ? 'Hide comments' : 'View comments'}
													</button>
													{#if marker.status === 'open'}
														<button
															onclick={(e) => openYoutrackModal(e, marker)}
															class="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 text-blue-600 flex items-center gap-2"
														>
															<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
															</svg>
															Add to Youtrack
														</button>
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
													<button
														onclick={(e) => handleStatusToggle(e, marker)}
														class="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
													>
														{#if marker.status === 'open'}
															<svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
															</svg>
															Mark resolved
														{:else}
															<svg class="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
															</svg>
															Reopen
														{/if}
													</button>
													<button
														onclick={(e) => handleDelete(e, marker.id)}
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

<!-- Youtrack Modal -->
{#if showYoutrackModal}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center" onclick={() => (showYoutrackModal = null)}>
		<div class="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 mx-4" onclick={(e) => e.stopPropagation()}>
			<div class="flex items-start justify-between mb-4">
				<div class="flex items-center gap-3">
					<div class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
						<svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
						</svg>
					</div>
					<div>
						<h2 class="text-lg font-bold text-gray-800">Add to Youtrack</h2>
						<p class="text-sm text-gray-500">Marker #{showYoutrackModal.number}</p>
					</div>
				</div>
				<button
					onclick={() => (showYoutrackModal = null)}
					class="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
				>
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<div class="mb-4">
				<label for="youtrack-text" class="block text-sm font-medium text-gray-700 mb-2">Issue description</label>
				<textarea
					id="youtrack-text"
					bind:value={youtrackText}
					rows="8"
					placeholder="Describe the issue..."
					class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono text-sm"
				></textarea>
			</div>

			<div class="mb-4">
				<label class="flex items-center gap-2 cursor-pointer">
					<input
						type="checkbox"
						bind:checked={includeYoutrackScreenshot}
						class="w-4 h-4 text-blue-500 border-gray-300 rounded focus:ring-blue-500"
					/>
					<span class="text-sm text-gray-700">Add related screenshot</span>
				</label>
			</div>

			<div class="flex justify-end gap-3">
				<button
					onclick={() => (showYoutrackModal = null)}
					class="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
				>
					Cancel
				</button>
				<button
					onclick={handleSendToYoutrack}
					disabled={!youtrackText.trim()}
					class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
					</svg>
					Send to Youtrack
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Autofix Modal -->
{#if showAutofixModal}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center" onclick={() => (showAutofixModal = null)}>
		<div class="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 mx-4" onclick={(e) => e.stopPropagation()}>
			<div class="flex items-start justify-between mb-4">
				<div class="flex items-center gap-3">
					<div class="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
						<svg class="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
						</svg>
					</div>
					<div>
						<h2 class="text-lg font-bold text-gray-800">Autofix with Claude</h2>
						<p class="text-sm text-gray-500">Marker #{showAutofixModal.number}</p>
					</div>
				</div>
				<button
					onclick={() => (showAutofixModal = null)}
					class="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
				>
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
					</svg>
				</button>
			</div>

			<div class="mb-4">
				<label for="autofix-text" class="block text-sm font-medium text-gray-700 mb-2">Describe what to fix</label>
				<textarea
					id="autofix-text"
					bind:value={autofixText}
					rows="8"
					placeholder="Describe the fix you need..."
					class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none font-mono text-sm"
				></textarea>
			</div>

			<div class="mb-4">
				<label class="flex items-center gap-2 cursor-pointer">
					<input
						type="checkbox"
						bind:checked={includeAutofixScreenshot}
						class="w-4 h-4 text-purple-500 border-gray-300 rounded focus:ring-purple-500"
					/>
					<span class="text-sm text-gray-700">Add related screenshot</span>
				</label>
			</div>

			<div class="flex justify-end gap-3">
				<button
					onclick={() => (showAutofixModal = null)}
					class="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
				>
					Cancel
				</button>
				<button
					onclick={handleSendToAutofix}
					disabled={!autofixText.trim()}
					class="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
					</svg>
					Send request to Claude
				</button>
			</div>
		</div>
	</div>
{/if}
