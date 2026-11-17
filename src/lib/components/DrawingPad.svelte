<script lang="ts">
	// Finger drawing with the bare minimum: one brush, undo and clear. The color picker below
	// the pad is the pen.
	// The drawing is a long strip. The pad shows one stretch of it; two fingers drag it along,
	// and it scrolls by itself while a stroke is held near either edge.
	// What is drawn goes straight into the store, where Go picks it up.
	import { pathData, type Stroke } from '../drawing';
	import { DRAWING } from '../presets';
	import { store } from '../store.svelte';
	import { secondary } from '../ui';

	/** How far one press of an arrow key moves along the strip. */
	const STEP = DRAWING.view / 4;
	/** The share of the pad's width at each side where a held stroke scrolls the pad. */
	const EDGE = 0.15;
	/** Scroll speed with the finger right at the edge, in strip units per second. */
	const EDGE_SPEED = DRAWING.view;
	/** The stroke under the finger right now. */
	let current = $state<Stroke | null>(null);
	/** Left edge of the stretch shown in the pad. */
	let offset = $state(0);
	let canvas: SVGSVGElement;
	/** Fingers on the pad right now, and where each one is across the screen. */
	const fingers = new Map<number, number>();
	/** Two fingers move the strip; it stays that way until every finger has lifted. */
	let panning = false;
	let minimap: SVGSVGElement;
	let minimapWidth = $state(0);
	let minimapHeight = $state(0);
	/** A drag on the miniature: where it began, and strip units per screen pixel. */
	let grab: { x: number; offset: number; scale: number } | null = null;

	const sign = $derived(store.colors);
	const all = $derived(current ? [...store.sketch, current] : store.sketch);
	/** The length of the strip so far: what has been drawn, or where the pad is, whichever is further. */
	const length = $derived(
		Math.max(offset + DRAWING.view, ...all.flatMap((s) => s.points.filter((_, i) => i % 2 === 0)))
	);

	/**
	 * How much of the strip the miniature shows: all of it plus one pad's worth of empty
	 * room to drag into, and at least enough to fill the miniature at full height.
	 */
	const span = $derived(
		Math.max(
			length + DRAWING.view,
			minimapHeight ? (minimapWidth / minimapHeight) * DRAWING.height : 0
		)
	);

	/** Pointer position on the strip, kept inside the visible stretch. */
	function point(event: PointerEvent): [number, number] {
		const box = canvas.getBoundingClientRect();
		const within = (value: number, max: number) => Math.min(Math.max(value, 0), max);
		const x = within(((event.clientX - box.left) / box.width) * DRAWING.view, DRAWING.view);
		const y = within(((event.clientY - box.top) / box.height) * DRAWING.height, DRAWING.height);
		return [Math.round((offset + x) * 10) / 10, Math.round(y * 10) / 10];
	}

	const clampOffset = (value: number) => Math.min(Math.max(value, 0), DRAWING.maxWidth - DRAWING.view);

	function pan(units: number) {
		offset = clampOffset(offset + units);
	}

	const middle = () => [...fingers.values()].reduce((sum, x) => sum + x, 0) / fingers.size;

	function start(event: PointerEvent) {
		canvas.setPointerCapture(event.pointerId);
		fingers.set(event.pointerId, event.clientX);
		if (fingers.size === 1) {
			current = { color: store.pen, points: point(event) };
			followEdge(event);
		} else {
			// A second finger means dragging, so the mark the first one began is dropped.
			current = null;
			panning = true;
		}
	}

	function move(event: PointerEvent) {
		if (!fingers.has(event.pointerId)) return;
		if (!panning) {
			current?.points.push(...point(event));
			if (current) followEdge(event);
			return;
		}
		const before = middle();
		fingers.set(event.pointerId, event.clientX);
		pan(((before - middle()) / canvas.getBoundingClientRect().width) * DRAWING.view);
	}

	function end(event: PointerEvent) {
		fingers.delete(event.pointerId);
		if (fingers.size > 0) return;
		if (current && !panning) store.sketch.push($state.snapshot(current));
		current = null;
		panning = false;
		lastPointer = null;
	}

	/** Where the drawing finger last was, while a stroke is going. */
	let lastPointer: PointerEvent | null = null;
	let edgeFrame = 0;

	/**
	 * While a stroke is held near an edge, the pad keeps scrolling that way and the stroke
	 * follows, so one stroke can run as long as the finger stays down.
	 */
	function followEdge(event: PointerEvent) {
		lastPointer = event;
		if (edgeFrame) return;
		let last = performance.now();
		const step = (now: number) => {
			edgeFrame = 0;
			if (!current || panning || !lastPointer) return;
			const box = canvas.getBoundingClientRect();
			const at = (lastPointer.clientX - box.left) / box.width;
			const push = at > 1 - EDGE ? Math.min((at - (1 - EDGE)) / EDGE, 1) : at < EDGE ? -Math.min((EDGE - at) / EDGE, 1) : 0;
			if (push === 0 || (push < 0 && offset === 0)) return;
			pan((push * EDGE_SPEED * Math.min(now - last, 50)) / 1000);
			last = now;
			current.points.push(...point(lastPointer));
			edgeFrame = requestAnimationFrame(step);
		};
		edgeFrame = requestAnimationFrame(step);
	}

	/**
	 * The miniature works like a scrollbar: pressing outside the marked stretch jumps there,
	 * and dragging moves the pad along with the finger, out into empty room if need be.
	 */
	function minimapStart(event: PointerEvent) {
		minimap.setPointerCapture(event.pointerId);
		const box = minimap.getBoundingClientRect();
		// The miniature is fitted by height or width, whichever runs out first ("meet").
		const scale = Math.max(span / box.width, DRAWING.height / box.height);
		const x = (event.clientX - box.left) * scale;
		if (x < offset || x > offset + DRAWING.view) offset = clampOffset(x - DRAWING.view / 2);
		grab = { x: event.clientX, offset, scale };
	}

	function minimapMove(event: PointerEvent) {
		if (grab) offset = clampOffset(grab.offset + (event.clientX - grab.x) * grab.scale);
	}

	/** Arrow keys move the strip too, for when there is no touch screen. */
	function key(event: KeyboardEvent) {
		if (event.key === 'ArrowRight') pan(STEP);
		else if (event.key === 'ArrowLeft') pan(-STEP);
	}

