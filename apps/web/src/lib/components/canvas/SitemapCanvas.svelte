<script lang="ts">
	import {
		SvelteFlow,
		Controls,
		MiniMap,
		Background,
		BackgroundVariant,
		MarkerType,
		type NodeTypes,
		type EdgeTypes
	} from '@xyflow/svelte';
	import '@xyflow/svelte/dist/style.css';

	import PageNode from './PageNode.svelte';
	import LinkEdge from './LinkEdge.svelte';
	import { sitemapStore } from '$lib/stores/sitemap';

	// Cast to any to avoid Svelte 4/5 component type mismatch
	const nodeTypes: NodeTypes = {
		page: PageNode as any
	};

	const edgeTypes: EdgeTypes = {
		smoothstep: LinkEdge as any
	};

	const nodes = sitemapStore.nodes;
	const edges = sitemapStore.edges;

	function handleViewportChange(event: CustomEvent) {
		const viewport = event.detail.viewport;
		if (viewport?.zoom !== undefined) {
			sitemapStore.setZoomLevel(viewport.zoom);
		}
	}

	function handleNodeClick(event: CustomEvent) {
		const nodeId = event.detail.node?.id;
		if (nodeId) {
			sitemapStore.selectNode(nodeId);
		}
	}

	function handlePaneClick() {
		sitemapStore.selectNode(null);
	}

	function getNodeColor(node: { data?: { depth?: number } }): string {
		const depth = node.data?.depth ?? 0;
		const colors = ['#3b82f6', '#22c55e', '#eab308', '#f97316', '#ef4444'];
		return colors[Math.min(depth, colors.length - 1)];
	}
</script>

<div class="w-full h-full">
	<SvelteFlow
		{nodeTypes}
		{edgeTypes}
		{nodes}
		{edges}
		fitView
		defaultEdgeOptions={{
			type: 'smoothstep',
			animated: false,
			markerEnd: {
				type: MarkerType.ArrowClosed,
				color: '#94a3b8'
			}
		}}
		minZoom={0.1}
		maxZoom={2}
		on:nodeclick={handleNodeClick}
		on:paneclick={handlePaneClick}
		on:viewportchange={handleViewportChange}
	>
		<Controls />
		<MiniMap nodeColor={getNodeColor} maskColor="rgb(0, 0, 0, 0.1)" />
		<Background variant={BackgroundVariant.Dots} gap={20} size={1} />
	</SvelteFlow>
</div>
