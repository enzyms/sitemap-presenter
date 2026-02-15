<script lang="ts">
	import { useSvelteFlow } from '@xyflow/svelte';
	import { sitemapStore } from '$lib/stores/sitemap.svelte';

	const { fitBounds } = useSvelteFlow();

	let lastFocusedId: string | null = null;

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