</script>

<div class="flex flex-col gap-4">
	<!-- The canvas is a drawing surface, so it takes pointer and key input by design. -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
	<svg
		bind:this={canvas}
		class="aspect-3/2 w-full cursor-crosshair touch-none rounded-lg border border-line-strong"
		viewBox="{offset} 0 {DRAWING.view} {DRAWING.height}"
		style:background-color={sign.bg}
		style:color={store.base}
		fill="none"
		stroke-width={DRAWING.brush}
		stroke-linecap="round"
		stroke-linejoin="round"
		role="application"
		aria-label="Drawing canvas"
		tabindex="0"
		onkeydown={key}
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
		<!-- Pressing or dragging on it moves the pad; the arrow keys do the same on the canvas. -->
		<svg
			bind:this={minimap}
			bind:clientWidth={minimapWidth}
			bind:clientHeight={minimapHeight}
			class="h-12 w-full cursor-grab touch-none rounded-lg bg-surface active:cursor-grabbing"
			viewBox="0 0 {span} {DRAWING.height}"
			preserveAspectRatio="xMinYMid meet"
			style:color={store.base}
			fill="none"
			stroke-width={DRAWING.brush}
			stroke-linecap="round"
			stroke-linejoin="round"
			aria-hidden="true"
			onpointerdown={minimapStart}
			onpointermove={minimapMove}
			onpointerup={() => (grab = null)}
			onpointercancel={() => (grab = null)}
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
		<p class="text-fg-muted">For more room, drag this strip or the pad with two fingers.</p>
	</div>

	<div class="grid grid-cols-2 gap-2">
		<button type="button" class={secondary} disabled={store.sketch.length === 0} onclick={() => store.sketch.pop()}>
			Undo
		</button>
		<button type="button" class={secondary} disabled={store.sketch.length === 0} onclick={() => (store.sketch = [])}>
			Clear
		</button>
	</div>
</div>
