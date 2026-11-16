import {
	BLINKS,
	COLORS,
	DIRECTIONS,
	SPEEDS,
	type BlinkId,
	type ColorId,
	type DirectionId,
	type SpeedId
} from './presets';

export type Card = { id: string; text: string };

type Saved = {
	cards: Card[];
	selectedId: string;
	speed: SpeedId;
	color: ColorId;
	blink: BlinkId;
	direction: DirectionId;
};

const KEY = 'marquee:v1';

const newCard = (text = ''): Card => ({ id: crypto.randomUUID(), text });

const oneOf = <T extends { id: string }>(list: readonly T[], id: unknown, fallback: T['id']) =>
	list.some((item) => item.id === id) ? (id as T['id']) : fallback;

function load(): Saved {
	let raw: Partial<Saved> = {};
	try {
		raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') ?? {};
	} catch {
		// Missing, corrupt or blocked storage: start fresh.
	}
	const cards = (Array.isArray(raw.cards) ? raw.cards : [])
		.filter((c) => typeof c?.id === 'string' && typeof c?.text === 'string')
		.map((c) => ({ id: c.id, text: c.text }));
	if (cards.length === 0) cards.push(newCard());
	return {
		cards,
		selectedId: cards.find((c) => c.id === raw.selectedId)?.id ?? cards[0].id,
		speed: oneOf(SPEEDS, raw.speed, 'medium'),
		color: oneOf(COLORS, raw.color, 'white'),
		blink: oneOf(BLINKS, raw.blink, 'flash'),
		direction: oneOf(DIRECTIONS, raw.direction, 'left')
	};
}

/** Messages are one line on the sign. */
export const clean = (text: string) => text.replace(/\s+/g, ' ').trim();

class Store {
	cards = $state<Card[]>([]);
	selectedId = $state('');
	speed = $state<SpeedId>('medium');
	color = $state<ColorId>('white');
	blink = $state<BlinkId>('flash');
	direction = $state<DirectionId>('left');

	constructor() {
		Object.assign(this, load());
	}

	/** The card shown in the text box. */
	get selected(): Card {
		return this.cards.find((c) => c.id === this.selectedId) ?? this.cards[0];
	}

	/** Cards that have something to show. */
	get playable(): Card[] {
		return this.cards.filter((c) => clean(c.text) !== '');
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

	remove(id: string) {
		const index = this.cards.findIndex((c) => c.id === id);
		if (index === -1) return;
		if (this.cards.length === 1) {
			this.cards[0].text = '';
			return;
		}
		this.cards.splice(index, 1);
		if (this.selectedId === id) {
			this.selectedId = this.cards[Math.min(index, this.cards.length - 1)].id;
		}
	}

	/** Drops abandoned empty cards, keeping the one in the text box. */
	prune() {
		const kept = this.cards.filter((c) => c.id === this.selectedId || clean(c.text) !== '');
		if (kept.length !== this.cards.length) this.cards = kept;
	}

	save() {
		const saved: Saved = {
			cards: this.cards,
			selectedId: this.selectedId,
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
