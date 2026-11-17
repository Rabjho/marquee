<script lang="ts">
	// Every message and drawing that has been played, in one list, newest first. Tapping +
	// adds an entry to the playlist, which Go plays in the order the entries were added.
	// Delete mode swaps the edit buttons for delete buttons and offers to clear everything.
	import { baseFor, clean, store, type Entry } from '../store.svelte';
	import { label as heading, secondary, textButton } from '../ui';
	import DrawingView from './DrawingView.svelte';

	let {
		onplay,
		onedit
	}: {
		/** Plays these entries one after another. */
		onplay: (entries: Entry[]) => void;
		/** A saved entry was put in the text box or on the drawing pad. */
		onedit: () => void;
	} = $props();

	let deleting = $state(false);
	/** Clear history asks once before it deletes everything. */
	let confirming = $state(false);

	const name = (entry: Entry) => (entry.drawing ? 'drawing' : clean(entry.text));

	// Nothing left to delete.
	$effect(() => {
		if (store.entries.length === 0) deleting = false;
	});
	$effect(() => {
		if (!deleting) confirming = false;
	});

	/** The confirmation takes focus from the button that opened it, which is gone. */
	const focus = (node: HTMLElement) => node.focus();

	const square =
		'flex min-h-14 w-14 shrink-0 cursor-pointer items-center justify-center rounded-lg text-2xl font-bold active:bg-surface';
</script>

<section class="flex flex-col gap-2" aria-labelledby="saved-title">
	<div class="flex min-h-12 items-center justify-between gap-2">
		<h2 id="saved-title" class={heading}>Saved</h2>
		{#if store.entries.length > 0}
			<button class={textButton} aria-pressed={deleting} onclick={() => (deleting = !deleting)}>
				{deleting ? 'Done' : 'Delete'}
			</button>
		{/if}
	</div>

	{#if store.entries.length === 0}
		<p class="text-fg-muted">
			Messages and drawings you show are kept here. Tap + on them to build a playlist: Go then plays
			them in the order you tapped, with what you are editing.
		</p>
	{:else if store.playlist.length > 0}
		<div class="flex items-center justify-between gap-2">
			<p class="text-fg-muted">
				Go plays {store.playlist.length} from here{store.lineup.length > store.playlist.length
					? ', then what you are editing'
					: ''}.
			</p>
			<button type="button" class={secondary} aria-label="Clear playlist" onclick={() => store.clearPlaylist()}>
				Clear
			</button>
		</div>
	{/if}

	<ul class="flex flex-col gap-2">
		{#each store.entries as entry (entry.id)}
			{@const label = name(entry)}
			{@const place = store.place(entry.id)}
			{@const colors = store.colorsFor(entry.color)}
			<li class="flex gap-2">
				<!-- Off: a + to add it. On: its place in the playlist. -->
				<label
					class="{square} relative border border-dashed border-line-strong text-fg-muted has-checked:border-solid has-checked:border-brand has-checked:bg-brand has-checked:text-on-brand has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus"
				>
					<input
						class="absolute inset-0 cursor-pointer opacity-0"
						type="checkbox"
						aria-label="In playlist: {label}"
						checked={place > 0}
						onchange={() => store.togglePlaylist(entry.id)}
					/>
					<span aria-hidden="true">{place || '+'}</span>
				</label>

				<button
					class="flex min-h-14 min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-lg border border-line-strong bg-surface px-4 text-left text-xl font-semibold {entry.id ===
					store.editingId
						? 'border-l-8 border-l-brand'
						: ''}"
					aria-label="Play {label}"
					onclick={() => onplay([entry])}
				>
					<span class="text-fg-muted" aria-hidden="true">▶</span>
					<!-- A miniature of the sign, in the colors it was saved in. -->
					{#if entry.drawing}
						<span
							class="min-w-0 overflow-hidden rounded"
							style:background-color={colors.bg}
							style:color={baseFor(colors)}
						>
							<DrawingView drawing={entry.drawing} height={40} />
						</span>
					{:else}
						<span
							class="truncate rounded px-2"
							style:background-color={colors.bg}
							style:color={colors.fg}
						>
							{label}
						</span>
					{/if}
				</button>

				{#if deleting}
					<button class="{square} text-danger" aria-label="Delete {label}" onclick={() => store.remove(entry.id)}>
						✕
					</button>
				{:else}
					<button
						class={square}
						aria-label="Edit {label}"
						onclick={() => {
							store.edit(entry.id);
							onedit();
						}}
					>
						✎
					</button>
				{/if}
			</li>
		{/each}
	</ul>

	{#if deleting}
		{#if confirming}
			<div class="flex flex-col gap-2 rounded-lg border border-danger p-4" role="group" aria-labelledby="clear-question">
				<p id="clear-question" class="font-semibold">
					Delete all {store.entries.length} saved {store.entries.length === 1 ? 'entry' : 'entries'}? This can't be undone.
				</p>
				<div class="grid grid-cols-2 gap-2">
					<button class={secondary} use:focus onclick={() => (confirming = false)}>Cancel</button>
					<button
						class="min-h-14 cursor-pointer rounded-lg bg-danger px-4 text-lg font-semibold text-bg"
						onclick={() => store.clearHistory()}
					>
						Delete all
					</button>
				</div>
			</div>
		{:else}
			<button
				class="min-h-12 cursor-pointer self-start rounded-lg px-3 text-lg font-semibold text-danger active:bg-surface"
				onclick={() => (confirming = true)}>Clear history</button>
		{/if}
	{/if}
</section>
