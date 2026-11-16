<script lang="ts" generics="T extends string">
	// A preset picker: a row of big buttons backed by native radio inputs.
	let {
		legend,
		name,
		options,
		value = $bindable(),
		onpick
	}: {
		legend: string;
		name: string;
		options: readonly { id: T; label: string; hint?: string }[];
		value: T;
		/** Called on every tap of an option, including the one already chosen. */
		onpick?: () => void;
	} = $props();

	const hint = $derived(options.find((option) => option.id === value)?.hint);
</script>

<fieldset>
	<legend class="mb-2 font-semibold text-fg-muted">{legend}</legend>
	<div class="grid auto-cols-fr grid-flow-col gap-2">
		{#each options as option (option.id)}
			<label
				class="relative flex min-h-14 cursor-pointer items-center justify-center rounded-lg border border-line-strong bg-surface px-2 text-lg font-semibold has-checked:border-fg has-checked:bg-fg has-checked:text-bg has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus"
			>
				<input class="absolute inset-0 cursor-pointer opacity-0" type="radio" {name} value={option.id} bind:group={value} onclick={onpick} />
				{option.label}
			</label>
		{/each}
	</div>
	{#if hint}
		<p class="mt-2 text-fg-muted">{hint}</p>
	{/if}
</fieldset>
