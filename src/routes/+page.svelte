<script lang="ts">
	import { onMount, tick } from 'svelte';
	import Choice from '../lib/components/Choice.svelte';
	import DrawingPad from '../lib/components/DrawingPad.svelte';
	import Preview from '../lib/components/Preview.svelte';
	import SavedList from '../lib/components/SavedList.svelte';
	import Slider from '../lib/components/Slider.svelte';
	import Stage from '../lib/components/Stage.svelte';
	import {
		BLINK_RATE,
		blinkMs,
		BLINKS,
		COLORS,
		DIRECTIONS,
		FRAMES,
		LOOKS,
		SIZES,
		SPEED,
		STICKERS
	} from '../lib/presets';
	import { shake } from '../lib/shake.svelte';
	import { clean, hasContent, store, toItem, type Drawing, type Entry, type Item } from '../lib/store.svelte';

	/** What is on the sign right now, or null while editing. */
	let playing = $state<Item[] | null>(null);
	/** The drawing pad, when open: for a new drawing (id null) or a saved one. */
	let drawing = $state<{ id: string | null; drawing?: Drawing } | null>(null);
	let notice = $state('');
	let showInstallHint = $state(false);
	let showQr = $state(false);
	/** The QR library, loaded the first time a code is asked for to keep the first load small. */
	let qrcode = $state.raw<typeof import('qrcode-generator') | null>(null);
	let input = $state<HTMLTextAreaElement>()!;
	/** Bumped on every Go, which replaces the text box with a fresh one. See `play`. */
	let textBoxKey = $state(0);
	let previewBlinking = $state(false);
	let previewBlinkTimer: ReturnType<typeof setTimeout>;

	/** Shows the chosen blink style in the preview for as long as a real blink lasts. */
	function demoBlink() {
		previewBlinking = true;
		clearTimeout(previewBlinkTimer);
		previewBlinkTimer = setTimeout(() => (previewBlinking = false), blinkMs(store.blinkRate));
	}

	// It remembers: every change is saved as it happens.
	$effect(() => store.save());

	/**
	 * A shared link carries its message as /#t=HELLO. It sits after the # so that it stays
	 * on the device: that part of a URL is never sent to the server or written to its logs.
	 */
	function readSharedLink() {
		const shared = clean(new URLSearchParams(location.hash.slice(1)).get('t') ?? '');
		if (!shared) return;
		store.draft = shared;
		store.stopEditing();
	}

	onMount(() => {
		readSharedLink();
		// iOS has no install prompt. `navigator.standalone` only exists there.
		showInstallHint = 'standalone' in navigator && !navigator.standalone;
		input.focus();
	});

	function play(entries: Pick<Entry, 'text' | 'drawing'>[]) {
		const items = entries.filter(hasContent).map(toItem);
		if (items.length === 0) {
			input.focus();
			return;
		}
		// Asked from inside the tap, as iOS requires for the motion permission prompt.
		shake.start();
		notice = '';
		// iOS offers "Undo Typing" when the phone is shaken and a text box has typing to undo.
		// A page cannot switch that off, so the text box is swapped for a fresh one with no history.
		textBoxKey++;
		playing = items;
	}

	/** Plays the text box and keeps the message in the saved list. */
	function go() {
		play([{ text: store.draft }]);
		if (!playing) return;
		store.record();
		// Done with the saved message: what is typed next is a new one.
		store.stopEditing();
	}

	function openDrawing(id: string | null) {
		drawing = { id, drawing: store.entries.find((e) => e.id === id)?.drawing };
	}

	function saveDrawing(result: Drawing) {
		store.saveDrawing(drawing?.id ?? null, result);
		drawing = null;
	}

	/** Back to the text box, as the sign closes. */
	async function stop() {
		playing = null;
		await tick();
		input.focus();
	}

	async function focusTextBox() {
		await tick();
		input.focus();
	}

	/** The link that carries the message in the text box, as /#t=HELLO. */
	const shareUrl = $derived.by(() => {
		const url = new URL('/', location.origin);
		url.hash = new URLSearchParams({ t: clean(store.draft) }).toString();
		return url.href;
	});

	/** The share link as a QR code: module count and one SVG path of dark squares. */
	const qr = $derived.by(() => {
		if (!showQr || !qrcode) return null;
		try {
			const code = qrcode(0, 'M');
			code.addData(shareUrl);
			code.make();
			const size = code.getModuleCount();
			let path = '';
			for (let row = 0; row < size; row++) {
				for (let col = 0; col < size; col++) {
					if (code.isDark(row, col)) path += `M${col} ${row}h1v1h-1z`;
				}
			}
			return { size, path };
		} catch {
			// The message is longer than a QR code can hold.
			return null;
		}
	});

	async function toggleQr() {
		showQr = !showQr;
		if (showQr) qrcode ??= (await import('qrcode-generator')).default;
	}

	async function share() {
		try {
			if (navigator.share) {
				await navigator.share({ title: 'Marquee', url: shareUrl });
			} else {
				await navigator.clipboard.writeText(shareUrl);
				notice = 'Link copied.';
			}
		} catch (error) {
			// Closing the share sheet is not an error.
			if ((error as Error).name !== 'AbortError') notice = 'Could not share the link.';
		}
	}

	const secondary =
		'min-h-14 cursor-pointer rounded-lg border border-line-strong px-4 text-lg font-semibold active:bg-surface';
