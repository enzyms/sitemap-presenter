<script lang="ts">
	import { useSvelteFlow } from '@xyflow/svelte';
	import { browser } from '$app/environment';
	import { sitemapStore } from '$lib/stores/sitemap.svelte';
	import { pageViewerStore } from '$lib/stores/pageViewer.svelte';

	const VIEWPORT_KEY = 'sitemap-viewport';
	const { fitBounds, getViewport, setViewport } = useSvelteFlow();

	let lastFocusedId: string | null = null;
	let wasViewerOpen = false;

	// Save/restore viewport around viewer open/close
	$effect(() => {
		const isOpen = pageViewerStore.isOpen;
		if (!wasViewerOpen && isOpen && browser) {
			// Viewer just opened — save current viewport per layout mode
			const key = `${VIEWPORT_KEY}-${sitemapStore.layoutMode}`;
			localStorage.setItem(key, JSON.stringify(getViewport()));
		}
		if (wasViewerOpen && !isOpen && browser) {
			// Viewer just closed — restore saved viewport
			const key = `${VIEWPORT_KEY}-${sitemapStore.layoutMode}`;
			const saved = localStorage.getItem(key);
			if (saved) {
				try {
					setViewport(JSON.parse(saved));
				} catch { /* ignore */ }
				localStorage.removeItem(key);
			}
			// Prevent the focus effect from overriding the restored viewport
			lastFocusedId = sitemapStore.selectedNodeId;
		}
		wasViewerOpen = isOpen;
	});

	// Focus on selected node
	$effect(() => {
		const nodeId = sitemapStore.selectedNodeId;
		if (!nodeId || nodeId === lastFocusedId) return;

		lastFocusedId = nodeId;

		const node = sitemapStore.nodes.find((n) => n.id === nodeId);
		if (!node) return;

		// Use the node's position and a reasonable bounding box
		const width = 384; // w-96 = 384px
		const height = 256; // h-64 = 256px

		fitBounds(
			{
				x: node.position.x - width * 0.5,
				y: node.position.y - height * 0.5,
				width: width * 2,
				height: height * 2
			},
			{ duration: 500 }
		);
	});
</script>
