import {
	BLINKS,
	COLORS,
	DIRECTIONS,
	INKS,
	SIZES,
	SPEEDS,
	type BlinkId,
	type ColorId,
	type DirectionId,
	type SizeId,
	type SpeedId
} from './presets';

export type Stroke = { color: string | null; d: string };
export type Drawing = { strokes: Stroke[] };
/** A playlist entry: a text message, or a drawing (its text is then unused). */
export type Card = { id: string; text: string; drawing?: Drawing };
/** What the sign shows. */
export type Item = { text: string; drawing?: Drawing };

type Saved = {
	cards: Card[];
	selectedId: string;
	size: SizeId;
	speed: SpeedId;
	color: ColorId;
	blink: BlinkId;
	direction: DirectionId;
};

const KEY = 'marquee:v1';

const newCard = (text = ''): Card => ({ id: crypto.randomUUID(), text });

const oneOf = <T extends { id: string }>(list: readonly T[], id: unknown, fallback: T['id']) =>
	list.some((item) => item.id === id) ? (id as T['id']) : fallback;

/** Keeps only well-formed strokes: plain move/line path data in a known ink. */
function loadDrawing(raw: unknown): Drawing | undefined {
	const strokes = (raw as Drawing | undefined)?.strokes;
	if (!Array.isArray(strokes)) return undefined;
	const valid = strokes
		.filter(
			(s) =>
				typeof s?.d === 'string' &&
				/^[ML\d. ]+$/.test(s.d) &&
				INKS.some((ink) => ink.value === s.color)
		)
		.map((s) => ({ color: s.color, d: s.d }));
	return valid.length ? { strokes: valid } : undefined;
}

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
		speed: oneOf(SPEEDS, raw.speed, 'medium'),
		color: oneOf(COLORS, raw.color, 'white'),
		blink: oneOf(BLINKS, raw.blink, 'flash'),
		direction: oneOf(DIRECTIONS, raw.direction, 'left')
	};
}

/** Messages are one line on the sign. */
export const clean = (text: string) => text.replace(/\s+/g, ' ').trim();

export const hasContent = (card: Card) => !!card.drawing || clean(card.text) !== '';

class Store {
	cards = $state<Card[]>([]);
	selectedId = $state('');
	size = $state<SizeId>('big');
	speed = $state<SpeedId>('medium');
	color = $state<ColorId>('white');
	blink = $state<BlinkId>('flash');
	direction = $state<DirectionId>('left');

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
			speed: this.speed,
			color: this.color,
			blink: this.blink,
			direction: this.direction
		};
		try {
			localStorage.setItem(KEY, JSON.stringify(saved));
		} catch {
			// Storage full or blocked (private mode): the app still works, it just forgets.
		}
	}
}

export const store = new Store();
