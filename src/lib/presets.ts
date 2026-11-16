// Every control is a short list of presets. No sliders, no pickers.

/** Scroll speed in sign widths per second. */
export const SPEED = { min: 0.1, max: 1.6, step: 0.05, initial: 0.55 } as const;

/**
 * Blinks per second. The ceiling is 3 on purpose: faster full-screen flashing is a
 * seizure risk (WCAG 2.3.1).
 */
export const BLINK_RATE = { min: 0.5, max: 3, step: 0.25, initial: 3 } as const;

/** Text height as a share of the screen height. Smaller text fits more words on screen at once. */
export const SIZES = [
	{ id: 'big', label: 'Big', scale: 0.9 },
	{ id: 'medium', label: 'Medium', scale: 0.55 },
	{ id: 'small', label: 'Small', scale: 0.32 }
] as const;

export const LOOKS = [
	{ id: 'smooth', label: 'Smooth' },
	{ id: 'led', label: 'LED' },
	{ id: 'pixel', label: 'Pixel' }
] as const;

export const FRAMES = [
	{ id: 'none', label: 'None' },
	{ id: 'line', label: 'Line' },
	{ id: 'bulbs', label: 'Bulbs' }
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
	{ id: 'flash', label: 'Flash', hint: 'The text blinks on and off.' },
	{ id: 'strobe', label: 'Strobe', hint: 'The whole screen pulses with light.' },
	{ id: 'invert', label: 'Invert', hint: 'Text and background swap colors.' }
] as const;

export const DIRECTIONS = [
	{ id: 'left', label: '← Left' },
	{ id: 'right', label: 'Right →' }
] as const;

export const STICKERS = [
	'❤️', '🍺', '🍻', '🥂', '🚕', '👋', '👉', '👈', '⬆️', '⬇️',
	'🎉', '🔥', '😂', '😍', '👍', '🙏', '🍕', '🎵', '💃', '🆘'
] as const;

/** Drawings live on a fixed canvas in these units; strokes are stored as SVG path data. */
export const DRAWING = { width: 150, height: 100, brush: 6 } as const;

/** Ink colors for drawings. `null` follows the sign color, so it changes with the Color preset. */
export const INKS = [
	{ id: 'sign', label: 'Sign color', value: null },
	{ id: 'red', label: 'Red', value: '#ff2a2a' },
	{ id: 'yellow', label: 'Yellow', value: '#ffe600' },
	{ id: 'green', label: 'Green', value: '#39ff14' },
	{ id: 'cyan', label: 'Cyan', value: '#00e5ff' }
] as const;

export type LookId = (typeof LOOKS)[number]['id'];
export type FrameId = (typeof FRAMES)[number]['id'];
export type SizeId = (typeof SIZES)[number]['id'];
export type ColorId = (typeof COLORS)[number]['id'];
export type BlinkId = (typeof BLINKS)[number]['id'];
export type DirectionId = (typeof DIRECTIONS)[number]['id'];

/** How long a shake or a tap on Blink keeps the sign blinking. */
export const BLINK_MS = 2000;
