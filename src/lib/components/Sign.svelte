<script lang="ts">
	// The sign surface at any size: used full screen by Stage and in miniature by Preview.
	// The drawing itself is done by SignRenderer; this component feeds it the settings.
	import { onMount } from 'svelte';
	import { SIZES } from '../presets';
	import { SignRenderer, type Settings } from '../renderer';
	import { store, type Item } from '../store.svelte';

	let {
		item,
		width,
		height,
		blinking = false,
		loop = true,
		still = false,
		onend,
		scrolls = $bindable(false)
	}: {
		/** The message or drawing to show, or null for a blank sign. */
		item: Item | null;
		width: number;
		height: number;
		blinking?: boolean;
		/** Repeat forever. When false, `onend` is called after one pass. */
		loop?: boolean;
		/** Never scroll (reduced motion). */
		still?: boolean;
		onend?: () => void;
		/** Whether the message is too long to fit and therefore scrolls. */
		scrolls?: boolean;
	} = $props();

	let canvas: HTMLCanvasElement;
	let renderer = $state.raw<SignRenderer>();
	let video = $state<HTMLVideoElement>();
	let videoFailed = $state(false);

	const color = $derived(store.colors);
	const settings = $derived<Settings>({
		fg: color.fg,
		bg: color.bg,
		scale: (SIZES.find((s) => s.id === store.size) ?? SIZES[0]).scale,
		speed: store.speed,
		leftward: store.direction === 'left',
		look: store.look,
		frame: store.frame,
		hdr: store.hdr,
		blink: store.blink,
		blinkRate: store.blinkRate
	});

	onMount(() => {
		const created = new SignRenderer(canvas, settings);
		created.onend = () => onend?.();
		created.onscrolls = (value) => (scrolls = value);
		created.start();
		renderer = created;
		return () => created.stop();
	});

	$effect(() => {
		if (renderer) renderer.settings = settings;
	});
	$effect(() => {
		if (renderer) renderer.item = item;
	});
	$effect(() => {
		const ratio = Math.min(devicePixelRatio, 3);
		renderer?.resize(Math.round(width * ratio), Math.round(height * ratio));
	});
	$effect(() => {
		if (!renderer) return;
		renderer.blinking = blinking;
		renderer.loop = loop;
		renderer.still = still;
	});

	// The HDR video only brightens the screen while it is actually playing. If it cannot
	// play (unsupported, or autoplay blocked by Low Power Mode) the HDR image stays in its place.
	$effect(() => {
		video?.play().catch(() => (videoFailed = true));
	});
</script>

<span
	class="relative block overflow-hidden"
	style:width="{width}px"
	style:height="{height}px"
	style:background-color={store.hdr ? '#000' : color.bg}
>
	{#if store.hdr}
		<img class="hdr-source absolute inset-0 size-full" src="/hdr-white.avif" alt="" />
		{#if !videoFailed}
			<video
				bind:this={video}
				class="hdr-source absolute inset-0 size-full object-fill"
				src="/hdr-white.mp4"
				muted
				loop
				playsinline
				autoplay
				disablepictureinpicture
				onerror={() => (videoFailed = true)}
			></video>
		{/if}
	{/if}
	<canvas bind:this={canvas} class="absolute inset-0 size-full"></canvas>
</span>
