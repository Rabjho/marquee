<script lang="ts">
	// The sign itself: full screen, nothing but the message. Tap anywhere to stop.
	import { onMount } from 'svelte';
	import { blinkMs, COLORS } from '../presets';
	import { shake } from '../shake.svelte';
	import { store, type Item } from '../store.svelte';
	import { keepAwake } from '../wakelock';
	import Sign from './Sign.svelte';

	let { items, onstop }: { items: Item[]; onstop: () => void } = $props();

	/** Pause between playlist entries. */
	const GAP_MS = 350;

	let viewportWidth = $state(window.innerWidth);
	let viewportHeight = $state(window.innerHeight);
	let index = $state(0);
	let inGap = $state(false);
	let blinking = $state(false);
	let stopButton: HTMLButtonElement;
	let gapTimer: ReturnType<typeof setTimeout>;
	let blinkTimer: ReturnType<typeof setTimeout>;

	// The sign always runs along the long edge. Phones cannot be forced into landscape from
	// a web page (iOS never allows it), so in portrait the sign is drawn rotated instead.
	const rotated = $derived(viewportHeight > viewportWidth);
	const width = $derived(rotated ? viewportHeight : viewportWidth);
	const height = $derived(rotated ? viewportWidth : viewportHeight);

	// Extra-bright mode is always white on black.
	const color = $derived(store.hdr ? COLORS[0] : store.colors);
	const isPlaylist = $derived(items.length > 1);
	const item = $derived(items[index % items.length]);
	/** Shown when shaking is not possible, so blinking never depends on the sensor. */
	const needsButton = $derived(shake.status === 'denied' || shake.status === 'unavailable');

	function next() {
		if (inGap) return;
		inGap = true;
		gapTimer = setTimeout(() => {
			index = (index + 1) % items.length;
			inGap = false;
		}, GAP_MS);
	}

	function blink() {
		blinking = true;
		clearTimeout(blinkTimer);
		blinkTimer = setTimeout(() => (blinking = false), blinkMs(store.blinkRate));
	}

	/** Shake, or its fallback button: blink a single message, skip ahead in a playlist. */
	const trigger = () => (isPlaylist ? next() : blink());

	onMount(() => {
		stopButton.focus();
		keepAwake(true);
		shake.onshake = trigger;

		// Where the browser allows it (Android), go full screen and turn to landscape.
		const orientation = screen.orientation as ScreenOrientation & {
			lock?: (orientation: string) => Promise<void>;
		};
		document.documentElement
			.requestFullscreen?.()
			.then(() => orientation.lock?.('landscape'))
			.catch(() => {});
		// Leaving full screen (the back gesture) also stops the sign.
		const onFullscreenChange = () => {
			if (!document.fullscreenElement) onstop();
		};
		document.addEventListener('fullscreenchange', onFullscreenChange);

		return () => {
			document.removeEventListener('fullscreenchange', onFullscreenChange);
			if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
			shake.onshake = null;
			keepAwake(false);
			clearTimeout(gapTimer);
			clearTimeout(blinkTimer);
		};
	});
</script>

<svelte:window
	bind:innerWidth={viewportWidth}
	bind:innerHeight={viewportHeight}
	onkeydown={(event) => event.key === 'Escape' && onstop()}
/>

<div
	class="fixed inset-0 z-50 overflow-hidden"
	style:background-color={color.bg}
	role="dialog"
	aria-modal="true"
	aria-label="Sign playing"
>
	<div
		class="absolute top-0 left-0 origin-top-left"
		style:width="{width}px"
		style:height="{height}px"
		style:transform={rotated ? `translateX(${viewportWidth}px) rotate(90deg)` : null}
	>
		<button
			bind:this={stopButton}
			class="absolute inset-0 cursor-pointer outline-none"
			aria-label="Stop the sign"
			onclick={onstop}
		>
			<Sign item={inGap ? null : item} {width} {height} {blinking} loop={!isPlaylist} onend={next} />
		</button>

		{#if needsButton}
			<button
				class="absolute right-4 bottom-4 min-h-14 cursor-pointer rounded-lg border-2 px-6 text-xl font-bold"
				style:border-color={color.fg}
				style:background-color={color.bg}
				style:color={color.fg}
				onclick={trigger}
			>
				{isPlaylist ? 'Next' : 'Blink'}
			</button>
		{/if}
	</div>
</div>
