<script lang="ts">
	import type { FeedbackMarker } from '$lib/types';

	interface Props {
		marker: FeedbackMarker;
		onclose: () => void;
		onsend: (text: string, includeScreenshot: boolean) => void;
	}

	let { marker, onclose, onsend }: Props = $props();

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
		if (!text.trim()) return;
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

		<div class="mb-4">
			<label for="youtrack-text" class="block text-sm font-medium text-gray-700 mb-2"
				>Issue description</label
			>
			<textarea
				id="youtrack-text"
				bind:value={text}
				rows="8"
				placeholder="Describe the issue..."
				class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono text-sm"
			></textarea>
		</div>

		<div class="mb-4">
			<label class="flex items-center gap-2 cursor-pointer">
				<input
					type="checkbox"
					bind:checked={includeScreenshot}
					class="w-4 h-4 text-blue-500 border-gray-300 rounded focus:ring-blue-500"
				/>
				<span class="text-sm text-gray-700">Add related screenshot</span>
			</label>
		</div>

		<div class="flex justify-end gap-3">
			<button
				onclick={onclose}
				class="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
			>
				Cancel
			</button>
			<button
				onclick={handleSend}
				disabled={!text.trim()}
				class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
			>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
					/>
				</svg>
				Send to Youtrack
			</button>
		</div>
	</div>
</div>
