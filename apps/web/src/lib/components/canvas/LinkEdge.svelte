<script lang="ts">
	import {
		BaseEdge,
		getBezierPath,
		getSmoothStepPath,
		Position,
		useInternalNode,
		type EdgeProps
	} from '@xyflow/svelte';
	import { getEdgeParams, NODE_WIDTH, NODE_HEIGHT } from '$lib/services/layoutEngine';
	import { sitemapStore } from '$lib/stores/sitemap';

	let {
		id,
		source,
		target,
		markerEnd = undefined,
		selected = false,
		// These are required by EdgeProps but we calculate our own positions
		sourceX,
		sourceY,
		targetX,
		targetY,
		sourcePosition,
		targetPosition
	}: EdgeProps = $props();

	// Get internal nodes - returns object with .current property in v1.x
	const sourceNodeRef = useInternalNode(source);
	const targetNodeRef = useInternalNode(target);
	const layoutMode = sitemapStore.layoutMode;

	// Floating edges for radial layout (connects to closest boundary)
	let floatingEdgeParams = $derived.by(() => {
		const sourceNode = sourceNodeRef.current;
		const targetNode = targetNodeRef.current;
		if (sourceNode && targetNode) {
			return getEdgeParams(sourceNode, targetNode);
		}
		return null;
	});

	// Simple edges for hierarchical layout (bottom of parent → top of child)
	let simpleEdgeParams = $derived.by(() => {
		const sourceNode = sourceNodeRef.current;
		const targetNode = targetNodeRef.current;
		if (sourceNode && targetNode) {
			return {
				sx: sourceNode.position.x + (sourceNode.measured?.width ?? NODE_WIDTH) / 2,
				sy: sourceNode.position.y + (sourceNode.measured?.height ?? NODE_HEIGHT),
				tx: targetNode.position.x + (targetNode.measured?.width ?? NODE_WIDTH) / 2,
				ty: targetNode.position.y,
				sourcePos: Position.Bottom,
				targetPos: Position.Top
			};
		}
		return null;
	});

	// Use floating edges for radial, simple edges for hierarchical
	let edgeParams = $derived($layoutMode === 'radial' ? floatingEdgeParams : simpleEdgeParams);

	// Use bezier for radial, smoothstep for hierarchical
	let edgePath = $derived.by(() => {
		if (!edgeParams) return '';
		const pathFunc = $layoutMode === 'radial' ? getBezierPath : getSmoothStepPath;
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
