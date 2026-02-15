<script lang="ts">
	import type { FeedbackMarker, MarkerStatus } from '$lib/types';
	import YoutrackModal from '$lib/components/ui/YoutrackModal.svelte';
	import AutofixModal from '$lib/components/ui/AutofixModal.svelte';
	import MarkerListItem from '$lib/components/ui/MarkerListItem.svelte';

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

	// Youtrack & Autofix modals
	let showYoutrackModal = $state<FeedbackMarker | null>(null);
	let showAutofixModal = $state<FeedbackMarker | null>(null);

	let filteredMarkers = $derived(
		statusFilter === 'all' ? markers : markers.filter((m) => m.status === statusFilter)
	);

	let openCount = $derived(markers.filter((m) => m.status === 'open').length);
	let resolvedCount = $derived(markers.filter((m) => m.status === 'resolved').length);

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

	function openYoutrackModal(event: MouseEvent, marker: FeedbackMarker): void {
		event.stopPropagation();
		showYoutrackModal = marker;
		openMenuId = null;
	}

	function openAutofixModal(event: MouseEvent, marker: FeedbackMarker): void {
		event.stopPropagation();
		showAutofixModal = marker;
		openMenuId = null;
	}

	function handleSendToYoutrack(text: string, includeScreenshot: boolean): void {
		// TODO: Implement Youtrack API integration
		console.log('Send to Youtrack:', { marker: showYoutrackModal, text, includeScreenshot });
		alert('Sent to Youtrack! (integration pending)');
		showYoutrackModal = null;
	}

	function handleSendToAutofix(text: string, includeScreenshot: boolean): void {
		// TODO: Implement Claude API integration
		console.log('Send to Claude for autofix:', { marker: showAutofixModal, text, includeScreenshot });
		alert('Sent to Claude! (integration pending)');
		showAutofixModal = null;
	}

	// Close menu when clicking outside
	function handleWindowClick(): void {
		openMenuId = null;
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
					<MarkerListItem
						{marker}
						isHighlighted={highlightedMarkerId === marker.id}
						isMenuOpen={openMenuId === marker.id}
						isExpanded={expandedMarkerId === marker.id}
						onhover={onMarkerHover}
						onclick={() => onMarkerClick(marker)}
						ontogglemenu={(e) => toggleMenu(e, marker.id)}
						onexpandcomments={(e) => handleExpandComments(e, marker.id)}
						onstatustoggle={(e) => handleStatusToggle(e, marker)}
						ondelete={(e) => handleDelete(e, marker.id)}
						onyoutrack={(e) => openYoutrackModal(e, marker)}
						onautofix={(e) => openAutofixModal(e, marker)}
						oncomment={onComment}
					/>
				{/each}
			</ul>
		{/if}
	</div>
</div>

{#if showYoutrackModal}
	<YoutrackModal
		marker={showYoutrackModal}
		onclose={() => (showYoutrackModal = null)}
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
