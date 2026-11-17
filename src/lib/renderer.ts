// Draws the sign onto a canvas, one frame at a time. Everything visual lives here:
// the scrolling message, the looks (smooth, circles, pixels, ASCII), frames, blinking and HDR.
//
// Only what is on screen is drawn each frame, so a message can be any length.

import { glyph, GLYPH_HEIGHT } from './font5x7';
import { DRAWING } from './presets';
import type { Item } from './store.svelte';

/** 'led' is the circles look. */
export type Look = 'smooth' | 'led' | 'pixels' | 'ascii';
export type Frame = 'none' | 'line' | 'bulbs' | 'stripes';
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
	/** The frame blinks by itself at `blinkRate`, whether or not the message is blinking. */
	frameBlink: boolean;
	/**
	 * Extra-bright mode. The canvas is laid over an HDR white video. White on black cuts the
	 * message out of an opaque black canvas, so the HDR white shines through the letter
	 * shapes; black on white cuts out the background instead and draws the letters black.
	 */
	hdr: boolean;
	blink: Blink;
	/** Blinks per second. */
	blinkRate: number;
};

/** A color, or 'hdr': a hole in the canvas that shows the HDR white behind it. */
type Paint = string;
const HDR = 'hdr';

/**
 * A stretch of the message that is measured and drawn as one unit:
 * - text: letters in the system font, which take the ink color
 * - emoji: drawn in the system font with their own colors
 * - dots: letters in the 5×7 dot font (the dot looks)
 */
type Piece = { kind: 'text' | 'emoji' | 'dots'; text: string; x: number; width: number };
type Layout = { key: string; pieces: Piece[]; width: number; rtl: boolean };

/** How the message is laid out for the current look. */
type Mode = {
	/** Width and height of the area the message scrolls through, in layout units. */
	viewWidth: number;
	bandHeight: number;
	/** Height of system-font text and of drawings, in layout units. */
	textHeight: number;
	drawingHeight: number;
	weight: number;
	/** Whether letters use the dot font. */
	dots: boolean;
	/** Positions snap to multiples of this, so dots never land between cells. */
	snap: number;
};

/** How long a message that fits stays up before `onend`, when not looping. */
const HOLD_MS = 3000;
/** Frame bulbs advance this many times per second. */
const CHASE_HZ = 3;
/** Frame stripes travel round this many stripe widths per second. */
const STRIPE_HZ = 1.5;
/** Each dot is drawn as this many samples across and down, to see how much of it is covered. */
const SAMPLES = 4;
/** The share of a dot that must be covered for it to light. */
const COVERAGE = 0.3;
const FONT = "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";
const EMOJI =
	/((?:\p{Regional_Indicator}{2}|\p{Extended_Pictographic})(?:️|‍\p{Extended_Pictographic}|[\u{1F3FB}-\u{1F3FF}])*)/u;
const RTL = /[֐-ࣿיִ-﷿ﹰ-﻿]/;
const STRONG = /\p{L}/u;

/** Splits a message into pieces small enough to skip when they are off screen. */
function split(text: string, dots: boolean): Pick<Piece, 'kind' | 'text'>[] {
	const out: Pick<Piece, 'kind' | 'text'>[] = [];
	for (const word of text.split(/(?<=\s)/)) {
		for (const [i, part] of word.split(EMOJI).entries()) {
			if (!part) continue;
			if (i % 2 === 1) {
				out.push({ kind: 'emoji', text: part });
				continue;
			}
			const chars = Array.from(part);
			if (dots) {
				// Runs the dot font can draw, separated from characters it has no glyph for.
				let run = '';
				let known = true;
				for (const char of chars) {
					const has = glyph(char) !== undefined;
					if (run && has !== known) {
						out.push({ kind: known ? 'dots' : 'text', text: run });
						run = '';
					}
					known = has;
					run += char;
				}
				if (run) out.push({ kind: known ? 'dots' : 'text', text: run });
			} else {
				// A very long unbroken run is cut up too, on whole characters.
				for (let c = 0; c < chars.length; c += 24) {
					out.push({ kind: 'text', text: chars.slice(c, c + 24).join('') });
				}
			}
		}
	}
	return out;
}

/** Width of a run in the dot font: each glyph plus one empty column after it. */
const dotsWidth = (text: string) =>
	Array.from(text).reduce((width, char) => width + glyph(char)!.length + 1, 0);

