<script lang="ts">
	// The last tile in a row of color presets: a rainbow ring around the custom color.
	// Tapping it selects the custom color and opens the system color picker.
	import { swatch } from '../ui';

	let {
		label,
		value = $bindable(),
		selected,
		onselect,
		disabled = false
	}: {
		label: string;
		value: string;
		selected: boolean;
		onselect: () => void;
		disabled?: boolean;
	} = $props();
</script>

<label class="{swatch} bg-bg {selected ? 'border-4 border-fg' : 'border-line-strong'}">
	<input
		class="absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-default"
		type="color"
		aria-label={selected ? `${label}, selected` : label}
		{disabled}
		bind:value
		onclick={onselect}
		oninput={onselect}
	/>
	<span
		class="flex size-9 items-center justify-center rounded-full p-1"
		style:background="conic-gradient(#ff2a2a, #ffe600, #39ff14, #00e5ff, #3b6bff, #ff2fd0, #ff2a2a)"
		aria-hidden="true"
	>
		<!-- Selected: the ring around a ✓ on black, like the presets' ✓.
		     Otherwise: the ring around the custom color. -->
		<span
			class="flex size-full items-center justify-center rounded-full text-lg font-black {selected ? 'bg-bg text-fg' : ''}"
			style:background-color={selected ? undefined : value}
		>
			{#if selected}✓{/if}
		</span>
	</span>
</label>