</script>

<!-- A shared link opened while the app is already showing only changes the hash. -->
<svelte:window onhashchange={readSharedLink} />

<main class="mx-auto flex w-full max-w-md flex-col gap-8 px-4 pt-4 pb-12" inert={playing !== null || drawing !== null}>
	<h1 class="sr-only">Marquee</h1>

	<form
		class="flex flex-col gap-4"
		onsubmit={(event) => {
			event.preventDefault();
			go();
		}}
	>
		<div class="flex flex-col gap-2">
			<div class="flex min-h-12 items-center justify-between gap-2">
				<label for="message" class="font-semibold text-fg-muted">
					{store.editing ? 'Editing a saved message' : 'Your message'}
				</label>
				{#if store.editing}
					<!-- Go replaces the saved message while editing; this keeps the original, and Go adds a new one. -->
					<button
						type="button"
						class="min-h-12 cursor-pointer rounded-lg px-3 text-lg font-semibold text-brand active:bg-surface"
						onclick={() => store.stopEditing()}
					>
						Edit as new
					</button>
				{/if}
			</div>
			{#key textBoxKey}
				<textarea
					id="message"
					bind:this={input}
					bind:value={store.draft}
					class="w-full resize-none rounded-lg border border-line-strong bg-surface p-4 text-2xl font-semibold placeholder:text-fg-muted"
					rows="2"
					placeholder="TAXI PLEASE"
					enterkeyhint="go"
					autocapitalize="characters"
					autocomplete="off"
					dir="auto"
					onkeydown={(event) => {
						if (event.key === 'Enter' && !event.isComposing) {
							event.preventDefault();
							go();
						}
					}}
				></textarea>
			{/key}
		</div>

		<button
			class="min-h-24 cursor-pointer rounded-lg bg-brand text-4xl font-black text-on-brand hover:bg-brand-hover active:bg-brand-hover"
		>
			Go
		</button>

		{#if shake.status === 'denied'}
			<p class="text-fg-muted">
				Shake is off because motion access was denied. To be asked again, close the app completely
				and reopen it. Until then, use the Blink button on the sign.
			</p>
		{/if}
	</form>

	<section class="flex flex-col gap-2">
		<h2 class="font-semibold text-fg-muted">Stickers</h2>
		<div class="grid grid-cols-5 gap-2">
			{#each STICKERS as sticker (sticker)}
				<button
					class="min-h-12 cursor-pointer rounded-lg bg-surface text-2xl active:bg-line-strong"
					aria-label="Add {sticker}"
					onclick={() => (store.draft += sticker)}
				>
					{sticker}
				</button>
			{/each}
		</div>
	</section>

	<SavedList onplay={play} onedit={focusTextBox} ondraw={openDrawing} />

	<section class="flex flex-col gap-6">
		<h2 class="font-semibold text-fg-muted">Style</h2>
		<!-- Stays in view while scrolling through the options below it. -->
		{#if !playing}
			<div class="sticky top-0 z-10 -mx-4 -mt-4 bg-bg px-4 py-2">
				<Preview text={clean(store.draft) || 'TAXI PLEASE'} blinking={previewBlinking} />
			</div>
		{/if}
		<Choice legend="Text size" name="size" options={SIZES} bind:value={store.size} />
		<Choice legend="Look" name="look" options={LOOKS} bind:value={store.look} />
		<Choice legend="Frame" name="frame" options={FRAMES} bind:value={store.frame} />

		<fieldset disabled={store.hdr} class="disabled:opacity-40">
			<legend class="mb-2 font-semibold text-fg-muted">Color</legend>
			<div class="grid grid-cols-4 gap-2">
				{#each COLORS as color (color.id)}
					<label
						class="relative flex min-h-14 cursor-pointer items-center justify-center rounded-lg border border-line-strong text-2xl font-black has-checked:border-4 has-checked:border-fg has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus"
						style:background-color={color.bg}
						style:color={color.fg}
					>
						<input
							class="absolute inset-0 cursor-pointer opacity-0"
							type="radio"
							name="color"
							value={color.id}
							bind:group={store.color}
						/>
						<span aria-hidden="true">{store.color === color.id ? '✓' : 'Aa'}</span>
						<span class="sr-only">{color.label}</span>
					</label>
				{/each}
				<!-- Any other color: tapping opens the system color picker and selects the custom color. -->
				<label
					class="relative col-span-4 flex min-h-14 cursor-pointer items-center justify-center gap-3 rounded-lg border bg-bg text-xl font-black has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus {store.color ===
					'custom'
						? 'border-4 border-fg'
						: 'border-line-strong'}"
					style:color={store.customColor}
				>
					<input
						class="absolute inset-0 size-full cursor-pointer opacity-0"
						type="color"
						aria-label={store.color === 'custom' ? 'Custom color, selected' : 'Custom color'}
						bind:value={store.customColor}
						onclick={() => (store.color = 'custom')}
						oninput={() => (store.color = 'custom')}
					/>
					<span aria-hidden="true">{store.color === 'custom' ? '✓' : 'Aa'}</span>
					<span class="text-lg text-fg">Custom color</span>
				</label>
			</div>
		</fieldset>

		<Choice
			legend="Extra bright"
			name="hdr"
			options={[
				{ id: 'off', label: 'Off' },
				{
					id: 'on',
					label: 'On',
					hint: 'Brighter than normal white, on screens that can do it. The message turns white. Turn your screen brightness all the way up. Uses more battery.'
				}
			]}
			bind:value={() => (store.hdr ? 'on' : 'off'), (value) => (store.hdr = value === 'on')}
		/>

		<!-- The slider is exponential: each step changes the speed by the same proportion,
		     which gives fine control at the slow end and a long reach at the fast end. -->
		<Slider
			legend="Scroll speed"
			name="speed"
			min={0}
			max={1}
			step={0.01}
			low="Slow"
			high="Fast"
			bind:value={
				() => Math.log(store.speed / SPEED.min) / Math.log(SPEED.max / SPEED.min),
				(position) => (store.speed = SPEED.min * (SPEED.max / SPEED.min) ** position)
			}
		/>
		<Choice
			legend="Scroll direction"
			name="direction"
			options={DIRECTIONS}
			bind:value={store.direction}
		/>

		<Choice legend="Blink" name="blink" options={BLINKS} bind:value={store.blink} onpick={demoBlink} />
		<Slider
			legend="Blink speed"
			name="blink-rate"
			min={BLINK_RATE.min}
			max={BLINK_RATE.max}
			step={BLINK_RATE.step}
			low="Slow"
			high="Fast"
			bind:value={store.blinkRate}
			oninput={demoBlink}
		/>
	</section>

	<footer class="flex flex-col gap-4">
		{#if clean(store.draft)}
			<div class="grid auto-cols-fr grid-flow-col gap-2">
				<button class={secondary} onclick={share}>Share link</button>
				<button class={secondary} aria-expanded={showQr} onclick={toggleQr}>
					{showQr ? 'Hide QR code' : 'QR code'}
				</button>
			</div>
			{#if qr}
				<!-- Black on white with a 4-module quiet zone, which scanners need. -->
				<svg
					class="w-full rounded-lg"
					viewBox="-4 -4 {qr.size + 8} {qr.size + 8}"
					shape-rendering="crispEdges"
					role="img"
					aria-label="QR code that opens this message"
				>
					<rect x="-4" y="-4" width="100%" height="100%" fill="#fff" />
					<path d={qr.path} fill="#000" />
				</svg>
			{:else if showQr && qrcode}
				<p class="text-fg-muted">This message is too long for a QR code. Share the link instead.</p>
			{/if}
		{/if}
		<p class="text-fg-muted" role="status">{notice}</p>
		{#if showInstallHint}
			<p class="text-fg-muted">To install, tap Share, then Add to Home Screen.</p>
		{/if}
	</footer>
</main>

{#if playing}
	<Stage items={playing} onstop={stop} />
{/if}

{#if drawing}
	<DrawingPad drawing={drawing.drawing} onsave={saveDrawing} oncancel={() => (drawing = null)} />
{/if}
