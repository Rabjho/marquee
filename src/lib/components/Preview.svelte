<script lang="ts">
	// A miniature of the sign with the shape of this device's screen, so size, speed,
	// color and blink look the way they will after tapping Go.
	import type { Item } from '../store.svelte';
	import Sign from './Sign.svelte';

	let { items, blinking }: { items: Item[]; blinking: boolean } = $props();

	/** A playlist plays through, one entry after another, like on the sign. */
	let index = $state(0);
	const item = $derived(items.length ? items[index % items.length] : null);

	let width = $state(0);

	const ratio = Math.min(Math.max(screen.width, screen.height) / Math.min(screen.width, screen.height), 2.4);
	const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
</script>

<div
	class="overflow-hidden rounded-lg border border-line-strong"
	bind:clientWidth={width}
	aria-hidden="true"
>
	{#if width}
		<Sign {item} loop={items.length < 2} onend={() => index++} {width} height={Math.round(width / ratio)} {blinking} still={reducedMotion} />
	{/if}
</div>
