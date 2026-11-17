<script lang="ts">
	import { onMount, tick } from 'svelte';
	import Choice from '../lib/components/Choice.svelte';
	import ColorPicker from '../lib/components/ColorPicker.svelte';
	import DrawingPad from '../lib/components/DrawingPad.svelte';
	import Preview from '../lib/components/Preview.svelte';
	import SavedList from '../lib/components/SavedList.svelte';
	import Slider from '../lib/components/Slider.svelte';
	import Stage from '../lib/components/Stage.svelte';
	import {
		BLINK_RATE,
		blinkMs,
		BLINKS,
		DIRECTIONS,
		FRAMES,
		LOOKS,
		SIZES,
		SPEED,
		STICKERS
	} from '../lib/presets';
	import { shake } from '../lib/shake.svelte';
	import { clean, hasContent, HDR_COLORS, store, toItem, type Entry, type Item } from '../lib/store.svelte';
	import { label, secondary, textButton } from '../lib/ui';

	/** What is on the sign right now, or null while editing. */
	let playing = $state<Item[] | null>(null);
	let notice = $state('');
	let showInstallHint = $state(false);
	let showQr = $state(false);
	/** The QR library, loaded the first time a code is asked for to keep the first load small. */
	let qrcode = $state.raw<typeof import('qrcode-generator') | null>(null);
	/** The text box, while in text mode. */
	let input = $state<HTMLTextAreaElement>();
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
		store.setMode('text');
		store.draft = shared;
		store.stopEditing();
	}

	onMount(() => {
		readSharedLink();
		// iOS has no install prompt. `navigator.standalone` only exists there.
		showInstallHint = 'standalone' in navigator && !navigator.standalone;
		input?.focus();
	});

	function play(entries: Pick<Entry, 'text' | 'drawing'>[]) {
		const items = entries.filter(hasContent).map(toItem);
		if (items.length === 0) {
			input?.focus();
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

	/** Shows the text box or the drawing, and keeps it in the saved list. */
	function go() {
		const item = store.current;
		if (!item) {
			input?.focus();
			return;
		}
		play([item]);
		store.record();
		// Done with the saved entry: what comes next is a new one.
		store.stopEditing();
	}

	/** Back to the text box, as the sign closes. */
	async function stop() {
		playing = null;
		await tick();
		input?.focus();
	}

	/** A saved entry was loaded for editing: bring the text box or pad into view. */
	async function showEditor() {
		await tick();
		scrollTo({ top: 0 });
		input?.focus({ preventScroll: true });
	}

	const kind = $derived(store.mode === 'draw' ? 'drawing' : 'message');

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
</script>

<!-- A shared link opened while the app is already showing only changes the hash. -->
<svelte:window onhashchange={readSharedLink} />

<main class="mx-auto flex w-full max-w-md flex-col gap-8 px-4 pt-4 pb-12" inert={playing !== null}>
	<h1 class="sr-only">Marquee</h1>

	<form
		class="flex flex-col gap-4"
		onsubmit={(event) => {
			event.preventDefault();
			go();
		}}
	>
		<Choice
			legend="Show a message or a drawing"
			hideLegend
			name="mode"
			options={[
				{ id: 'text', label: 'Text' },
				{ id: 'draw', label: 'Drawing' }
			]}
			bind:value={() => store.mode, (mode) => store.setMode(mode)}
		/>

		<div class="flex flex-col gap-2">
			<!-- The Drawing toggle already says what the pad is for, so it only gets a heading while editing. -->
			{#if store.mode === 'text' || store.editing}
				<div class="flex min-h-12 items-center justify-between gap-2">
					{#if store.mode === 'text'}
						<label for="message" class={label}>{store.editing ? 'Editing a saved message' : 'Message'}</label>
					{:else}
						<p class={label}>Editing a saved drawing</p>
					{/if}
					{#if store.editing}
						<!-- Go replaces the saved entry while editing; this keeps the original, and Go adds a new one. -->
						<button type="button" class={textButton} onclick={() => store.stopEditing()}>Edit as new</button>
					{/if}
				</div>
			{/if}
			{#if store.mode === 'text'}
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
			{:else}
				<!-- A fresh pad for each saved drawing, so it starts at the beginning of the strip. -->
				{#key store.editingId}
					<DrawingPad />
				{/key}
			{/if}
		</div>

		<!-- The one color setting: the text color, or the pen while drawing. -->
		<ColorPicker />

		<button
			class="min-h-24 cursor-pointer rounded-lg bg-brand text-4xl font-black text-on-brand hover:bg-brand-hover active:bg-brand-hover"
			aria-label="Go: show this {kind}"
		>
			Go
		</button>

		<!-- A link can only carry text. -->
		{#if store.mode === 'text'}
			<div class="grid auto-cols-fr grid-flow-col gap-2">
				<button type="button" class={secondary} disabled={!clean(store.draft)} onclick={share}>Share link</button>
				<button
					type="button"
					class={secondary}
					disabled={!clean(store.draft)}
					aria-expanded={showQr}
					onclick={toggleQr}
				>
					{showQr ? 'Hide QR code' : 'QR code'}
				</button>
			</div>
			{#if qr && clean(store.draft)}
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
			{:else if showQr && qrcode && clean(store.draft)}
				<p class="text-fg-muted">This message is too long for a QR code. Share the link instead.</p>
			{/if}
		{/if}
		<!-- Empty until there is news, but always present so screen readers announce it. -->
		<p class="text-fg-muted empty:hidden" role="status">{notice}</p>

		{#if shake.status === 'denied'}
			<p class="text-fg-muted">
				Shake is off because motion access was denied. To be asked again, close the app completely
				and reopen it. Until then, use the Blink button on the sign.
			</p>
		{/if}
	</form>

	{#if store.mode === 'text'}
		<section class="flex flex-col gap-2">
			<h2 class={label}>Stickers</h2>
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
	{/if}

	<SavedList onplay={play} onedit={showEditor} />

	<section class="flex flex-col gap-6">
		<h2 class={label}>Style</h2>
		<!-- Stays in view while scrolling through the options below it. -->
		{#if !playing}
			<div class="sticky top-0 z-10 -mx-4 -mt-4 bg-bg px-4 py-2">
				<Preview item={store.current ?? { text: 'TAXI PLEASE' }} blinking={previewBlinking} />
			</div>
		{/if}
		<Choice legend="Size" name="size" options={SIZES} bind:value={store.size} />
		<Choice legend="Look" name="look" options={LOOKS} bind:value={store.look} />
		<Choice legend="Frame" name="frame" options={FRAMES} bind:value={store.frame} />


		<Choice
			legend="Extra bright"
			name="hdr"
			options={[
				{ id: 'off', label: 'Off' },
				{
					id: 'on',
					label: 'On',
					hint: 'Brighter than normal white, on screens that can do it. Turn your screen brightness all the way up. Uses more battery.'
				}
			]}
			bind:value={
				() => (store.hdr ? 'on' : 'off'),
				(value) => {
					store.hdr = value === 'on';
					// Other colors cannot be extra bright, so they make way for white.
					if (store.hdr && !HDR_COLORS.includes(store.color)) store.color = 'white';
				}
			}
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

	{#if showInstallHint}
		<p class="text-fg-muted">To install, tap Share, then Add to Home Screen.</p>
	{/if}
</main>

{#if playing}
	<Stage items={playing} onstop={stop} />
{/if}
