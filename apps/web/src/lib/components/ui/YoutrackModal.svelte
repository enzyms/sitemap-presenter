<script lang="ts">
	import type { FeedbackMarker } from '$lib/types';

	interface Props {
		marker: FeedbackMarker;
		isYoutrackConfigured: boolean;
		siteId: string;
		sending?: boolean;
		error?: string | null;
		onclose: () => void;
		onsend: (text: string, includeScreenshot: boolean) => void;
	}

	let { marker, isYoutrackConfigured, siteId, sending = false, error = null, onclose, onsend }: Props = $props();

	function buildInitialText(): string {
		const parts: string[] = [];
		if (marker.anchor.selector) {
			parts.push(`Element: ${marker.anchor.selector}`);
		}
		if (marker.comments.length > 0) {
			parts.push('');
			parts.push('Comments:');
			marker.comments.forEach((c) => {
				parts.push(`- ${c.content}`);
			});
		}
		return parts.join('\n');
	}

	let text = $state(buildInitialText());
	let includeScreenshot = $state(false);

	function handleSend() {
		if (!text.trim() || sending) return;
		onsend(text, includeScreenshot);
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

			<div class="mb-4">
				<label class="flex items-center gap-2 cursor-pointer">
					<input
						type="checkbox"
						bind:checked={includeScreenshot}
						disabled={sending}
						class="w-4 h-4 text-blue-500 border-gray-300 rounded focus:ring-blue-500"
					/>
					<span class="text-sm text-gray-700">Add related screenshot</span>
				</label>
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
					disabled={!text.trim() || sending}
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
