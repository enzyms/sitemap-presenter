<script lang="ts">
	import type { FeedbackMarker, MarkerStatus } from '$lib/types';
	import YoutrackModal from '$lib/components/ui/YoutrackModal.svelte';
	import AutofixModal from '$lib/components/ui/AutofixModal.svelte';
	import MarkerListItem from '$lib/components/ui/MarkerListItem.svelte';

	interface Props {
		markers: FeedbackMarker[];
		highlightedMarkerId: string | null;
		siteId: string;
		nodeId?: string | null;
		isYoutrackConfigured: boolean;
		youtrackBaseUrl?: string;
		onMarkerHover: (markerId: string | null) => void;
		onMarkerClick: (marker: FeedbackMarker) => void;
		onStatusChange: (markerId: string, status: MarkerStatus) => void;
		onDelete: (markerId: string) => void;
		onComment: (markerId: string, content: string) => void;
		onFilterChange: (status: 'all' | 'active' | MarkerStatus) => void;
		onMarkerUpdate?: (markerId: string, updates: Partial<FeedbackMarker>) => void;
	}

	let {
		markers,
		highlightedMarkerId,
		siteId,
		nodeId = null,
		isYoutrackConfigured,
		youtrackBaseUrl,
		onMarkerHover,
		onMarkerClick,
		onStatusChange,
		onDelete,
		onComment,
		onFilterChange,
		onMarkerUpdate
	}: Props = $props();

	let activeTab = $state<'feedbacks' | 'archives'>('feedbacks');
	let statusFilter = $state<'all' | 'open' | 'resolved'>('all');
	let expandedMarkerId = $state<string | null>(null);
	let openMenuId = $state<string | null>(null);

	// Youtrack & Autofix modals
	let showYoutrackModal = $state<FeedbackMarker | null>(null);
	let showAutofixModal = $state<FeedbackMarker | null>(null);
	let youtrackSending = $state(false);
	let youtrackError = $state<string | null>(null);

	// Active (non-archived) markers
	let activeMarkers = $derived(markers.filter((m) => m.status !== 'archived'));
	let archivedMarkers = $derived(markers.filter((m) => m.status === 'archived'));

	let tabMarkers = $derived(activeTab === 'feedbacks' ? activeMarkers : archivedMarkers);

	let filteredMarkers = $derived(
		activeTab === 'archives' || statusFilter === 'all'
			? tabMarkers
			: tabMarkers.filter((m) => m.status === statusFilter)
	);

	let openCount = $derived(activeMarkers.filter((m) => m.status === 'open').length);
	let resolvedCount = $derived(activeMarkers.filter((m) => m.status === 'resolved').length);

	function switchTab(tab: 'feedbacks' | 'archives') {
		activeTab = tab;
		statusFilter = 'all';
		if (tab === 'feedbacks') {
			onFilterChange('active');
		} else {
			onFilterChange('archived');
		}
	}

	function handleDropdownChange() {
		if (statusFilter === 'all') {
			onFilterChange('active');
		} else {
			onFilterChange(statusFilter);
		}
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
		const newStatus: MarkerStatus =
			marker.status === 'open' ? 'resolved' : marker.status === 'resolved' ? 'archived' : 'open';
		onStatusChange(marker.id, newStatus);
		openMenuId = null;
	}

	function handleReopen(event: MouseEvent, marker: FeedbackMarker): void {
		event.stopPropagation();
		onStatusChange(marker.id, 'open');
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

	async function handleSendToYoutrack(summary: string, description: string): Promise<void> {
		if (!showYoutrackModal) return;

		const marker = showYoutrackModal;
		youtrackSending = true;
		youtrackError = null;

		try {
			const res = await fetch('/youtrack', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					siteId,
					markerId: marker.id,
					summary,
					description,
					nodeId
				})
			});

			const data = await res.json();

			if (!res.ok) {
				throw new Error(data.error || 'Failed to create YouTrack issue');
			}

			// Update local marker
			onMarkerUpdate?.(marker.id, { youtrackIssueId: data.issueId });
			showYoutrackModal = null;
		} catch (e) {
			youtrackError = e instanceof Error ? e.message : 'Failed to send to YouTrack';
		} finally {
			youtrackSending = false;
		}
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
	<!-- Tabs -->
	<div class="flex border-b">
		<button
			onclick={() => switchTab('feedbacks')}
			class="flex-1 px-4 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-colors border-b-2"
			class:border-orange-500={activeTab === 'feedbacks'}
			class:text-orange-600={activeTab === 'feedbacks'}
			class:border-transparent={activeTab !== 'feedbacks'}
			class:text-gray-500={activeTab !== 'feedbacks'}
			class:hover:text-gray-700={activeTab !== 'feedbacks'}
		>
			<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
				/>
			</svg>
			Feedbacks
			{#if activeMarkers.length > 0}
				<span class="px-1.5 py-0.5 text-xs rounded-full bg-orange-100 text-orange-700">
					{activeMarkers.length}
				</span>
			{/if}
		</button>
		<button
			onclick={() => switchTab('archives')}
			class="flex-1 px-4 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-colors border-b-2"
			class:border-gray-500={activeTab === 'archives'}
			class:text-gray-700={activeTab === 'archives'}
			class:border-transparent={activeTab !== 'archives'}
			class:text-gray-400={activeTab !== 'archives'}
			class:hover:text-gray-600={activeTab !== 'archives'}
		>
			<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M5 8h14M5 8a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v1a2 2 0 01-2 2M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
				/>
			</svg>
			Archives
			{#if archivedMarkers.length > 0}
				<span class="px-1.5 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">
					{archivedMarkers.length}
				</span>
			{/if}
		</button>
	</div>

	<!-- Filter (feedbacks tab only) -->
	{#if activeTab === 'feedbacks' && activeMarkers.length > 0}
		<div class="px-4 py-2 border-b">
			<select
				bind:value={statusFilter}
				onchange={handleDropdownChange}
				class="w-full text-sm px-2 py-1.5 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
			>
				<option value="all">All ({activeMarkers.length})</option>
				<option value="open">Open ({openCount})</option>
				<option value="resolved">Resolved ({resolvedCount})</option>
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
				{:else if activeTab === 'archives'}
					<p>No archived markers</p>
				{:else}
					<p>No {statusFilter === 'all' ? '' : statusFilter} markers</p>
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
						{youtrackBaseUrl}
						onhover={onMarkerHover}
						onclick={() => onMarkerClick(marker)}
						ontogglemenu={(e) => toggleMenu(e, marker.id)}
						onexpandcomments={(e) => handleExpandComments(e, marker.id)}
						onstatustoggle={(e) => handleStatusToggle(e, marker)}
						onreopen={(e) => handleReopen(e, marker)}
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
		{isYoutrackConfigured}
		{siteId}
		{nodeId}
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
