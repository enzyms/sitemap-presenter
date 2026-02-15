<script lang="ts">
	import { sitemapStore } from '$lib/stores/sitemap.svelte';

	let inputValue = $state('');

	function handleInput(event: Event) {
		const target = event.target as HTMLInputElement;
		inputValue = target.value;
		sitemapStore.setSearchQuery(target.value);
	}

	function handleClear() {
		inputValue = '';
		sitemapStore.setSearchQuery('');
	}

	let resultCount = $derived(sitemapStore.filteredNodes.length);
	let totalCount = $derived(sitemapStore.nodes.length);
	let showResults = $derived(inputValue.length > 0 && totalCount > 0);
</script>

<div class="relative">
	<div class="relative">
		<svg
			class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
			fill="none"
			stroke="currentColor"
			viewBox="0 0 24 24"
		>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
			/>
		</svg>
		<input
			type="text"
			value={inputValue}
			oninput={handleInput}
			placeholder="Search pages..."
			class="w-64 pl-10 pr-8 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
		/>
		{#if inputValue}
			<button
				onclick={handleClear}
				aria-label="Clear search"
				class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
			>
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
				</svg>
			</button>
		{/if}
	</div>

	{#if showResults}
		<div class="absolute top-full left-0 mt-1 px-3 py-1 bg-gray-800 text-white text-xs rounded shadow">
			{resultCount} of {totalCount} pages
		</div>
	{/if}
</div>
