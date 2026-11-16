<script lang="ts">
	// The sign itself: full screen, nothing but the message. Tap anywhere to stop.
	import { onMount } from 'svelte';
	import { BLINK_MS, COLORS, SPEEDS } from '../presets';
	import { shake } from '../shake.svelte';
	import { store } from '../store.svelte';
	import { keepAwake } from '../wakelock';

	let { messages, onstop }: { messages: string[]; onstop: () => void } = $props();

	/** Pause between playlist messages. */
	const GAP_MS = 350;
	/** How long a playlist message that fits without scrolling stays up. */
	const HOLD_MS = 3000;

	let viewportWidth = $state(window.innerWidth);
	let viewportHeight = $state(window.innerHeight);
	let index = $state(0);
	let inGap = $state(false);
	let blinking = $state(false);
	let textEl = $state<HTMLElement>();
	let stopButton: HTMLButtonElement;
	let gapTimer: ReturnType<typeof setTimeout>;
	let blinkTimer: ReturnType<typeof setTimeout>;

	// The sign always runs along the long edge. Phones cannot be forced into landscape from
	// a web page (iOS never allows it), so in portrait the sign is drawn rotated instead.
	const rotated = $derived(viewportHeight > viewportWidth);
	const width = $derived(rotated ? viewportHeight : viewportWidth);
	const height = $derived(rotated ? viewportWidth : viewportHeight);

	const color = $derived(COLORS.find((c) => c.id === store.color) ?? COLORS[0]);
	const speed = $derived(SPEEDS.find((s) => s.id === store.speed) ?? SPEEDS[1]);
	const isPlaylist = $derived(messages.length > 1);
	const text = $derived(messages[index % messages.length]);
	/** Shown when shaking is not possible, so blinking never depends on the sensor. */
	const needsButton = $derived(shake.status === 'denied' || shake.status === 'unavailable');

	function next() {
		if (inGap) return;
		inGap = true;
		gapTimer = setTimeout(() => {
			index = (index + 1) % messages.length;
			inGap = false;
		}, GAP_MS);
	}

	function blink() {
		blinking = true;
		clearTimeout(blinkTimer);
		blinkTimer = setTimeout(() => (blinking = false), BLINK_MS);
	}

	/** Shake, or its fallback button: blink a single message, skip ahead in a playlist. */
	const trigger = () => (isPlaylist ? next() : blink());

	// Position the message: centred if it fits, otherwise scrolling across.
	$effect(() => {
		const el = textEl;
		if (!el) return;
		void text;
		void height;
		const textWidth = el.offsetWidth;
		el.style.transform = '';

		if (textWidth <= width) {
			el.style.transform = `translateX(${(width - textWidth) / 2}px)`;
			if (!isPlaylist) return;
			const hold = setTimeout(next, HOLD_MS);
			return () => clearTimeout(hold);
		}

		const leftward = store.direction === 'left';
		const scroll = el.animate(
			[
				{ transform: `translateX(${leftward ? width : -textWidth}px)` },
				{ transform: `translateX(${leftward ? -textWidth : width}px)` }
			],
			{
				duration: ((width + textWidth) / (speed.screensPerSecond * width)) * 1000,
				iterations: isPlaylist ? 1 : Infinity,
				fill: 'both'
			}
		);
		scroll.onfinish = next;
		return () => scroll.cancel();
	});

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
	class="fixed inset-0 z-50 overflow-hidden {blinking ? `sign-blink-${store.blink}` : ''}"
	style:--sign-fg={color.fg}
	style:--sign-bg={color.bg}
	style:background-color={color.bg}
	style:color={color.fg}
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
			class="absolute inset-0 cursor-pointer overflow-hidden outline-none"
			aria-label="Stop the sign"
			onclick={onstop}
		>
			{#if !inGap}
				<span
					bind:this={textEl}
					class="sign-text absolute top-0 left-0 font-black whitespace-pre will-change-transform"
					style:font-size="{height * 0.9}px"
					style:line-height="{height}px"
					dir="auto"
				>
					{text}
				</span>
			{/if}
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
