<script lang="ts">
	// The sign surface at any size: used full screen by Stage and in miniature by Preview.
	// Everything is relative to the given width and height, so the miniature is faithful.
	import { COLORS, SIZES, SPEEDS } from '../presets';
	import { store, type Item } from '../store.svelte';
	import DrawingView from './DrawingView.svelte';

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

	/** How long a message that fits without scrolling stays up before `onend`. */
	const HOLD_MS = 3000;

	let contentEl = $state<HTMLElement>();

	const color = $derived(COLORS.find((c) => c.id === store.color) ?? COLORS[0]);
	const speed = $derived(SPEEDS.find((s) => s.id === store.speed) ?? SPEEDS[1]);
	const size = $derived(SIZES.find((s) => s.id === store.size) ?? SIZES[0]);

	// Position the message: centred if it fits, otherwise scrolling across.
	$effect(() => {
		const el = contentEl;
		if (!el) return;
		void item?.text;
		void item?.drawing;
		void height;
		void size;
		const textWidth = el.offsetWidth;
		const fits = textWidth <= width;
		scrolls = !fits;
		el.style.transform = fits ? `translateX(${(width - textWidth) / 2}px)` : '';

		if (fits || still) {
			if (loop) return;
			const hold = setTimeout(() => onend?.(), HOLD_MS);
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
				iterations: loop ? Infinity : 1,
				fill: 'both'
			}
		);
		scroll.onfinish = () => onend?.();
		return () => scroll.cancel();
	});
</script>

<span
	class="relative block overflow-hidden {blinking ? `sign-blink-${store.blink}` : ''}"
	style:width="{width}px"
	style:height="{height}px"
	style:--sign-fg={color.fg}
	style:--sign-bg={color.bg}
	style:background-color={color.bg}
	style:color={color.fg}
>
	{#if item}
		{@const contentHeight = height * size.scale}
		<span
			bind:this={contentEl}
			class="sign-text absolute left-0 block font-black whitespace-pre will-change-transform"
			style:top="{item.drawing ? (height - contentHeight) / 2 : 0}px"
			style:font-size="{contentHeight}px"
			style:line-height="{height}px"
			dir="auto"
			>{#if item.drawing}<DrawingView drawing={item.drawing} height={contentHeight} />{:else}{item.text}{/if}</span
		>
	{/if}
</span>
