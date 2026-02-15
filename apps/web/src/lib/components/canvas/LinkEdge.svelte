<script lang="ts">
	import {
		BaseEdge,
		getBezierPath,
		getSmoothStepPath,
		useInternalNode,
		type EdgeProps
	} from '@xyflow/svelte';
	import { getEdgeParams, getSimpleEdgeParams } from '$lib/services/layoutEngine';
	import { sitemapStore } from '$lib/stores/sitemap.svelte';

	let {
		id,
		source,
		target,
		markerEnd = undefined,
		selected = false,
		sourceX,
		sourceY,
		targetX,
		targetY,
		sourcePosition,
		targetPosition
	}: EdgeProps = $props();

	const sourceNodeRef = useInternalNode(source);
	const targetNodeRef = useInternalNode(target);

	// Dynamic floating edges for radial (slides along boundary)
	let dynamicParams = $derived.by(() => {
		const sourceNode = sourceNodeRef.current;
		const targetNode = targetNodeRef.current;
		if (sourceNode && targetNode) {
			return getEdgeParams(sourceNode, targetNode);
		}
		return null;
	});

	// Simple floating edges for hierarchical (snaps to cardinal points)
	let simpleParams = $derived.by(() => {
		const sourceNode = sourceNodeRef.current;
		const targetNode = targetNodeRef.current;
		if (sourceNode && targetNode) {
			return getSimpleEdgeParams(sourceNode, targetNode);
		}
		return null;
	});

	let edgeParams = $derived(sitemapStore.layoutMode === 'radial' ? dynamicParams : simpleParams);

	let edgePath = $derived.by(() => {
		if (!edgeParams) return '';
		const pathFunc = sitemapStore.layoutMode === 'radial' ? getBezierPath : getSmoothStepPath;
		const [path] = pathFunc({
			sourceX: edgeParams.sx,
			sourceY: edgeParams.sy,
			sourcePosition: edgeParams.sourcePos,
			targetX: edgeParams.tx,
			targetY: edgeParams.ty,
			targetPosition: edgeParams.targetPos
		});
		return path;
	});

	let edgeStyle = $derived(
		`stroke: ${selected ? '#f97316' : '#94a3b8'}; stroke-width: ${selected ? 2.5 : 1.5};`
	);
</script>

{#if edgeParams}
	<BaseEdge {id} path={edgePath} {markerEnd} style={edgeStyle} />
{/if}