/** The number of dot rows for a size, so content `dots` tall fills the same share of the sign. */
function rowsFor(dots: number, scale: number) {
	const rows = Math.round(dots / scale);
	// Odd, so the font sits exactly in the middle.
	return rows % 2 ? rows : rows + 1;
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
	/** The unlit dots, which are the same every frame, drawn once and reused. */
	#unlit = document.createElement('canvas');
	#unlitKey = '';

	#settings: Settings;
	#item: Item | null = null;
	#paths: { color: string | null; path: Path2D }[] = [];
	/** The drawing traced onto the dot grid, relative to its left edge, and what it was traced for. */
	#cells: [number, number, string | null][] = [];
	#cellsKey = '';
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
		this.#paths = (item?.drawing?.strokes ?? []).map(({ color, points }) => {
			const path = new Path2D();
			path.moveTo(points[0], points[1]);
			// A single point still needs a segment for its round cap to show as a dot.
			for (let i = 0; i < Math.max(points.length, 4); i += 2) {
				path.lineTo(points[i] ?? points[0], points[i + 1] ?? points[1]);
			}
			return { color, path };
		});
		this.#layout = null;
		this.#cellsKey = '';
		this.#travelled = 0;
		this.#held = 0;
		this.#ended = false;
		this.#lastKey = '';
	}

	// ---------------------------------------------------------------- layout

	/** Measures the item. All positions are in the mode's layout units. */
	#measure(ctx: CanvasRenderingContext2D, mode: Mode): Layout {
		const item = this.#item!;
		const key = [mode.textHeight, mode.drawingHeight, mode.weight, mode.dots].join();
		if (this.#layout?.key === key) return this.#layout;

		if (item.drawing) {
			const width = (mode.drawingHeight * item.drawing.width) / DRAWING.height;
			return (this.#layout = { key, pieces: [], width, rtl: false });
		}

		ctx.font = `${mode.weight} ${mode.textHeight}px ${FONT}`;
		const rtl = RTL.test(item.text.match(STRONG)?.[0] ?? '');
		let width = 0;
		const pieces = split(item.text, mode.dots).map((piece) => {
			const w =
				piece.kind === 'dots'
					? dotsWidth(piece.text)
					: Math.ceil(ctx.measureText(piece.text).width / mode.snap) * mode.snap;
			const placed = { ...piece, x: width, width: w };
			width += w;
			return placed;
		});
		// Right-to-left text reads from the right edge, so its pieces are placed in reverse.
		if (rtl) for (const piece of pieces) piece.x = width - piece.x - piece.width;
		return (this.#layout = { key, pieces, width, rtl });
	}

	/** Where the content's left edge is after `dt` more milliseconds, in layout units. */
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

	/** Selects a paint; an HDR paint punches through to the video behind the canvas. */
	#use(ctx: CanvasRenderingContext2D, paint: Paint) {
		ctx.globalCompositeOperation = paint === HDR ? 'destination-out' : 'source-over';
		ctx.fillStyle = ctx.strokeStyle = paint === HDR ? '#000' : paint;
	}

	/** Paints the item with its left edge at `x`, vertically centred in the mode's band. */
	#paintItem(ctx: CanvasRenderingContext2D, layout: Layout, x: number, mode: Mode, ink: Paint) {
		if (this.#item?.drawing) {
			const k = mode.drawingHeight / DRAWING.height;
			ctx.save();
			ctx.translate(x, (mode.bandHeight - mode.drawingHeight) / 2);
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

		ctx.font = `${mode.weight} ${mode.textHeight}px ${FONT}`;
		ctx.textBaseline = 'middle';
		ctx.textAlign = 'left';
		ctx.direction = layout.rtl ? 'rtl' : 'ltr';
		const middle = mode.bandHeight / 2 + mode.textHeight * 0.04;
		const top = (mode.bandHeight - GLYPH_HEIGHT) / 2;
		for (const piece of layout.pieces) {
			const left = x + piece.x;
			if (left > mode.viewWidth || left + piece.width < 0) continue;
			if (piece.kind === 'dots') {
				this.#use(ctx, ink);
				let column = left;
				for (const char of piece.text) {
					for (const bits of glyph(char)!) {
						for (let row = 0; row < GLYPH_HEIGHT; row++) {
							if ((bits >> row) & 1) ctx.fillRect(column, top + row, 1, 1);
						}
						column++;
					}
					column++;
				}
			} else {
				// Emoji keep their own colors; only the letters take the ink.
				this.#use(ctx, piece.kind === 'emoji' ? '#fff' : ink);
				ctx.fillText(piece.text, left, middle);
			}
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

		// Colors for this instant. In HDR whichever of the two is white becomes HDR white.
		const light = s.bg !== '#000000';
		let ink: Paint = s.hdr && !light ? HDR : s.fg;
		let ground: Paint = s.hdr ? (light ? HDR : '#000') : s.bg;
		let show = this.#item !== null;
		let flood = false;
		if (this.#blinking) {
			const phase = (((time - this.#blinkStart) / 1000) * s.blinkRate) % 1;
			if (s.blink === 'flash') show &&= phase >= 0.5;
			else if (s.blink === 'strobe') flood = phase < 0.2;
			else if (phase < 0.5) [ink, ground] = [ground, ink];
		}
		// The frame keeps its own beat, so it can blink while the message stands still.
		const frameOn = !s.frameBlink || ((time / 1000) * s.blinkRate) % 1 >= 0.5;

		// The frame takes a margin; the message lives in the rectangle inside it.
		const share = { none: 0, line: 0.07, bulbs: 0.1, stripes: 0.08 }[s.frame];
		const margin = Math.round(height * share);
		const innerWidth = width - margin * 2;
		const innerHeight = height - margin * 2;
		const chase = s.frame === 'bulbs' ? Math.floor((time / 1000) * CHASE_HZ) % 3 : 0;
		const stripes = s.frame === 'stripes' && frameOn ? ((time / 1000) * STRIPE_HZ) % 1 : 0;

		// In the dot looks the message is laid out on a coarse grid of font dots, drawings too.
		// An ASCII character is half as wide as it is tall, so there each dot is two cells wide.
		const grid = s.look !== 'smooth';
		const rows = rowsFor(GLYPH_HEIGHT, s.scale);
		const cellHeight = innerHeight / rows;
		const perDot = s.look === 'ascii' ? 2 : 1;
		const cellWidth = cellHeight / perDot;
		const columns = Math.ceil(innerWidth / cellWidth);
		const mode: Mode = grid
			? {
					viewWidth: columns / perDot,
					bandHeight: rows,
					textHeight: GLYPH_HEIGHT + 1,
					drawingHeight: rows,
					weight: 700,
					dots: true,
					snap: 1 / perDot
				}
			: {
					viewWidth: innerWidth,
					bandHeight: innerHeight,
					textHeight: Math.round(innerHeight * s.scale),
					drawingHeight: Math.round(innerHeight * s.scale),
					weight: 900,
					dots: false,
					snap: 1 / 64
				};

		let x = 0;
		let layout: Layout | null = null;
		if (this.#item) {
			layout = this.#measure(grid ? this.#gridCtx : ctx, mode);
			x = this.#position(layout, mode.viewWidth, dt);
			if (grid) x = Math.round(x / mode.snap) * mode.snap;
		}

		// Skip the work when nothing visible has changed since the last frame.
		const moving = !grid && show && this.#scrolls && !this.#still && !this.#ended;
		const key = [x, show, flood, ink, ground, chase, stripes, frameOn, width, height].join();
		if (!moving && key === this.#lastKey) return;
		this.#lastKey = key;

		ctx.globalAlpha = 1;
		ctx.globalCompositeOperation = 'source-over';
		ctx.clearRect(0, 0, width, height);
		if (flood) {
			if (ink !== HDR) {
				ctx.fillStyle = ink;
				ctx.fillRect(0, 0, width, height);
			}
			return;
		}
		if (ground !== HDR) {
			ctx.fillStyle = ground;
			ctx.fillRect(0, 0, width, height);
		}

		if (frameOn) this.#paintFrame(ctx, width, height, margin, chase, stripes, ink);

		ctx.save();
		ctx.beginPath();
		ctx.rect(margin, margin, innerWidth, innerHeight);
		ctx.clip();
		ctx.translate(margin, margin);
		if (grid) {
			this.#paintGrid(ctx, show ? layout : null, x, mode, columns, rows, cellWidth, cellHeight, ink);
		} else if (show && layout) {
			this.#paintItem(ctx, layout, x, mode, ink);
		}
		ctx.restore();
		ctx.globalCompositeOperation = 'source-over';
		ctx.globalAlpha = 1;
	}

	/**
	 * The dot looks: draw the message on a hidden canvas at a few samples per cell, then
	 * light each cell that is covered enough, as a round dot, a square pixel or a '#'.
	 */
	#paintGrid(
		ctx: CanvasRenderingContext2D,
		layout: Layout | null,
		x: number,
		mode: Mode,
		columns: number,
		rows: number,
		cellWidth: number,
		cellHeight: number,
		ink: Paint
	) {
		const look = this.#settings.look;
		let lit: [number, number, string | null][] = [];

		if (layout && this.#item?.drawing) {
			// Drawings are traced stroke by stroke, so every line stays a connected line of dots.
			const shift = Math.round(x / mode.snap);
			lit = this.#trace(mode).flatMap(([column, row, color]) =>
				column + shift >= 0 && column + shift < columns
					? [[column + shift, row, color] as [number, number, string | null]]
					: []
			);
		} else if (layout) {
			const grid = this.#gridCtx;
			const w = columns * SAMPLES;
			const h = rows * SAMPLES;
			if (this.#grid.width !== w || this.#grid.height !== h) {
				this.#grid.width = w;
				this.#grid.height = h;
			}
			grid.setTransform(1, 0, 0, 1, 0, 0);
			grid.globalCompositeOperation = 'source-over';
			grid.clearRect(0, 0, w, h);
			// Letters and plain strokes are drawn pure white, which is how they are told apart
			// from emoji and colored strokes below.
			grid.setTransform(SAMPLES / mode.snap, 0, 0, SAMPLES, 0, 0);
			this.#paintItem(grid, layout, x, mode, '#fff');
			const data = grid.getImageData(0, 0, w, h).data;
			const full = 255 * SAMPLES * SAMPLES;

			for (let row = 0; row < rows; row++) {
				for (let column = 0; column < columns; column++) {
					// How much of the cell is covered, and its average color where it is.
					let a = 0;
					let r = 0;
					let g = 0;
					let b = 0;
					for (let sy = 0; sy < SAMPLES; sy++) {
						let i = ((row * SAMPLES + sy) * w + column * SAMPLES) * 4;
						for (let sx = 0; sx < SAMPLES; sx++, i += 4) {
							const alpha = data[i + 3];
							if (!alpha) continue;
							a += alpha;
							r += data[i] * alpha;
							g += data[i + 1] * alpha;
							b += data[i + 2] * alpha;
						}
					}
					if (a < full * COVERAGE) continue;
					[r, g, b] = [r / a, g / a, b / a].map(Math.round);
					lit.push([column, row, r > 240 && g > 240 && b > 240 ? null : `rgb(${r} ${g} ${b})`]);
				}
			}
		}

		if (look === 'ascii') {
			// Sized so one character is as wide as a cell, like text in a terminal.
			ctx.font = `700 ${cellWidth / 0.6}px ${MONO}`;
			ctx.textBaseline = 'middle';
			ctx.textAlign = 'center';
			for (const [column, row, color] of lit) {
				this.#use(ctx, color ?? ink);
				ctx.fillText('#', (column + 0.5) * cellWidth, (row + 0.5) * cellHeight);
			}
			ctx.globalCompositeOperation = 'source-over';
			return;
		}

		const round = look === 'led';
		const cell = (path: Path2D, column: number, row: number) => {
			const cx = (column + 0.5) * cellWidth;
			const cy = (row + 0.5) * cellHeight;
			if (round) {
				const radius = cellHeight * 0.42;
				path.moveTo(cx + radius, cy);
				path.arc(cx, cy, radius, 0, Math.PI * 2);
			} else {
				const half = cellHeight * 0.44;
				path.rect(cx - half, cy - half, half * 2, half * 2);
			}
		};

		// Unlit dots glow faintly, as on a real sign. They never change, so they are drawn once.
		const glow = ink === HDR ? '#fff' : ink;
		const unlitKey = [look, columns, rows, cellWidth, cellHeight, glow].join();
		if (this.#unlitKey !== unlitKey) {
			this.#unlitKey = unlitKey;
			this.#unlit.width = Math.ceil(columns * cellWidth);
			this.#unlit.height = Math.ceil(rows * cellHeight);
			const off = this.#unlit.getContext('2d')!;
			const all = new Path2D();
			for (let row = 0; row < rows; row++) {
				for (let column = 0; column < columns; column++) cell(all, column, row);
			}
			off.globalAlpha = 0.13;
			off.fillStyle = glow;
			off.fill(all);
		}
		ctx.globalCompositeOperation = 'source-over';
		ctx.drawImage(this.#unlit, 0, 0);

		const plain = new Path2D();
		const colored = new Map<string, Path2D>();
		for (const [column, row, color] of lit) {
			let path = plain;
			if (color) {
				path = colored.get(color) ?? new Path2D();
				colored.set(color, path);
			}
			cell(path, column, row);
		}
		this.#use(ctx, ink);
		ctx.fill(plain);
		ctx.globalCompositeOperation = 'source-over';
		for (const [color, path] of colored) {
			ctx.fillStyle = color;
			ctx.fill(path);
		}
	}

	/**
	 * The drawing as dots: each stroke becomes a chain of cells one dot wide, joined from
	 * point to point with no gaps. Columns count from the drawing's left edge.
	 */
	#trace(mode: Mode): [number, number, string | null][] {
		const key = [mode.drawingHeight, mode.bandHeight, mode.snap].join();
		if (this.#cellsKey === key) return this.#cells;
		const k = mode.drawingHeight / DRAWING.height;
		const top = (mode.bandHeight - mode.drawingHeight) / 2;
		const cells = new Map<string, [number, number, string | null]>();
		const light = (column: number, row: number, color: string | null) => {
			if (row < 0 || row >= mode.bandHeight) return;
			cells.set(`${column},${row}`, [column, row, color]);
		};
		for (const { color, points } of this.#item?.drawing?.strokes ?? []) {
			const cell = (i: number) => [
				Math.floor((points[i] * k) / mode.snap),
				Math.floor(top + points[i + 1] * k)
			];
			let [c0, r0] = cell(0);
			light(c0, r0, color);
			for (let i = 2; i < points.length; i += 2) {
				const [c1, r1] = cell(i);
				// Bresenham's line, stepping one cell at a time.
				const dc = Math.abs(c1 - c0);
				const dr = -Math.abs(r1 - r0);
				const sc = c0 < c1 ? 1 : -1;
				const sr = r0 < r1 ? 1 : -1;
				let error = dc + dr;
				while (c0 !== c1 || r0 !== r1) {
					const twice = error * 2;
					if (twice >= dr) {
						error += dr;
						c0 += sc;
					}
					if (twice <= dc) {
						error += dc;
						r0 += sr;
					}
					light(c0, r0, color);
				}
			}
		}
		this.#cellsKey = key;
		return (this.#cells = [...cells.values()]);
	}

	#paintFrame(
		ctx: CanvasRenderingContext2D,
		width: number,
		height: number,
		margin: number,
		chase: number,
		stripes: number,
		ink: Paint
	) {
		const frame = this.#settings.frame;
		if (frame === 'none') return;

		if (frame === 'line') {
			this.#use(ctx, ink);
			ctx.lineWidth = margin * 0.4;
			ctx.strokeRect(margin / 2, margin / 2, width - margin, height - margin);
			ctx.globalCompositeOperation = 'source-over';
			return;
		}

		if (frame === 'stripes') {
			this.#paintStripes(ctx, width, height, margin, stripes, ink);
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

	/**
	 * A band of slanted stripes round the edge, like a barber pole, travelling clockwise.
	 * `phase` is how far they have moved, in stripe widths (0 to 1).
	 */
	#paintStripes(
		ctx: CanvasRenderingContext2D,
		width: number,
		height: number,
		margin: number,
		phase: number,
		ink: Paint
	) {
		const period = margin * 2;
		// Each edge is drawn along its own x axis, clockwise, with y running inward. The
		// stripes are placed by distance round the perimeter, so they meet up at the corners.
		const edges: [number, number, number, number][] = [
			[0, 0, 0, width],
			[width, 0, 0.5, height],
			[width, height, 1, width],
			[0, height, 1.5, height]
		];
		let start = 0;
		for (const [ox, oy, turns, length] of edges) {
			const m = new DOMMatrix().translate(ox, oy).rotate(turns * 180);
			const band = new Path2D();
			band.moveTo(0, 0);
			band.lineTo(length, 0);
			band.lineTo(length - margin, margin);
			band.lineTo(margin, margin);
			band.closePath();
			ctx.save();
			ctx.setTransform(ctx.getTransform().multiply(m));
			ctx.clip(band);
			const shift = (((start - phase * period) % period) + period) % period;
			const edge = new Path2D();
			for (let x = -shift - period; x < length + period; x += period) {
				// Leaning back, so they seem to roll forward as they move.
				edge.moveTo(x, 0);
				edge.lineTo(x + period / 2, 0);
				edge.lineTo(x + period / 2 - margin, margin);
				edge.lineTo(x - margin, margin);
				edge.closePath();
			}
			// Faint fill between the stripes, like the unlit bulbs.
			ctx.globalCompositeOperation = 'source-over';
			ctx.globalAlpha = 0.22;
			ctx.fillStyle = ink === HDR ? '#fff' : ink;
			ctx.fill(band);
			ctx.globalAlpha = 1;
			this.#use(ctx, ink);
			ctx.fill(edge);
			ctx.restore();
			start += length;
		}
		ctx.globalCompositeOperation = 'source-over';
	}
}
