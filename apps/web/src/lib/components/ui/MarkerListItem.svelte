<script lang="ts">
	import type { FeedbackMarker } from '$lib/types';
	import { formatDateTime } from '$lib/utils/formatDate';

	interface Props {
		marker: FeedbackMarker;
		isHighlighted: boolean;
		isMenuOpen: boolean;
		isExpanded: boolean;
		onhover: (markerId: string | null) => void;
		onclick: () => void;
		ontogglemenu: (event: MouseEvent) => void;
		onexpandcomments: (event: MouseEvent) => void;
		onstatustoggle: (event: MouseEvent) => void;
		ondelete: (event: MouseEvent) => void;
		onyoutrack: (event: MouseEvent) => void;
		onautofix: (event: MouseEvent) => void;
		oncomment: (markerId: string, content: string) => void;
	}

	let {
		marker,
		isHighlighted,
		isMenuOpen,
		isExpanded,
		onhover,
		onclick,
		ontogglemenu,
		onexpandcomments,
		onstatustoggle,
		ondelete,
		onyoutrack,
		onautofix,
		oncomment
	}: Props = $props();

	let commentText = $state('');

	function handleCommentSubmit(event: Event) {
		event.preventDefault();
		if (!commentText.trim()) return;
		oncomment(marker.id, commentText.trim());
		commentText = '';
	}

	function handleCommentKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			handleCommentSubmit(event);
		}
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<li
	class="transition-colors"
	class:bg-orange-50={isHighlighted}
	onmouseenter={() => onhover(marker.id)}
	onmouseleave={() => onhover(null)}
>
	<!-- Main row -->
	<div class="p-3 cursor-pointer hover:bg-gray-50" onclick={onclick}>
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
						<span class="text-xs font-mono text-gray-500">{marker.anchor.tagName}</span>
						<span class="text-xs font-mono text-gray-400">{marker.viewport.width}px</span>
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
							onclick={ontogglemenu}
							class="p-1 rounded hover:bg-gray-200 transition-colors"
							title="Actions"
						>
							<svg class="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
								<circle cx="12" cy="5" r="2" />
								<circle cx="12" cy="12" r="2" />
								<circle cx="12" cy="19" r="2" />
							</svg>
						</button>

						<!-- Dropdown menu -->
						{#if isMenuOpen}
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<div
								class="absolute right-0 top-full mt-1 w-44 bg-white rounded-md shadow-lg border z-10"
								onclick={(e) => e.stopPropagation()}
							>
								<button
									onclick={onexpandcomments}
									class="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
								>
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
									</svg>
									{isExpanded ? 'Hide comments' : 'View comments'}
								</button>
								{#if marker.status === 'open'}
									<button
										onclick={onyoutrack}
										class="w-full px-3 py-2 text-left text-sm hover:bg-blue-50 text-blue-600 flex items-center gap-2"
									>
										<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
										</svg>
										Add to Youtrack
									</button>
									<button
										onclick={onautofix}
										class="w-full px-3 py-2 text-left text-sm hover:bg-purple-50 text-purple-600 flex items-center gap-2"
									>
										<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
										</svg>
										Autofix
									</button>
								{/if}
								<button
									onclick={onstatustoggle}
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
									onclick={ondelete}
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
							+{marker.comments.length - 1} more comment{marker.comments.length > 2 ? 's' : ''}
						</p>
					{/if}
				{:else}
					<p class="text-sm text-gray-400 mt-1 italic">No comments</p>
				{/if}

				<!-- Date -->
				<p class="text-xs text-gray-400 mt-1">{formatDateTime(marker.createdAt)}</p>
			</div>
		</div>
	</div>

	<!-- Expanded panel -->
	{#if isExpanded}
		<div class="px-3 pb-3 border-t bg-gray-50">
			<!-- All comments -->
			{#if marker.comments.length > 0}
				<div class="py-2 space-y-2 max-h-40 overflow-y-auto">
					{#each marker.comments as comment (comment.id)}
						<div class="text-sm">
							<p class="text-gray-700">{comment.content}</p>
							<p class="text-xs text-gray-400">
								{comment.author} - {formatDateTime(comment.createdAt)}
							</p>
						</div>
					{/each}
				</div>
			{/if}

			<!-- Add comment form -->
			<form onsubmit={handleCommentSubmit} class="flex gap-2 pt-2">
				<input
					bind:value={commentText}
					onkeydown={handleCommentKeyDown}
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
