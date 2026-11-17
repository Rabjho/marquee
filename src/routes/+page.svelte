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
	import { noUndo } from '../lib/noUndo';
	import { label, secondary, textButton } from '../lib/ui';

	/** What is on the sign right now, or null while editing. */
	let playing = $state<Item[] | null>(null);
	let notice = $state('');
	let showInstallHint = $state(false);
	let showQr = $state(false);
	/** The QR library, loaded the first time a code is asked for to keep the first load small. */
	let qrcode = $state.raw<typeof import('qrcode-generator') | null>(null);
	/** The text box, while in text mode. */
	let goButton = $state<HTMLButtonElement>();
	/** What started the sign, for focus to go back to when it closes. */
	let opener: HTMLElement | null = null;
	/** Bumped on every play, which gives the drawing pad a fresh start. */
	let playCount = $state(0);
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
	});

	function play(entries: Pick<Entry, 'text' | 'drawing' | 'color'>[]) {
		const items = entries.filter(hasContent).map(toItem);
		if (items.length === 0) return;
		// Back to the button that was tapped. Not the text box, though (Enter there plays too):
		// focusing it would pop up the keyboard, so Go stands in for it.
		const active = document.activeElement;
		opener = active instanceof HTMLTextAreaElement ? (goButton ?? null) : (active as HTMLElement | null);
		// Asked from inside the tap, as iOS requires for the motion permission prompt.
		shake.start();
		notice = '';
		playCount++;
		playing = items;
	}

	/**
	 * Plays the playlist with what is being edited in it, then files that away in the saved
	 * list and empties the editor, like sending a message. Nothing left behind tags along next time.
	 */
	function go() {
		const items = store.lineup;
		if (items.length === 0) return;
		play(items);
		store.record();
		store.clearEditor();
	}

	/** The sign closes, and focus goes back to what opened it, if it is still there. */
	async function stop() {
		playing = null;
		await tick();
		if (opener?.isConnected) opener.focus({ preventScroll: true });
		opener = null;
	}

	/** A saved entry was loaded for editing: bring the text box or pad into view. */
	async function showEditor() {
		await tick();
		scrollTo({ top: 0 });
	}

	const goLabel = $derived.by(() => {
		const count = store.lineup.length;
		if (count === 0) return `Go: nothing to show yet, ${store.mode === 'draw' ? 'draw something' : 'type a message'} first`;
		if (count === 1 && store.current) return `Go: show this ${store.mode === 'draw' ? 'drawing' : 'message'}`;
		return `Go: play the playlist, ${count} ${count === 1 ? 'entry' : 'entries'}`;
	});

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

<main
	class="mx-auto flex w-full max-w-md flex-col gap-8 px-4 pt-4 pb-[calc(3rem+env(safe-area-inset-bottom))]"
	inert={playing !== null}>
	<h1 class="sr-only">Marquee</h1>

	<!-- What Go will play, pinned to the top so every change shows in it while scrolling.
	     It shows only that: with nothing to play, the sign is blank. It runs edge to edge from
	     the very top of the screen, and in the installed app on up behind the notch or island. -->
	{#if !playing}
		<div class="sticky top-0 z-10 -mx-4 -mt-4 -mb-4 bg-bg pb-2">
			<Preview
				items={store.lineup}
				blinking={previewBlinking}
			/>
		</div>
	{/if}

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
					<textarea
						id="message"
						bind:value={store.draft}
						{@attach noUndo}
						class="w-full resize-none rounded-lg border border-line-strong bg-surface p-4 text-2xl font-semibold placeholder:font-normal placeholder:text-fg-muted"
						rows="2"
						placeholder="Type a message"
						enterkeyhint="go"
						autocapitalize="characters"
						autocomplete="off"
						spellcheck="false"
						dir="auto"
						onkeydown={(event) => {
							if (event.key === 'Enter' && !event.isComposing) {
								event.preventDefault();
								go();
							}
						}}
					></textarea>
			{:else}
				<!-- A fresh pad for each saved drawing and after each Go, so it starts at the beginning of the strip. -->
				{#key `${store.editingId}:${playCount}`}
					<DrawingPad />
				{/key}
			{/if}
		</div>

		<!-- The one color setting: the text color, or the pen while drawing. -->
		<ColorPicker />

		<button
			bind:this={goButton}
			class="min-h-24 cursor-pointer rounded-lg bg-brand text-4xl font-black text-on-brand hover:bg-brand-hover active:bg-brand-hover aria-disabled:cursor-default aria-disabled:opacity-40 aria-disabled:hover:bg-brand aria-disabled:active:bg-brand"
			aria-label={goLabel}
			aria-disabled={store.lineup.length === 0}
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
		<Choice legend="Size" name="size" options={SIZES} bind:value={store.size} />
		<Choice legend="Look" name="look" options={LOOKS} bind:value={store.look} />
		<Choice legend="Frame" name="frame" options={FRAMES} bind:value={store.frame} />
		{#if store.frame !== 'none'}
			<Choice
				legend="Frame blink"
				name="frame-blink"
				options={[
					{ id: 'off', label: 'Off' },
					{ id: 'on', label: 'On', hint: 'The frame blinks on its own at the blink speed, whether the message blinks or not.' }
				]}
				bind:value={() => (store.frameBlink ? 'on' : 'off'), (value) => (store.frameBlink = value === 'on')}
			/>
		{/if}


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

	<!-- Sharing comes last: it is not what the app is for. A link can only carry text. -->
	{#if store.mode === 'text'}
		<section class="flex flex-col gap-2" aria-labelledby="share-title">
			<h2 id="share-title" class={label}>Share</h2>
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
			<!-- Empty until there is news, but always present so screen readers announce it. -->
			<p class="text-fg-muted empty:hidden" role="status">{notice}</p>
		</section>
	{/if}

	{#if showInstallHint}
		<p class="text-fg-muted">To install, tap Share, then Add to Home Screen.</p>
	{/if}
</main>

{#if playing}
	<Stage items={playing} onstop={stop} />
{/if}
