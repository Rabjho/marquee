// Draws the sign onto a canvas, one frame at a time. Everything visual lives here:
// the scrolling message, the looks (smooth, LED, pixel), frames, blinking and HDR.
//
// Only what is on screen is drawn each frame, so a message can be any length.

import { DRAWING } from './presets';
import type { Item } from './store.svelte';

export type Look = 'smooth' | 'led' | 'pixel';
export type Frame = 'none' | 'line' | 'bulbs';
export type Blink = 'flash' | 'strobe' | 'invert';

export type Settings = {
	fg: string;
	bg: string;
	/** Content height as a share of the sign height. */
	scale: number;
	/** Scroll speed in sign widths per second. */
	speed: number;
	leftward: boolean;
	look: Look;
	frame: Frame;
	/**
	 * Extra-bright mode. The canvas is laid over an HDR white video, and the message is cut
	 * out of an opaque black canvas, so the HDR white shines through the letter shapes.
	 */
	hdr: boolean;
	blink: Blink;
	/** Blinks per second. */
	blinkRate: number;
};

/** A color, or 'hdr': a hole in the canvas that shows the HDR white behind it. */
type Paint = string;
const HDR = 'hdr';

type Piece = { text: string; emoji: boolean; x: number; width: number };
type Layout = { key: string; pieces: Piece[]; width: number; rtl: boolean };

/** Rows of dots in the LED and pixel looks. */
const ROWS = 32;
/** How long a message that fits stays up before `onend`, when not looping. */
const HOLD_MS = 3000;
/** Frame bulbs advance this many times per second. */
const CHASE_HZ = 3;
const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
const EMOJI =
	/((?:\p{Regional_Indicator}{2}|\p{Extended_Pictographic})(?:️|‍\p{Extended_Pictographic}|[\u{1F3FB}-\u{1F3FF}])*)/u;
const RTL = /[֐-ࣿיִ-﷿ﹰ-﻿]/;
const STRONG = /[\p{L}]/u;

/** Splits a message into pieces small enough to skip when they are off screen. */
function split(text: string): { text: string; emoji: boolean }[] {
	const out: { text: string; emoji: boolean }[] = [];
	for (const word of text.split(/(?<=\s)/)) {
		for (const [i, part] of word.split(EMOJI).entries()) {
			if (!part) continue;
			if (i % 2 === 1) {
				out.push({ text: part, emoji: true });
				continue;
			}
			// A very long unbroken run is cut up too, on whole characters.
			const chars = Array.from(part);
			for (let c = 0; c < chars.length; c += 24) {
				out.push({ text: chars.slice(c, c + 24).join(''), emoji: false });
			}
		}
	}
	return out;
}

export class SignRenderer {
	/** Called once when a non-looping item has finished its pass. */
	onend: (() => void) | null = null;
	/** Called when it becomes known whether the item is too wide to fit and so scrolls. */
	onscrolls: ((scrolls: boolean) => void) | null = null;

	#canvas: HTMLCanvasElement;
	#ctx: CanvasRenderingContext2D;
	#grid: HTMLCanvasElement;
	#gridCtx: CanvasRenderingContext2D;

	#settings: Settings;
	#item: Item | null = null;
	#paths: { color: string | null; path: Path2D }[] = [];
	#loop = true;
	#still = false;
	#blinking = false;
	#blinkStart = 0;

	#layout: Layout | null = null;
	/** Distance scrolled, in sign widths. */
	#travelled = 0;
	#held = 0;
	#ended = false;
	#scrolls: boolean | null = null;
	#lastTime = 0;
	#lastKey = '';
	#raf = 0;

	constructor(canvas: HTMLCanvasElement, settings: Settings) {
		this.#canvas = canvas;
		this.#ctx = canvas.getContext('2d')!;
		this.#grid = document.createElement('canvas');
		this.#gridCtx = this.#grid.getContext('2d', { willReadFrequently: true })!;
		this.#settings = settings;
	}

	start() {
		const tick = (time: number) => {
			this.#raf = requestAnimationFrame(tick);
			this.#frame(time);
		};
		this.#raf = requestAnimationFrame(tick);
	}

