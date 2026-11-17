import {
	BLINK_RATE,
	BLINKS,
	COLORS,
	DIRECTIONS,
	DRAWING,
	CUSTOM,
	FRAMES,
	LOOKS,
	SIZES,
	SPEED,
	type BlinkId,
	type SignColorId,
	type DirectionId,
	type FrameId,
	type LookId,
	type SizeId
} from './presets';
import { trimmed, type Drawing, type Stroke } from './drawing';

export type { Drawing, Stroke };

/**
 * A saved message or drawing (its text is then unused). Every message that is played is
 * kept in the list. `on` puts it in the playlist, which plays in list order.
 */
export type Entry = { id: string; text: string; drawing?: Drawing; on: boolean };
/** What the sign shows. */
export type Item = { text: string; drawing?: Drawing };
/** Whether Go shows the text box or the drawing pad. */
export type Mode = 'text' | 'draw';

type Saved = {
	mode: Mode;
	/** What is in the text box. */
	draft: string;
	/** What is on the drawing pad: strokes on the full strip, not yet trimmed. */
	sketch: Stroke[];
	/** The saved entry being edited, if any: Go then updates it in place. */
	editingId: string | null;
	entries: Entry[];
	size: SizeId;
	look: LookId;
	frame: FrameId;
	color: SignColorId;
	/** The color picked with the custom option, used when `color` is 'custom'. */
	customColor: string;
	/** The ink picked with the custom option in the drawing pad. */
	customInk: string;
	hdr: boolean;
	speed: number;
	direction: DirectionId;
	blink: BlinkId;
	blinkRate: number;
};

const KEY = 'marquee:v1';

/** Colors from the color picker: always #rrggbb. */
const HEX = /^#[0-9a-f]{6}$/i;
const hexOr = (value: unknown, fallback: string) =>
	typeof value === 'string' && HEX.test(value) ? value.toLowerCase() : fallback;

const newEntry = (text: string, drawing?: Drawing): Entry => ({
	id: crypto.randomUUID(),
	text,
	drawing,
	on: false
});

const oneOf = <T extends { id: string }>(list: readonly T[], id: unknown, fallback: T['id']) =>
	list.some((item) => item.id === id) ? (id as T['id']) : fallback;

/** Keeps only well-formed strokes in the sign color or a hex ink. Reads the older path-string format too. */
function loadDrawing(raw: unknown): Drawing | undefined {
	const saved = raw as { strokes?: unknown; width?: unknown } | undefined;
	if (!Array.isArray(saved?.strokes)) return undefined;
	const strokes: Stroke[] = [];
	for (const stroke of saved.strokes as { color?: unknown; points?: unknown; d?: unknown }[]) {
		const color = stroke?.color === null ? null : hexOr(stroke?.color, '');
		const points = Array.isArray(stroke?.points)
			? stroke.points
			: typeof stroke?.d === 'string'
				? (stroke.d.match(/\d+(\.\d+)?/g) ?? []).map(Number)
				: [];
		const valid = points.length >= 2 && points.length % 2 === 0 && points.every(Number.isFinite);
		if (color !== '' && valid) strokes.push({ color, points });
	}
	if (strokes.length === 0) return undefined;
	const width =
		typeof saved.width === 'number' && saved.width > 0 && saved.width <= DRAWING.maxWidth
			? saved.width
			: DRAWING.view;
	return { strokes, width };
}

/** A saved number, kept inside its slider's range. */
const within = (range: { min: number; max: number; initial: number }, value: unknown) =>
	typeof value === 'number' && Number.isFinite(value)
		? Math.min(Math.max(value, range.min), range.max)
		: range.initial;

/** Speed used to be one of three named presets. */
const LEGACY_SPEED: Record<string, number> = { slow: 0.3, medium: 0.55, fast: 0.95 };

function load(): Saved {
	let raw: Partial<Saved> = {};
	try {
		raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') ?? {};
	} catch {
		// Missing, corrupt or blocked storage: start fresh.
	}
	let entries: Entry[];
	let draft = typeof raw.draft === 'string' ? raw.draft : '';
	if (Array.isArray(raw.entries)) {
		entries = raw.entries
			.filter((e) => typeof e?.id === 'string' && typeof e?.text === 'string')
			.map((e) => ({ id: e.id, text: e.text, drawing: loadDrawing(e.drawing), on: e.on === true }));
	} else {
		// Older versions kept a playlist of cards, and the text box edited one of them. The
		// cards become entries; when there were several, they were a playlist, so they start on.
		const old = raw as { cards?: { id?: unknown; text?: unknown; drawing?: unknown }[]; selectedId?: unknown };
		const cards = (Array.isArray(old.cards) ? old.cards : []).filter(
			(c) => typeof c?.id === 'string' && typeof c?.text === 'string'
		) as { id: string; text: string; drawing?: unknown }[];
		draft = cards.find((c) => c.id === old.selectedId && !c.drawing)?.text ?? '';
		entries = cards
			.map((c) => ({ id: c.id, text: c.text, drawing: loadDrawing(c.drawing), on: cards.length > 1 }))
			.filter(hasContent);
	}
	entries = entries.filter(hasContent);
	const editingId = entries.some((e) => e.id === raw.editingId) ? raw.editingId! : null;
	return {
		mode: raw.mode === 'draw' ? 'draw' : 'text',
		draft,
		sketch: loadDrawing({ strokes: raw.sketch })?.strokes ?? [],
		editingId,
		entries,
		size: oneOf(SIZES, raw.size, 'big'),
		look: oneOf(LOOKS, raw.look, 'smooth'),
		frame: oneOf(FRAMES, raw.frame, 'none'),
		color: raw.color === 'custom' ? 'custom' : oneOf(COLORS, raw.color, 'white'),
		customColor: hexOr(raw.customColor, CUSTOM.color),
		customInk: hexOr(raw.customInk, CUSTOM.ink),
		hdr: raw.hdr === true,
		speed: within(SPEED, LEGACY_SPEED[raw.speed as unknown as string] ?? raw.speed),
		direction: oneOf(DIRECTIONS, raw.direction, 'left'),
		blink: oneOf(BLINKS, raw.blink, 'flash'),
		blinkRate: within(BLINK_RATE, raw.blinkRate)
	};
}

