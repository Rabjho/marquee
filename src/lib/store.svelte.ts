import {
	BLINK_RATE,
	BLINKS,
	COLORS,
	DIRECTIONS,
	DRAWING,
	CUSTOM_COLOR,
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
 * The color a message or drawing was made in: a preset id, or a custom #rrggbb. For a drawing
 * it sets the background (black, or white for black on white); its strokes keep their own colors.
 */
export type ColorKey = string;
/**
 * A saved message or drawing (its text is then unused), with its color. Every message that is
 * played is kept.
 */
export type Entry = { id: string; text: string; drawing?: Drawing; color?: ColorKey };
/** What the sign shows. */
export type Item = { text: string; drawing?: Drawing; color?: ColorKey };
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
	/** Ids of the entries in the playlist, in the order they were added, which is the order they play in. */
	playlistIds: string[];
	size: SizeId;
	look: LookId;
	frame: FrameId;
	/** The frame blinks by itself, at the blink speed, whatever the message does. */
	frameBlink: boolean;
	color: SignColorId;
	/** The color picked with the custom option. */
	customColor: string;
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

const newEntry = (item: Item): Entry => ({ id: crypto.randomUUID(), ...item });

/** A saved color key, if it is a preset or a hex color. */
const loadColor = (value: unknown): ColorKey | undefined =>
	COLORS.some((c) => c.id === value) ? (value as string) : hexOr(value, '') || undefined;

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
	let entries: (Entry & { on?: boolean })[];
	let draft = typeof raw.draft === 'string' ? raw.draft : '';
	if (Array.isArray(raw.entries)) {
		entries = raw.entries
			.filter((e) => typeof e?.id === 'string' && typeof e?.text === 'string')
			.map((e) => ({
				id: e.id,
				text: e.text,
				drawing: loadDrawing(e.drawing),
				color: loadColor(e.color),
				on: (e as { on?: unknown }).on === true
			}));
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
	// Entries from before colors were saved keep the color the sign had then.
	const color = raw.color === 'custom' ? 'custom' : oneOf(COLORS, raw.color, 'white');
	const customColor = hexOr(raw.customColor, CUSTOM_COLOR);
	for (const entry of entries) entry.color ??= color === 'custom' ? customColor : color;
	const ids = new Set(entries.map((e) => e.id));
	// Older versions marked playlist entries with `on` and played them in list order.
	const playlistIds = Array.isArray(raw.playlistIds)
		? [...new Set(raw.playlistIds.filter((id) => ids.has(id)))]
		: entries.filter((e) => e.on).map((e) => e.id);
	const editingId = entries.some((e) => e.id === raw.editingId) ? raw.editingId! : null;
	return {
		mode: raw.mode === 'draw' ? 'draw' : 'text',
		draft,
		sketch: loadDrawing({ strokes: raw.sketch })?.strokes ?? [],
		editingId,
		entries: entries.map(({ id, text, drawing, color }) => ({ id, text, drawing, color })),
		playlistIds,
		size: oneOf(SIZES, raw.size, 'big'),
		look: oneOf(LOOKS, raw.look, 'smooth'),
		frame: oneOf(FRAMES, raw.frame, 'none'),
		frameBlink: raw.frameBlink === true,
		color,
		customColor,
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

export const toItem = (entry: Pick<Entry, 'text' | 'drawing' | 'color'>): Item => ({
	text: clean(entry.text),
	drawing: entry.drawing,
	color: entry.color
});

/** The colors extra-bright can show. */
export const HDR_COLORS: SignColorId[] = ['white', 'paper'];

/** Two drawings are the same when their strokes are. */
const sameDrawing = (a: Drawing, b: Drawing) => JSON.stringify(a.strokes) === JSON.stringify(b.strokes);

/** Two items are the same message, or the same drawing, in the same color. */
const sameItem = (a: Item, b: Item) =>
	a.color === b.color &&
	(a.drawing && b.drawing ? sameDrawing(a.drawing, b.drawing) : !a.drawing && !b.drawing && a.text === b.text);

/** White strokes on a black sign, black ones on a white sign. */
export const baseFor = (colors: { bg: string }) => (colors.bg === '#000000' ? '#ffffff' : '#000000');

class Store {
	mode = $state<Mode>('text');
	draft = $state('');
	sketch = $state<Stroke[]>([]);
	editingId = $state<string | null>(null);
	entries = $state<Entry[]>([]);
	playlistIds = $state<string[]>([]);
	size = $state<SizeId>('big');
	look = $state<LookId>('smooth');
	frame = $state<FrameId>('none');
	frameBlink = $state(false);
	color = $state<SignColorId>('white');
	customColor = $state<string>(CUSTOM_COLOR);
	hdr = $state(false);
	speed = $state<number>(SPEED.initial);
	direction = $state<DirectionId>('left');
	blink = $state<BlinkId>('flash');
	blinkRate = $state<number>(BLINK_RATE.initial);

	constructor() {
		Object.assign(this, load());
	}

	/**
	 * The sign's text and background colors, from a preset or the custom color. Extra-bright
	 * only has HDR white to work with, so it allows white on black and black on white.
	 */
	get colors(): { fg: string; bg: string } {
		return this.colorsFor(this.colorKey);
	}

	/** The color picked right now, as it is saved with a message or drawing. */
	get colorKey(): ColorKey {
		return this.color === 'custom' ? this.customColor : this.color;
	}

	/**
	 * Text and background colors for a saved color, or the current one for entries saved
	 * without. Extra-bright only has HDR white to work with, so anything else becomes white.
	 */
	colorsFor(key: ColorKey | undefined): { fg: string; bg: string } {
		key ??= this.colorKey;
		const preset = COLORS.find((c) => c.id === key);
		if (this.hdr && !(preset && HDR_COLORS.includes(preset.id))) return COLORS[0];
		return preset ?? { fg: key, bg: '#000000' };
	}

	/**
	 * What a drawing's plain strokes show in: white on a black sign, black on a white one.
	 * The text color never touches a drawing.
	 */
	get base(): string {
		return baseFor(this.colors);
	}

	/**
	 * The color a new stroke is drawn in. White and black on white draw plain strokes (null),
	 * which take `base`, so switching between them swaps black and white across the drawing.
	 */
	get pen(): string | null {
		return this.hdr || this.color === 'white' || this.color === 'paper' ? null : this.colors.fg;
	}

	/** The playlist, in the order its entries were added. */
	get playlist(): Entry[] {
		return this.playlistIds.flatMap((id) => this.entries.find((e) => e.id === id) ?? []);
	}

	/**
	 * What Go plays and the preview shows: the playlist, with what is in the text box or on
	 * the pad in it too. A saved entry being edited plays in its own place, with the changes;
	 * anything else being edited plays last. With no playlist, that is just the one item.
	 */
	get lineup(): Item[] {
		const current = this.current;
		const items = this.playlist.map((e) => (current && e.id === this.editingId ? current : toItem(e)));
		if (current && !items.some((item) => sameItem(item, current))) items.push(current);
		return items;
	}

	/** An entry's place in the playlist, from 1, or 0 when it is not in it. */
	place(id: string): number {
		return this.playlistIds.indexOf(id) + 1;
	}

	/** Adds an entry to the end of the playlist, or takes it out. */
	togglePlaylist(id: string) {
		this.playlistIds = this.place(id)
			? this.playlistIds.filter((p) => p !== id)
			: [...this.playlistIds, id];
	}

	/** Empties the playlist. The saved entries stay. */
	clearPlaylist() {
		this.playlistIds = [];
	}

	/** Deletes every saved entry, and with them the playlist. */
	clearHistory() {
		this.entries = [];
		this.playlistIds = [];
		this.editingId = null;
	}

	/** The saved entry being edited, if any. */
	get editing(): Entry | undefined {
		return this.entries.find((e) => e.id === this.editingId);
	}

	/** What Go shows: the text box or the drawing pad, depending on the mode. */
	get current(): Item | null {
		if (this.mode === 'draw') {
			return this.sketch.length
				? { text: '', drawing: trimmed($state.snapshot(this.sketch)), color: this.colorKey }
				: null;
		}
		const text = clean(this.draft);
		return text ? { text, color: this.colorKey } : null;
	}

	/**
	 * Keeps what Go shows, with its color, as it is played. When editing a saved entry it
	 * replaces that one; otherwise it goes at the top, unless it is already saved in that color.
	 */
	record() {
		const item = this.current;
		if (!item) return;
		const editing = this.editing;
		if (editing) {
			Object.assign(editing, item);
		} else if (!this.entries.some((e) => sameItem(toItem(e), item))) {
			this.entries.unshift(newEntry(item));
		}
	}

	/** Puts a saved entry in the text box or on the drawing pad, in its color, to be changed and played again. */
	edit(id: string) {
		const entry = this.entries.find((e) => e.id === id);
		if (!entry) return;
		if (entry.color?.startsWith('#')) {
			this.color = 'custom';
			this.customColor = entry.color;
		} else if (entry.color) {
			this.color = entry.color as SignColorId;
		}
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

	/** Empties the text box and drawing pad, as after Go: what was there is in the saved list. */
	clearEditor() {
		this.draft = '';
		this.sketch = [];
		this.editingId = null;
	}

	/** Lets go of the saved entry, keeping the text box and drawing pad as they are. */
	stopEditing() {
		this.editingId = null;
	}

	remove(id: string) {
		this.entries = this.entries.filter((e) => e.id !== id);
		this.playlistIds = this.playlistIds.filter((p) => p !== id);
		if (this.editingId === id) this.editingId = null;
	}

	save() {
		const saved: Saved = {
			mode: this.mode,
			draft: this.draft,
			sketch: this.sketch,
			editingId: this.editingId,
			entries: this.entries,
			playlistIds: this.playlistIds,
			size: this.size,
			look: this.look,
			frame: this.frame,
			frameBlink: this.frameBlink,
			color: this.color,
			customColor: this.customColor,
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
