<script lang="ts">
	// Renders a stored drawing at any height. Strokes in the sign color use currentColor.
	import { DRAWING } from '../presets';
	import type { Drawing } from '../store.svelte';

	let { drawing, height }: { drawing: Drawing; height: number } = $props();
</script>

<svg
	class="block"
	viewBox="0 0 {DRAWING.width} {DRAWING.height}"
	width={(height * DRAWING.width) / DRAWING.height}
	{height}
	fill="none"
	stroke-width={DRAWING.brush}
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
>
	{#each drawing.strokes as stroke, i (i)}
		<path d={stroke.d} stroke={stroke.color ?? 'currentColor'} />
	{/each}
</svg>
