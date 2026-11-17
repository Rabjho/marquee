<script lang="ts">
	// The last tile in a row of color presets: a rainbow ring around the custom color.
	// Tapping it selects the custom color and opens the system color picker.
	let {
		label,
		value = $bindable(),
		selected,
		onselect,
		disabled = false,
		background = '#000000'
	}: {
		label: string;
		value: string;
		selected: boolean;
		onselect: () => void;
		disabled?: boolean;
		/** The tile's background, to match the presets next to it. */
		background?: string;
	} = $props();
</script>

<label
	class="relative flex min-h-14 cursor-pointer items-center justify-center rounded-lg border has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus has-disabled:cursor-default has-disabled:opacity-40 {selected
		? 'border-4 border-fg'
		: 'border-line-strong'}"
	style:background-color={background}
>
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
		<span
			class="flex size-full items-center justify-center rounded-full text-lg font-black"
			style:background-color={value}
			style:color={value}
		>
			{#if selected}<span class="rounded-full bg-bg px-1 text-fg">✓</span>{/if}
		</span>
	</span>
</label>
