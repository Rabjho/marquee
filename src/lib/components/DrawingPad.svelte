<script lang="ts">
	// Finger drawing with the bare minimum: one brush, a few inks, undo and clear.
	import { onMount } from 'svelte';
	import { COLORS, DRAWING, INKS } from '../presets';
	import { store, type Drawing, type Stroke } from '../store.svelte';

	let {
		drawing,
		onsave,
		oncancel
	}: {
		drawing?: Drawing;
		onsave: (drawing: Drawing) => void;
		oncancel: () => void;
	} = $props();

	// svelte-ignore state_referenced_locally
	let strokes = $state<Stroke[]>(drawing ? [...drawing.strokes] : []);
	/** The stroke under the finger right now. */
	let current = $state<Stroke | null>(null);
	let inkId = $state<(typeof INKS)[number]['id']>('sign');
	let canvas: SVGSVGElement;

	const sign = $derived(COLORS.find((c) => c.id === store.color) ?? COLORS[0]);
	const ink = $derived(INKS.find((i) => i.id === inkId) ?? INKS[0]);

	/** Pointer position in canvas units, kept inside the canvas. */
	function point(event: PointerEvent) {
		const box = canvas.getBoundingClientRect();
		const clamp = (value: number, max: number) => Math.min(Math.max(value, 0), max).toFixed(1);
		const x = clamp(((event.clientX - box.left) / box.width) * DRAWING.width, DRAWING.width);
		const y = clamp(((event.clientY - box.top) / box.height) * DRAWING.height, DRAWING.height);
		return `${x} ${y}`;
	}

	function start(event: PointerEvent) {
		canvas.setPointerCapture(event.pointerId);
		const at = point(event);
		// Move then line to the same spot, so a single tap leaves a dot.
		current = { color: ink.value, d: `M${at}L${at}` };
	}

	function move(event: PointerEvent) {
		if (current) current.d += `L${point(event)}`;
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
			viewBox="0 0 {DRAWING.width} {DRAWING.height}"
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
			{#each current ? [...strokes, current] : strokes as stroke, i (i)}
				<path d={stroke.d} stroke={stroke.color ?? 'currentColor'} />
			{/each}
		</svg>

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
				onclick={() => onsave({ strokes: $state.snapshot(strokes) })}
			>
				Done
			</button>
		</div>
	</div>
</div>