/** Messages are one line on the sign. */
export const clean = (text: string) => text.replace(/\s+/g, ' ').trim();

export const hasContent = (entry: Pick<Entry, 'text' | 'drawing'>) =>
	!!entry.drawing || clean(entry.text) !== '';

export const toItem = (entry: Pick<Entry, 'text' | 'drawing'>): Item => ({
	text: clean(entry.text),
	drawing: entry.drawing
});

/** Two drawings are the same when their strokes are. */
const sameDrawing = (a: Drawing, b: Drawing) => JSON.stringify(a.strokes) === JSON.stringify(b.strokes);

class Store {
	mode = $state<Mode>('text');
	draft = $state('');
	sketch = $state<Stroke[]>([]);
	editingId = $state<string | null>(null);
	entries = $state<Entry[]>([]);
	size = $state<SizeId>('big');
	look = $state<LookId>('smooth');
	frame = $state<FrameId>('none');
	color = $state<SignColorId>('white');
	customColor = $state<string>(CUSTOM.color);
	customInk = $state<string>(CUSTOM.ink);
	hdr = $state(false);
	speed = $state<number>(SPEED.initial);
	direction = $state<DirectionId>('left');
	blink = $state<BlinkId>('flash');
	blinkRate = $state<number>(BLINK_RATE.initial);

	constructor() {
		Object.assign(this, load());
	}

	/** The sign's text and background colors, from a preset or the custom color. */
	get colors(): { fg: string; bg: string } {
		if (this.color === 'custom') return { fg: this.customColor, bg: '#000000' };
		return COLORS.find((c) => c.id === this.color) ?? COLORS[0];
	}

	/** The entries switched on, in list order. */
	get playlist(): Entry[] {
		return this.entries.filter((e) => e.on);
	}

	/** The saved entry being edited, if any. */
	get editing(): Entry | undefined {
		return this.entries.find((e) => e.id === this.editingId);
	}

	/** What Go shows: the text box or the drawing pad, depending on the mode. */
	get current(): Item | null {
		if (this.mode === 'draw') {
			return this.sketch.length ? { text: '', drawing: trimmed($state.snapshot(this.sketch)) } : null;
		}
		const text = clean(this.draft);
		return text ? { text } : null;
	}

	/**
	 * Keeps what Go shows, as it is played. When editing a saved entry it replaces that one;
	 * otherwise it goes at the top, unless the same message or drawing is already saved.
	 */
	record() {
		const item = this.current;
		if (!item) return;
		const editing = this.editing;
		if (editing) {
			editing.text = item.text;
			editing.drawing = item.drawing;
		} else if (
			!this.entries.some((e) =>
				item.drawing ? e.drawing && sameDrawing(e.drawing, item.drawing) : !e.drawing && clean(e.text) === item.text
			)
		) {
			this.entries.unshift(newEntry(item.text, item.drawing));
		}
	}

	/** Puts a saved entry in the text box or on the drawing pad, to be changed and played again. */
	edit(id: string) {
		const entry = this.entries.find((e) => e.id === id);
		if (!entry) return;
		if (entry.drawing) {
			this.mode = 'draw';
			this.sketch = $state.snapshot(entry.drawing.strokes);
		} else {
			this.mode = 'text';
			this.draft = entry.text;
		}
		this.editingId = id;
	}

	/** Switches between text and drawing. Editing a saved entry of the other kind stops. */
	setMode(mode: Mode) {
		this.mode = mode;
		if (this.editing && !!this.editing.drawing !== (mode === 'draw')) this.stopEditing();
	}

	/** Lets go of the saved entry, keeping the text box and drawing pad as they are. */
	stopEditing() {
		this.editingId = null;
	}

	remove(id: string) {
		this.entries = this.entries.filter((e) => e.id !== id);
		if (this.editingId === id) this.editingId = null;
	}

	/** Moves an entry to a new place in the list. */
	move(from: number, to: number) {
		if (from === to || to < 0 || to >= this.entries.length) return;
		const [entry] = this.entries.splice(from, 1);
		this.entries.splice(to, 0, entry);
	}

	save() {
		const saved: Saved = {
			mode: this.mode,
			draft: this.draft,
			sketch: this.sketch,
			editingId: this.editingId,
			entries: this.entries,
			size: this.size,
			look: this.look,
			frame: this.frame,
			color: this.color,
			customColor: this.customColor,
			customInk: this.customInk,
			hdr: this.hdr,
			speed: this.speed,
			direction: this.direction,
			blink: this.blink,
			blinkRate: this.blinkRate
		};
		try {
			localStorage.setItem(KEY, JSON.stringify(saved));
		} catch {
			// Storage full or blocked (private mode): the app still works, it just forgets.
		}
	}
}

export const store = new Store();
