// Every control is a short list of presets. No sliders, no pickers.

export const SPEEDS = [
	{ id: 'slow', label: 'Slow', screensPerSecond: 0.3 },
	{ id: 'medium', label: 'Medium', screensPerSecond: 0.55 },
	{ id: 'fast', label: 'Fast', screensPerSecond: 0.95 }
] as const;

export const COLORS = [
	{ id: 'white', label: 'White', fg: '#ffffff', bg: '#000000' },
	{ id: 'yellow', label: 'Yellow', fg: '#ffe600', bg: '#000000' },
	{ id: 'orange', label: 'Orange', fg: '#ff8a00', bg: '#000000' },
	{ id: 'red', label: 'Red', fg: '#ff2a2a', bg: '#000000' },
	{ id: 'pink', label: 'Pink', fg: '#ff2fd0', bg: '#000000' },
	{ id: 'green', label: 'Green', fg: '#39ff14', bg: '#000000' },
	{ id: 'cyan', label: 'Cyan', fg: '#00e5ff', bg: '#000000' },
	{ id: 'paper', label: 'Black on white', fg: '#000000', bg: '#ffffff' }
] as const;

export const BLINKS = [
	{ id: 'flash', label: 'Flash' },
	{ id: 'strobe', label: 'Strobe' },
	{ id: 'invert', label: 'Invert' }
] as const;

export const DIRECTIONS = [
	{ id: 'left', label: '← Left' },
	{ id: 'right', label: 'Right →' }
] as const;

export const STICKERS = [
	'❤️', '🍺', '🍻', '🥂', '🚕', '👋', '👉', '👈', '⬆️', '⬇️',
	'🎉', '🔥', '😂', '😍', '👍', '🙏', '🍕', '🎵', '💃', '🆘'
] as const;

export type SpeedId = (typeof SPEEDS)[number]['id'];
export type ColorId = (typeof COLORS)[number]['id'];
export type BlinkId = (typeof BLINKS)[number]['id'];
export type DirectionId = (typeof DIRECTIONS)[number]['id'];

/** How long a shake or a tap on Blink keeps the sign blinking. */
export const BLINK_MS = 2000;
