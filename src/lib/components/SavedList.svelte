<script lang="ts">
	// Every message and drawing that has been played, in one list. Ticked entries
	// make up the playlist, which plays in list order. Arranging shows handles to drag
	// entries into order, and buttons to delete them.
	import { tick } from 'svelte';
	import { clean, store, type Entry } from '../store.svelte';
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

	let arranging = $state(false);
	/** The entry being dragged by its handle. */
	let dragId = $state<string | null>(null);
	const rows: Record<string, HTMLElement> = {};

	const name = (entry: Entry) => (entry.drawing ? 'drawing' : clean(entry.text));

	// Nothing left to arrange.
	$effect(() => {
		if (store.entries.length === 0) arranging = false;
	});

	function dragStart(event: PointerEvent, id: string) {
		(event.currentTarget as Element).setPointerCapture(event.pointerId);
		dragId = id;
	}

	/** Moves the dragged entry to the row under the finger. */
	function dragMove(event: PointerEvent) {
		if (!dragId) return;
		const from = store.entries.findIndex((e) => e.id === dragId);
		const to = store.entries.findIndex((e) => {
			const box = rows[e.id]?.getBoundingClientRect();
			return box && event.clientY >= box.top && event.clientY < box.bottom;
		});
		if (to !== -1) store.move(from, to);
	}

	/** Arrow keys on a handle move its entry one place, for when dragging is not an option. */
	async function moveByKey(event: KeyboardEvent, id: string) {
		const step = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0;
		if (!step) return;
		event.preventDefault();
		const from = store.entries.findIndex((e) => e.id === id);
		store.move(from, from + step);
		// Moving the row in the page can take focus off the handle.
		await tick();
		rows[id]?.querySelector<HTMLElement>('[data-handle]')?.focus();
	}

	const square =
		'flex min-h-14 w-14 shrink-0 cursor-pointer items-center justify-center rounded-lg text-2xl font-bold active:bg-surface';
</script>

<section class="flex flex-col gap-2" aria-labelledby="saved-title">
	<div class="flex min-h-12 items-center justify-between gap-2">
		<h2 id="saved-title" class="font-semibold text-fg-muted">Saved</h2>
		{#if store.entries.length > 0}
			<button
				class="min-h-12 cursor-pointer rounded-lg px-3 text-lg font-semibold text-brand active:bg-surface"
				aria-pressed={arranging}
				onclick={() => (arranging = !arranging)}
			>
				{arranging ? 'Done' : 'Arrange'}
			</button>
		{/if}
	</div>

	{#if store.entries.length === 0}
		<p class="text-fg-muted">Messages and drawings you show are kept here. Tick them to make a playlist.</p>
	{:else if arranging}
		<p class="text-fg-muted">Drag ≡ to change the order.</p>
	{:else if store.playlist.length === 0}
		<p class="text-fg-muted">Tick entries to add them to the playlist.</p>
	{/if}

	<ul class="flex flex-col gap-2">
		{#each store.entries as entry (entry.id)}
			{@const label = name(entry)}
			<li
				bind:this={rows[entry.id]}
				class="flex gap-2 rounded-lg {dragId === entry.id ? 'bg-surface outline-2 outline-brand' : ''}"
			>
				{#if arranging}
					<button
						data-handle
						class="{square} cursor-grab touch-none text-fg-muted"
						aria-label="Move {label}. Use the up and down arrow keys."
						onpointerdown={(event) => dragStart(event, entry.id)}
						onpointermove={dragMove}
						onpointerup={() => (dragId = null)}
						onpointercancel={() => (dragId = null)}
						onkeydown={(event) => moveByKey(event, entry.id)}
					>
						≡
					</button>
				{:else}
					<label class="{square} relative border border-line-strong has-checked:border-brand has-checked:bg-brand has-checked:text-on-brand has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus">
						<input
							class="absolute inset-0 cursor-pointer opacity-0"
							type="checkbox"
							aria-label="In playlist: {label}"
							bind:checked={entry.on}
						/>
						<span aria-hidden="true">{entry.on ? '✓' : ''}</span>
					</label>
				{/if}

				<button
					class="flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-lg border border-line-strong bg-surface px-4 text-left text-xl font-semibold {entry.id ===
					store.editingId
						? 'border-l-8 border-l-brand'
						: ''} {arranging ? 'cursor-default' : 'cursor-pointer'}"
					aria-label="Play {label}"
					disabled={arranging}
					onclick={() => onplay([entry])}
				>
					{#if !arranging}<span class="text-fg-muted" aria-hidden="true">▶</span>{/if}
					{#if entry.drawing}
						<span class="min-w-0 overflow-hidden">
							<DrawingView drawing={entry.drawing} height={40} />
						</span>
					{:else}
						<span class="truncate">{label}</span>
					{/if}
				</button>

				{#if arranging}
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

	{#if !arranging}
		{#if store.playlist.length > 0}
			<button
				class="min-h-14 cursor-pointer rounded-lg border border-line-strong px-4 text-lg font-semibold active:bg-surface"
				onclick={() => onplay(store.playlist)}
			>
				▶ Play playlist ({store.playlist.length}) on repeat
			</button>
		{/if}
	{/if}
</section>