	stop() {
		cancelAnimationFrame(this.#raf);
	}

	/** Sets the canvas size in device pixels. */
	resize(width: number, height: number) {
		if (this.#canvas.width === width && this.#canvas.height === height) return;
		this.#canvas.width = width;
		this.#canvas.height = height;
		this.#lastKey = '';
	}

	set settings(settings: Settings) {
		this.#settings = settings;
		this.#lastKey = '';
	}

	set still(still: boolean) {
		this.#still = still;
	}

	set loop(loop: boolean) {
		this.#loop = loop;
	}

	set blinking(blinking: boolean) {
		if (blinking && !this.#blinking) this.#blinkStart = performance.now();
		this.#blinking = blinking;
	}

	/** Shows a new item from the start, or a blank sign for null. */
	set item(item: Item | null) {
		this.#item = item;
		this.#paths = (item?.drawing?.strokes ?? []).map((s) => ({
			color: s.color,
			path: new Path2D(s.d)
		}));
		this.#layout = null;
		this.#travelled = 0;
		this.#held = 0;
		this.#ended = false;
		this.#lastKey = '';
	}

	// ---------------------------------------------------------------- layout

	/** Measures the item for a given content height. All positions are in that canvas's pixels. */
	#measure(ctx: CanvasRenderingContext2D, contentHeight: number, weight: number): Layout {
		const item = this.#item!;
		const key = `${contentHeight}|${weight}`;
		if (this.#layout?.key === key) return this.#layout;

		if (item.drawing) {
			const width = (contentHeight * DRAWING.width) / DRAWING.height;
			return (this.#layout = { key, pieces: [], width, rtl: false });
		}

		ctx.font = `${weight} ${contentHeight}px ${FONT}`;
		const firstStrong = item.text.match(STRONG)?.[0] ?? '';
		const rtl = RTL.test(firstStrong);
		let width = 0;
		const pieces = split(item.text).map((piece) => {
			const w = ctx.measureText(piece.text).width;
			const placed = { ...piece, x: width, width: w };
			width += w;
			return placed;
		});
		// Right-to-left text reads from the right edge, so its pieces are placed in reverse.
		if (rtl) for (const piece of pieces) piece.x = width - piece.x - piece.width;
		return (this.#layout = { key, pieces, width, rtl });
	}

	/**
	 * Where the content's left edge is, in view widths scaled to `viewWidth`, after `dt` ms.
	 * Also tracks whether the item has finished its pass.
	 */
	#position(layout: Layout, viewWidth: number, dt: number): number {
		const fits = layout.width <= viewWidth;
		if (this.#scrolls !== !fits) {
			this.#scrolls = !fits;
			this.onscrolls?.(!fits);
		}

		if (fits || this.#still) {
			this.#held += dt;
			if (!this.#loop && this.#held >= HOLD_MS) this.#end();
			return fits ? (viewWidth - layout.width) / 2 : 0;
		}

		const total = (viewWidth + layout.width) / viewWidth;
		this.#travelled += (dt / 1000) * this.#settings.speed;
		if (this.#travelled >= total) {
			if (this.#loop) this.#travelled %= total;
			else {
				this.#travelled = total;
				this.#end();
			}
		}
		const distance = this.#travelled * viewWidth;
		return this.#settings.leftward ? viewWidth - distance : distance - layout.width;
	}

	#end() {
		if (this.#ended) return;
		this.#ended = true;
		this.onend?.();
	}

	// --------------------------------------------------------------- painting

	/** Fills with a paint; an HDR paint punches through to the video behind the canvas. */
	#use(ctx: CanvasRenderingContext2D, paint: Paint) {
		ctx.globalCompositeOperation = paint === HDR ? 'destination-out' : 'source-over';
		ctx.fillStyle = ctx.strokeStyle = paint === HDR ? '#000' : paint;
	}

	/** Paints the item with its left edge at `x`, vertically centred in a band `bandHeight` tall. */
	#paintItem(
		ctx: CanvasRenderingContext2D,
		layout: Layout,
		x: number,
		viewWidth: number,
		bandHeight: number,
		contentHeight: number,
		weight: number,
		ink: Paint
	) {
		if (this.#item?.drawing) {
			const k = contentHeight / DRAWING.height;
			ctx.save();
			ctx.translate(x, (bandHeight - contentHeight) / 2);
			ctx.scale(k, k);
			ctx.lineWidth = DRAWING.brush;
			ctx.lineCap = ctx.lineJoin = 'round';
			for (const { color, path } of this.#paths) {
				this.#use(ctx, color ?? ink);
				ctx.stroke(path);
			}
			ctx.restore();
			return;
		}

		ctx.font = `${weight} ${contentHeight}px ${FONT}`;
		ctx.textBaseline = 'middle';
		ctx.textAlign = 'left';
		ctx.direction = layout.rtl ? 'rtl' : 'ltr';
		const y = bandHeight / 2 + contentHeight * 0.04;
		for (const piece of layout.pieces) {
			const left = x + piece.x;
			if (left > viewWidth || left + piece.width < 0) continue;
			// Emoji keep their own colors; only the letters take the ink.
			this.#use(ctx, piece.emoji ? '#fff' : ink);
			ctx.fillText(piece.text, left, y);
		}
		ctx.globalCompositeOperation = 'source-over';
	}

	#frame(time: number) {
		const ctx = this.#ctx;
		const { width, height } = this.#canvas;
		if (!width || !height) return;
		const s = this.#settings;
		const dt = Math.min(time - (this.#lastTime || time), 100);
		this.#lastTime = time;

		// Colors for this instant. In HDR the message is always HDR white on black.
		let ink: Paint = s.hdr ? HDR : s.fg;
		let ground: Paint = s.hdr ? '#000' : s.bg;
		let show = this.#item !== null;
		let flood = false;
		if (this.#blinking) {
			const phase = (((time - this.#blinkStart) / 1000) * s.blinkRate) % 1;
			if (s.blink === 'flash') show &&= phase >= 0.5;
			else if (s.blink === 'strobe') flood = phase < 0.2;
			else if (phase < 0.5) [ink, ground] = [ground, ink];
		}

		// The frame takes a margin; the message lives in the rectangle inside it.
		const margin = s.frame === 'none' ? 0 : Math.round(height * (s.frame === 'bulbs' ? 0.1 : 0.07));
		const innerWidth = width - margin * 2;
		const innerHeight = height - margin * 2;
		const chase = s.frame === 'bulbs' ? Math.floor((time / 1000) * CHASE_HZ) % 3 : 0;

		const lowRes = s.look !== 'smooth';
		const cell = innerHeight / ROWS;
		const columns = Math.ceil(innerWidth / cell);
		const viewWidth = lowRes ? columns : innerWidth;
		const bandHeight = lowRes ? ROWS : innerHeight;
		const contentHeight = Math.round(bandHeight * s.scale);
		const weight = lowRes ? 700 : 900;

		let x = 0;
		let layout: Layout | null = null;
		if (this.#item) {
			layout = this.#measure(lowRes ? this.#gridCtx : ctx, contentHeight, weight);
			x = this.#position(layout, viewWidth, dt);
			if (lowRes) x = Math.round(x);
		}

		// Skip the work when nothing visible has changed since the last frame.
		const moving = !lowRes && show && this.#scrolls && !this.#still && !this.#ended;
		const key = [x, show, flood, ink, ground, chase, width, height].join();
		if (!moving && key === this.#lastKey) return;
		this.#lastKey = key;

		ctx.globalAlpha = 1;
		if (flood) {
			ctx.clearRect(0, 0, width, height);
			if (ink !== HDR) {
				this.#use(ctx, ink);
				ctx.fillRect(0, 0, width, height);
			}
			return;
		}
		ctx.globalCompositeOperation = 'source-over';
		ctx.clearRect(0, 0, width, height);
		if (ground !== HDR) {
			ctx.fillStyle = ground;
			ctx.fillRect(0, 0, width, height);
		}

		this.#paintFrame(ctx, width, height, margin, chase, ink);

		ctx.save();
		ctx.beginPath();
		ctx.rect(margin, margin, innerWidth, innerHeight);
		ctx.clip();
		ctx.translate(margin, margin);
		if (!lowRes) {
			if (show && layout) {
				this.#paintItem(ctx, layout, x, viewWidth, bandHeight, contentHeight, weight, ink);
			}
		} else {
			this.#paintDots(ctx, show ? layout : null, x, columns, cell, contentHeight, weight, ink);
		}
		ctx.restore();
		ctx.globalCompositeOperation = 'source-over';
		ctx.globalAlpha = 1;
	}

	/** LED and pixel looks: draw the message tiny, then redraw each of its pixels as a dot or square. */
	#paintDots(
		ctx: CanvasRenderingContext2D,
		layout: Layout | null,
		x: number,
		columns: number,
		cell: number,
		contentHeight: number,
		weight: number,
		ink: Paint
	) {
		const grid = this.#gridCtx;
		if (this.#grid.width !== columns || this.#grid.height !== ROWS) {
			this.#grid.width = columns;
			this.#grid.height = ROWS;
		}
		grid.globalCompositeOperation = 'source-over';
		grid.clearRect(0, 0, columns, ROWS);
		// Letters are drawn pure white, which is how they are told apart from emoji below.
		if (layout) this.#paintItem(grid, layout, x, columns, ROWS, contentHeight, weight, '#fff');
		const data = grid.getImageData(0, 0, columns, ROWS).data;

		const led = this.#settings.look === 'led';
		const radius = cell * 0.42;
		const lit = new Path2D();
		const unlit = new Path2D();
		const dot = (path: Path2D, column: number, row: number) => {
			if (led) {
				const cx = (column + 0.5) * cell;
				path.moveTo(cx + radius, (row + 0.5) * cell);
				path.arc(cx, (row + 0.5) * cell, radius, 0, Math.PI * 2);
			} else {
				// Squares overlap by a hair so no seams show between them.
				path.rect(column * cell, row * cell, cell + 0.5, cell + 0.5);
			}
		};

		const colored: [number, number, string][] = [];
		for (let row = 0; row < ROWS; row++) {
			for (let column = 0; column < columns; column++) {
				const i = (row * columns + column) * 4;
				if (data[i + 3] < 110) {
					if (led) dot(unlit, column, row);
				} else if (data[i] > 240 && data[i + 1] > 240 && data[i + 2] > 240) {
					dot(lit, column, row);
				} else {
					colored.push([column, row, `rgb(${data[i]} ${data[i + 1]} ${data[i + 2]})`]);
				}
			}
		}

		// Unlit LEDs glow faintly, as on a real sign.
		ctx.globalCompositeOperation = 'source-over';
		ctx.globalAlpha = 0.13;
		ctx.fillStyle = ink === HDR ? '#fff' : ink;
		ctx.fill(unlit);
		ctx.globalAlpha = 1;
		this.#use(ctx, ink);
		ctx.fill(lit);
		ctx.globalCompositeOperation = 'source-over';
		for (const [column, row, color] of colored) {
			const one = new Path2D();
			dot(one, column, row);
			ctx.fillStyle = color;
			ctx.fill(one);
		}
	}

	#paintFrame(
		ctx: CanvasRenderingContext2D,
		width: number,
		height: number,
		margin: number,
		chase: number,
		ink: Paint
	) {
		const frame = this.#settings.frame;
		if (frame === 'none') return;

		if (frame === 'line') {
			const thickness = margin * 0.4;
			this.#use(ctx, ink);
			ctx.lineWidth = thickness;
			ctx.strokeRect(margin / 2, margin / 2, width - margin, height - margin);
			return;
		}

		// Bulbs evenly spaced around the edge, every third one lit, the lit ones chasing round.
		const inset = margin / 2;
		const radius = margin * 0.3;
		const w = width - margin;
		const h = height - margin;
		const perimeter = 2 * (w + h);
		const count = Math.max(3, Math.round(perimeter / (radius * 3.4) / 3) * 3);
		const lit = new Path2D();
		const unlit = new Path2D();
		for (let i = 0; i < count; i++) {
			let d = (i / count) * perimeter;
			let bx: number;
			let by: number;
			if (d < w) [bx, by] = [inset + d, inset];
			else if ((d -= w) < h) [bx, by] = [inset + w, inset + d];
			else if ((d -= h) < w) [bx, by] = [inset + w - d, inset + h];
			else [bx, by] = [inset, inset + h - (d - w)];
			const path = (i + 3 - chase) % 3 === 0 ? lit : unlit;
			path.moveTo(bx + radius, by);
			path.arc(bx, by, radius, 0, Math.PI * 2);
		}
		ctx.globalCompositeOperation = 'source-over';
		ctx.globalAlpha = 0.22;
		ctx.fillStyle = ink === HDR ? '#fff' : ink;
		ctx.fill(unlit);
		ctx.globalAlpha = 1;
		this.#use(ctx, ink);
		ctx.fill(lit);
		ctx.globalCompositeOperation = 'source-over';
	}
}
