<script lang="ts">
	// A fine adjustment between two named ends, for the few settings where three presets are too coarse.
	let {
		legend,
		name,
		min,
		max,
		step,
		low,
		high,
		value = $bindable(),
		oninput
	}: {
		legend: string;
		name: string;
		min: number;
		max: number;
		step: number;
		/** Names for the two ends of the slider. */
		low: string;
		high: string;
		value: number;
		oninput?: () => void;
	} = $props();
</script>

<div>
	<label for={name} class="mb-2 block font-semibold text-fg-muted">{legend}</label>
	<input id={name} class="slider" type="range" {min} {max} {step} bind:value {oninput} />
	<div class="flex justify-between text-fg-muted" aria-hidden="true">
		<span>{low}</span>
		<span>{high}</span>
	</div>
</div>
