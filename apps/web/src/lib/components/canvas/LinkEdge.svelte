<script lang="ts">
	import { BaseEdge, getSmoothStepPath, type EdgeProps } from '@xyflow/svelte';

	type $$Props = EdgeProps;

	export let id: $$Props['id'];
	export let sourceX: $$Props['sourceX'];
	export let sourceY: $$Props['sourceY'];
	export let targetX: $$Props['targetX'];
	export let targetY: $$Props['targetY'];
	export let sourcePosition: $$Props['sourcePosition'];
	export let targetPosition: $$Props['targetPosition'];
	export let selected: $$Props['selected'] = false;
	export let markerEnd: $$Props['markerEnd'] = undefined;

	$: [edgePath] = getSmoothStepPath({
		sourceX,
		sourceY,
		sourcePosition,
		targetX,
		targetY,
		targetPosition
	});
</script>

<BaseEdge
	{id}
	path={edgePath}
	{markerEnd}
	style="stroke: {selected ? '#3b82f6' : '#94a3b8'}; stroke-width: {selected ? 2 : 1};"
/>
