<script lang="ts" generics="T extends string">
	// A preset picker: a row of big buttons backed by native radio inputs.
	import { label, tile } from '../ui';

	let {
		legend,
		name,
		options,
		value = $bindable(),
		onpick,
		hideLegend = false
	}: {
		legend: string;
		/** For when the options speak for themselves: the legend is then for screen readers only. */
		hideLegend?: boolean;
		name: string;
		options: readonly { id: T; label: string; hint?: string }[];
		value: T;
		/** Called on every tap of an option, including the one already chosen. */
		onpick?: () => void;
	} = $props();

	const hint = $derived(options.find((option) => option.id === value)?.hint);
</script>

<fieldset>
	<legend class={hideLegend ? 'sr-only' : `mb-2 ${label}`}>{legend}</legend>
	<div class="grid auto-cols-fr grid-flow-col gap-2">
		{#each options as option (option.id)}
			<label class={tile}>
				<input class="absolute inset-0 cursor-pointer opacity-0" type="radio" {name} value={option.id} bind:group={value} onclick={onpick} />
				{option.label}
			</label>
		{/each}
	</div>
	{#if hint}
		<p class="mt-2 text-fg-muted">{hint}</p>
	{/if}
</fieldset>
