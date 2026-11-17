// The few control styles the app is built from, in one place so they stay alike.

const focusWithin = 'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus';

/** A heading or label above a group of controls. */
export const label = 'font-semibold text-fg-muted';

/** An outlined button, for everything but Go. */
export const secondary =
	'min-h-14 cursor-pointer rounded-lg border border-line-strong px-4 text-lg font-semibold active:bg-surface disabled:cursor-default disabled:opacity-40';

/** A quiet text button in the brand color, beside a heading. */
export const textButton = 'min-h-12 cursor-pointer rounded-lg px-3 text-lg font-semibold text-brand active:bg-surface';

/** One option of a preset picker: a big button around a hidden radio input, solid when chosen. */
export const tile = `relative flex min-h-14 cursor-pointer items-center justify-center rounded-lg border border-line-strong bg-surface px-2 text-lg font-semibold has-checked:border-fg has-checked:bg-fg has-checked:text-bg ${focusWithin}`;

/** A color option: painted by its color, with a thick light border when chosen. */
export const swatch = `relative flex min-h-14 cursor-pointer items-center justify-center rounded-lg border text-2xl font-black has-disabled:cursor-default has-disabled:opacity-40 ${focusWithin}`;
