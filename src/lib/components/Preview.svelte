<script lang="ts">
	// A miniature of the sign with the shape of this device's screen, so size, speed,
	// color and blink look the way they will after tapping Go.
	import type { Item } from '../store.svelte';
	import Sign from './Sign.svelte';

	let { item, blinking }: { item: Item; blinking: boolean } = $props();

	let width = $state(0);
	let scrolls = $state(false);

	const ratio = Math.min(Math.max(screen.width, screen.height) / Math.min(screen.width, screen.height), 2.4);
	const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
</script>

<div
	class="overflow-hidden rounded-lg border border-line-strong"
	bind:clientWidth={width}
	aria-hidden="true"
>
	{#if width}
		<Sign {item} {width} height={Math.round(width / ratio)} {blinking} still={reducedMotion} bind:scrolls />
	{/if}
</div>
{#if !scrolls}
	<p class="mt-2 text-fg-muted">This fits, so it stays still. Longer ones scroll.</p>
{/if}
