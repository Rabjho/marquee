<script lang="ts">
	// Renders a stored drawing at any height. Strokes in the sign color use currentColor.
	import { pathData, type Drawing } from '../drawing';
	import { DRAWING } from '../presets';

	let { drawing, height }: { drawing: Drawing; height: number } = $props();
</script>

<svg
	class="block"
	viewBox="0 0 {drawing.width} {DRAWING.height}"
	width={(height * drawing.width) / DRAWING.height}
	{height}
	fill="none"
	stroke-width={DRAWING.brush}
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
>
	{#each drawing.strokes as stroke, i (i)}
		<path d={pathData(stroke.points)} stroke={stroke.color ?? 'currentColor'} />
	{/each}
</svg>
