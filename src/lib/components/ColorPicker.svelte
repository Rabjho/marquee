<script lang="ts">
	// The one color setting. In text mode it colors the message; in draw mode it is the pen,
	// and each stroke keeps the color it was drawn in.
	import { COLORS } from '../presets';
	import { HDR_COLORS, store } from '../store.svelte';
	import { label, swatch } from '../ui';
	import CustomSwatch from './CustomSwatch.svelte';
</script>

<fieldset>
	<legend class="mb-2 {label}">Color</legend>
	<div class="grid grid-cols-5 gap-2">
		{#each COLORS as color (color.id)}
			<label
				class="{swatch} {store.color === color.id ? 'border-4 border-fg' : 'border-line-strong'}"
				style:background-color={color.bg}
				style:color={color.fg}
			>
				<input
					class="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-default"
					type="radio"
					name="color"
					value={color.id}
					disabled={store.hdr && !HDR_COLORS.includes(color.id)}
					bind:group={store.color}
				/>
				{#if store.color === color.id}
					<span aria-hidden="true">✓</span>
				{:else}
					<span class="size-5 rounded-full bg-current" aria-hidden="true"></span>
				{/if}
				<span class="sr-only">{color.label}</span>
			</label>
		{/each}
		<CustomSwatch
			label="Custom color"
			bind:value={store.customColor}
			selected={store.color === 'custom'}
			disabled={store.hdr}
			onselect={() => (store.color = 'custom')}
		/>
	</div>
	{#if store.hdr}
		<p class="mt-2 text-fg-muted">Extra bright only works with white on black and black on white.</p>
	{/if}
</fieldset>
