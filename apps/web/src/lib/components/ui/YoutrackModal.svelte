<script lang="ts">
	import type { FeedbackMarker } from '$lib/types';

	interface Props {
		marker: FeedbackMarker;
		isYoutrackConfigured: boolean;
		siteId: string;
		nodeId?: string | null;
		sending?: boolean;
		error?: string | null;
		onclose: () => void;
		onsend: (summary: string, description: string) => void;
	}

	let { marker, isYoutrackConfigured, siteId, nodeId = null, sending = false, error = null, onclose, onsend }: Props = $props();

	function buildDefaultSummary(): string {
		if (marker.comments.length > 0) {
			const firstComment = marker.comments[0].content.trim();
			if (firstComment.length > 100) {
				return firstComment.slice(0, 97) + '...';
			}
			return firstComment;
		}
		return `Feedback #${marker.number} on ${marker.pagePath}`;
	}

	function formatDate(dateStr: string): string {
		const date = new Date(dateStr);
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	}

	function buildDescription(): string {
		const sections: string[] = [];

		// Page section
		const pageLines: string[] = [];
		if (marker.pageTitle) {
			pageLines.push(`**Title:** ${marker.pageTitle}`);
		}
		pageLines.push(`**URL:** ${marker.pageUrl}`);
		pageLines.push(`**Path:** ${marker.pagePath}`);
		if (pageLines.length > 0) {
			sections.push(`## Page\n${pageLines.join('\n')}`);
		}

		// Element section
		const elementLines: string[] = [];
		if (marker.anchor.tagName) {
			elementLines.push(`**Tag:** \`${marker.anchor.tagName}\``);
		}
		if (marker.anchor.selector) {
			elementLines.push(`**Selector:** \`${marker.anchor.selector}\``);
		}
		if (marker.anchor.innerText) {
			elementLines.push(`**Text:** "${marker.anchor.innerText}"`);
		}
		if (elementLines.length > 0) {
			sections.push(`## Element\n${elementLines.join('\n')}`);
		}

		// Device / Viewport section
		if (marker.viewport) {
			const vpLines: string[] = [];
			vpLines.push(`**Viewport:** ${marker.viewport.width} \u00d7 ${marker.viewport.height}`);
			vpLines.push(`**Pixel ratio:** ${marker.viewport.devicePixelRatio}x`);
			vpLines.push(`**Scroll position:** ${marker.viewport.scrollX}, ${marker.viewport.scrollY}`);
			sections.push(`## Device / Viewport\n${vpLines.join('\n')}`);
		}

		// Comments section
		if (marker.comments.length > 0) {
			const commentLines = marker.comments.map((c) => {
				const dateFormatted = formatDate(c.createdAt);
				return `**${c.author}** (${dateFormatted}):\n${c.content}`;
			});
			sections.push(`## Comments\n${commentLines.join('\n\n')}`);
		}

		// Link section
		if (nodeId) {
			const origin = window.location.origin;
			const markerParam = marker.id ? `?marker=${marker.id}` : '';
			sections.push(`## Link\n[View in Sitemap Presenter](${origin}/sites/${siteId}/map/${nodeId}${markerParam})`);
		}

		return sections.join('\n\n');
	}

	let summary = $state(buildDefaultSummary());
	let text = $state(buildDescription());

	function handleSend() {
		if (!summary.trim() || !text.trim() || sending) return;
		onsend(summary, text);
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center"
	onclick={onclose}
>
	<div
		class="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 mx-4"
		onclick={(e) => e.stopPropagation()}
	>
		<div class="flex items-start justify-between mb-4">
			<div class="flex items-center gap-3">
				<div class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
					<svg
						class="w-4 h-4 text-blue-600"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
						/>
					</svg>
				</div>
				<div>
					<h2 class="text-lg font-bold text-gray-800">Add to Youtrack</h2>
					<p class="text-sm text-gray-500">Marker #{marker.number}</p>
				</div>
			</div>
			<button
				onclick={onclose}
				aria-label="Close"
				class="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
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

		{#if !isYoutrackConfigured}
			<div class="p-4 bg-amber-50 border border-amber-200 rounded-lg mb-4">
				<p class="text-sm text-amber-800 mb-2">YouTrack is not configured for this site.</p>
				<a
					href="/sites/{siteId}/settings"
					class="text-sm text-blue-600 hover:text-blue-800 font-medium"
				>
					Go to Settings to configure YouTrack
				</a>
			</div>
		{:else}
			<div class="mb-4">
				<label for="youtrack-summary" class="block text-sm font-medium text-gray-700 mb-2"
					>Issue title</label
				>
				<input
					id="youtrack-summary"
					type="text"
					bind:value={summary}
					placeholder="Issue title..."
					disabled={sending}
					class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm disabled:opacity-50"
				/>
			</div>

			<div class="mb-4">
				<label for="youtrack-text" class="block text-sm font-medium text-gray-700 mb-2"
					>Issue description</label
				>
				<textarea
					id="youtrack-text"
					bind:value={text}
					rows="8"
					placeholder="Describe the issue..."
					disabled={sending}
					class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono text-sm disabled:opacity-50"
				></textarea>
			</div>

			{#if error}
				<div class="p-3 mb-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
					{error}
				</div>
			{/if}
		{/if}

		<div class="flex justify-end gap-3">
			<button
				onclick={onclose}
				class="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
			>
				Cancel
			</button>
			{#if isYoutrackConfigured}
				<button
					onclick={handleSend}
					disabled={!summary.trim() || !text.trim() || sending}
					class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
				>
					{#if sending}
						<svg class="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
							<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
							<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
						</svg>
						Sending...
					{:else}
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
							/>
						</svg>
						Send to Youtrack
					{/if}
				</button>
			{/if}
		</div>
	</div>
</div>
