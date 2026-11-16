import {
	BLINK_RATE,
	BLINKS,
	COLORS,
	DIRECTIONS,
	DRAWING,
	FRAMES,
	INKS,
	LOOKS,
	SIZES,
	SPEED,
	type BlinkId,
	type ColorId,
	type DirectionId,
	type FrameId,
	type LookId,
	type SizeId
} from './presets';
import type { Drawing, Stroke } from './drawing';

export type { Drawing, Stroke };

/** A playlist entry: a text message, or a drawing (its text is then unused). */
export type Card = { id: string; text: string; drawing?: Drawing };
/** What the sign shows. */
export type Item = { text: string; drawing?: Drawing };

type Saved = {
	cards: Card[];
	selectedId: string;
	size: SizeId;
	look: LookId;
	frame: FrameId;
	color: ColorId;
	hdr: boolean;
	speed: number;
	direction: DirectionId;
	blink: BlinkId;
	blinkRate: number;
};

const KEY = 'marquee:v1';

const newCard = (text = ''): Card => ({ id: crypto.randomUUID(), text });

const oneOf = <T extends { id: string }>(list: readonly T[], id: unknown, fallback: T['id']) =>
	list.some((item) => item.id === id) ? (id as T['id']) : fallback;

/** Keeps only well-formed strokes in a known ink. Reads the older path-string format too. */
function loadDrawing(raw: unknown): Drawing | undefined {
	const saved = raw as { strokes?: unknown; width?: unknown } | undefined;
	if (!Array.isArray(saved?.strokes)) return undefined;
	const strokes: Stroke[] = [];
	for (const stroke of saved.strokes as { color?: unknown; points?: unknown; d?: unknown }[]) {
		const ink = INKS.find((option) => option.value === stroke?.color);
		const points = Array.isArray(stroke?.points)
			? stroke.points
			: typeof stroke?.d === 'string'
				? (stroke.d.match(/\d+(\.\d+)?/g) ?? []).map(Number)
				: [];
		const valid = points.length >= 2 && points.length % 2 === 0 && points.every(Number.isFinite);
		if (ink && valid) strokes.push({ color: ink.value, points });
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
	const cards: Card[] = (Array.isArray(raw.cards) ? raw.cards : [])
		.filter((c) => typeof c?.id === 'string' && typeof c?.text === 'string')
		.map((c) => ({ id: c.id, text: c.text, drawing: loadDrawing(c.drawing) }));
	// The text box always needs a text card to edit.
	if (!cards.some((c) => !c.drawing)) cards.push(newCard());
	const selected = cards.find((c) => c.id === raw.selectedId && !c.drawing) ?? cards.find((c) => !c.drawing)!;
	return {
		cards,
		selectedId: selected.id,
		size: oneOf(SIZES, raw.size, 'big'),
		look: oneOf(LOOKS, raw.look, 'smooth'),
		frame: oneOf(FRAMES, raw.frame, 'none'),
		color: oneOf(COLORS, raw.color, 'white'),
		hdr: raw.hdr === true,
		speed: within(SPEED, LEGACY_SPEED[raw.speed as unknown as string] ?? raw.speed),
		direction: oneOf(DIRECTIONS, raw.direction, 'left'),
		blink: oneOf(BLINKS, raw.blink, 'flash'),
		blinkRate: within(BLINK_RATE, raw.blinkRate)
	};
}

/** Messages are one line on the sign. */
export const clean = (text: string) => text.replace(/\s+/g, ' ').trim();

export const hasContent = (card: Card) => !!card.drawing || clean(card.text) !== '';

class Store {
	cards = $state<Card[]>([]);
	selectedId = $state('');
	size = $state<SizeId>('big');
	look = $state<LookId>('smooth');
	frame = $state<FrameId>('none');
	color = $state<ColorId>('white');
	hdr = $state(false);
	speed = $state<number>(SPEED.initial);
	direction = $state<DirectionId>('left');
	blink = $state<BlinkId>('flash');
	blinkRate = $state<number>(BLINK_RATE.initial);

	constructor() {
		Object.assign(this, load());
	}

	/** The card shown in the text box. Always a text card. */
	get selected(): Card {
		return this.cards.find((c) => c.id === this.selectedId) ?? this.cards.find((c) => !c.drawing)!;
	}

	/** Cards that have something to show. */
	get playable(): Card[] {
		return this.cards.filter(hasContent);
	}

	select(id: string) {
		this.selectedId = id;
		this.prune();
	}

	/** Puts a fresh, empty card in the text box. */
	add(text = '') {
		this.prune();
		if (clean(this.selected.text) === '') {
			this.selected.text = text;
			return;
		}
		const card = newCard(text);
		this.cards.push(card);
		this.selectedId = card.id;
	}

	/** Saves a drawing: over the card with this id, or as a new card. */
	saveDrawing(id: string | null, drawing: Drawing) {
		const existing = this.cards.find((c) => c.id === id);
		if (existing) existing.drawing = drawing;
		else this.cards.push({ ...newCard(), drawing });
	}

	remove(id: string) {
		const index = this.cards.findIndex((c) => c.id === id);
		if (index === -1) return;
		this.cards.splice(index, 1);
		const texts = this.cards.filter((c) => !c.drawing);
		if (texts.length === 0) {
			const card = newCard();
			this.cards.push(card);
			this.selectedId = card.id;
		} else if (this.selectedId === id) {
			const after = this.cards.slice(index).find((c) => !c.drawing);
			this.selectedId = (after ?? texts[texts.length - 1]).id;
		}
	}

	/** Drops abandoned empty cards, keeping the one in the text box. */
	prune() {
		const kept = this.cards.filter((c) => c.id === this.selectedId || hasContent(c));
		if (kept.length !== this.cards.length) this.cards = kept;
	}

	save() {
		const saved: Saved = {
			cards: this.cards,
			selectedId: this.selectedId,
			size: this.size,
			look: this.look,
			frame: this.frame,
			color: this.color,
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
