<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	// Redirect to homepage - /sites is now the homepage
	onMount(() => {
		goto('/', { replaceState: true });
	});
</script>

<div class="min-h-screen bg-gray-50 flex items-center justify-center">
	<svg class="w-8 h-8 animate-spin text-orange-500" fill="none" viewBox="0 0 24 24">
		<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
		<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
	</svg>
</div>
