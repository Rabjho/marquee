<script lang="ts">
	// Finger drawing with the bare minimum: one brush, a few inks, undo and clear.
	// The drawing is a long strip. The pad shows one stretch of it, and the arrows move along.
	import { onMount } from 'svelte';
	import { pathData, trimmed, type Drawing, type Stroke } from '../drawing';
	import { COLORS, DRAWING, INKS } from '../presets';
	import { store } from '../store.svelte';

	let {
		drawing,
		onsave,
		oncancel
	}: {
		drawing?: Drawing;
		onsave: (drawing: Drawing) => void;
		oncancel: () => void;
	} = $props();

	/** How far one tap on an arrow moves along the strip. */
	const STEP = DRAWING.view / 2;

	// svelte-ignore state_referenced_locally
	let strokes = $state<Stroke[]>(drawing ? $state.snapshot(drawing.strokes) : []);
	/** The stroke under the finger right now. */
	let current = $state<Stroke | null>(null);
	let inkId = $state<(typeof INKS)[number]['id']>('sign');
	/** Left edge of the stretch shown in the pad. */
	let offset = $state(0);
	let canvas: SVGSVGElement;

	const sign = $derived(COLORS.find((c) => c.id === store.color) ?? COLORS[0]);
	const ink = $derived(INKS.find((i) => i.id === inkId) ?? INKS[0]);
	const all = $derived(current ? [...strokes, current] : strokes);
	/** The length of the strip so far: what has been drawn, or where the pad is, whichever is further. */
	const length = $derived(
		Math.max(offset + DRAWING.view, ...all.flatMap((s) => s.points.filter((_, i) => i % 2 === 0)))
	);

	/** Pointer position on the strip, kept inside the visible stretch. */
	function point(event: PointerEvent): [number, number] {
		const box = canvas.getBoundingClientRect();
		const within = (value: number, max: number) => Math.min(Math.max(value, 0), max);
		const x = within(((event.clientX - box.left) / box.width) * DRAWING.view, DRAWING.view);
		const y = within(((event.clientY - box.top) / box.height) * DRAWING.height, DRAWING.height);
		return [Math.round((offset + x) * 10) / 10, Math.round(y * 10) / 10];
	}

	function start(event: PointerEvent) {
		canvas.setPointerCapture(event.pointerId);
		current = { color: ink.value, points: point(event) };
	}

	function move(event: PointerEvent) {
		current?.points.push(...point(event));
	}

	function end() {
		if (current) strokes.push(current);
		current = null;
	}

	onMount(() => canvas.focus());

	const secondary =
		'min-h-14 cursor-pointer rounded-lg border border-line-strong px-4 text-lg font-semibold active:bg-surface disabled:opacity-40';
</script>

<svelte:window onkeydown={(event) => event.key === 'Escape' && oncancel()} />

<div
	class="fixed inset-0 z-50 overflow-y-auto bg-bg"
	role="dialog"
	aria-modal="true"
	aria-labelledby="draw-title"
>
	<div class="mx-auto flex w-full max-w-md flex-col gap-4 px-4 pt-4 pb-12">
		<h2 id="draw-title" class="font-semibold text-fg-muted">Draw with your finger</h2>

		<svg
			bind:this={canvas}
			class="aspect-3/2 w-full cursor-crosshair touch-none rounded-lg border border-line-strong outline-none"
			viewBox="{offset} 0 {DRAWING.view} {DRAWING.height}"
			style:background-color={sign.bg}
			style:color={sign.fg}
			fill="none"
			stroke-width={DRAWING.brush}
			stroke-linecap="round"
			stroke-linejoin="round"
			role="img"
			aria-label="Drawing canvas"
			tabindex="-1"
			onpointerdown={start}
			onpointermove={move}
			onpointerup={end}
			onpointercancel={end}
		>
			{#each all as stroke, i (i)}
				<path d={pathData(stroke.points)} stroke={stroke.color ?? 'currentColor'} />
			{/each}
		</svg>

		<!-- The whole strip in miniature, with the stretch shown above marked on it. -->
		<div class="flex flex-col gap-2">
			<svg
				class="h-10 w-full rounded-lg bg-surface"
				viewBox="0 0 {length} {DRAWING.height}"
				preserveAspectRatio="xMinYMid meet"
				style:color={sign.fg}
				fill="none"
				stroke-width={DRAWING.brush}
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<rect width={length} height={DRAWING.height} fill={sign.bg} stroke="none" />
				{#each all as stroke, i (i)}
					<path d={pathData(stroke.points)} stroke={stroke.color ?? 'currentColor'} />
				{/each}
				<rect
					x={offset + 2}
					y="2"
					width={DRAWING.view - 4}
					height={DRAWING.height - 4}
					stroke="var(--color-brand)"
					stroke-width="4"
					stroke-linecap="butt"
				/>
			</svg>
			<div class="grid grid-cols-2 gap-2">
				<button
					class={secondary}
					disabled={offset === 0}
					onclick={() => (offset = Math.max(offset - STEP, 0))}
				>
					← Back
				</button>
				<button
					class={secondary}
					disabled={offset + DRAWING.view >= DRAWING.maxWidth}
					onclick={() => (offset += STEP)}
				>
					More room →
				</button>
			</div>
		</div>

		<fieldset>
			<legend class="mb-2 font-semibold text-fg-muted">Ink</legend>
			<div class="grid auto-cols-fr grid-flow-col gap-2">
				{#each INKS as option (option.id)}
					<label
						class="relative flex min-h-14 cursor-pointer items-center justify-center rounded-lg border border-line-strong text-2xl font-black has-checked:border-4 has-checked:border-fg has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus"
						style:background-color={sign.bg}
						style:color={option.value ?? sign.fg}
					>
						<input
							class="absolute inset-0 cursor-pointer opacity-0"
							type="radio"
							name="ink"
							value={option.id}
							bind:group={inkId}
						/>
						<span aria-hidden="true">{inkId === option.id ? '✓' : '●'}</span>
						<span class="sr-only">{option.label}</span>
					</label>
				{/each}
			</div>
		</fieldset>

		<div class="grid grid-cols-2 gap-2">
			<button class={secondary} disabled={strokes.length === 0} onclick={() => strokes.pop()}>
				Undo
			</button>
			<button class={secondary} disabled={strokes.length === 0} onclick={() => (strokes = [])}>
				Clear
			</button>
		</div>

		<div class="grid grid-cols-2 gap-2">
			<button class={secondary} onclick={oncancel}>Cancel</button>
			<button
				class="min-h-14 cursor-pointer rounded-lg bg-brand px-4 text-lg font-black text-on-brand hover:bg-brand-hover active:bg-brand-hover disabled:opacity-40"
				disabled={strokes.length === 0}
				onclick={() => onsave(trimmed($state.snapshot(strokes)))}
			>
				Done
			</button>
		</div>
	</div>
</div>
