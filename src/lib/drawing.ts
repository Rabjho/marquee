// Drawings are stored as strokes of points on a strip 100 units tall and as wide as needed.

import { DRAWING } from './presets';

export type Stroke = { color: string | null; points: number[] };
export type Drawing = { strokes: Stroke[]; width: number };

/** SVG path data for a stroke. A lone point becomes a dot. */
export function pathData(points: number[]): string {
	let d = `M${points[0]} ${points[1]}`;
	for (let i = 0; i < Math.max(points.length, 4); i += 2) {
		d += `L${points[i] ?? points[0]} ${points[i + 1] ?? points[1]}`;
	}
	return d;
}

/** Cuts the empty space off both ends, so the drawing is exactly as long as what was drawn. */
export function trimmed(strokes: Stroke[]): Drawing {
	let left = Infinity;
	let right = -Infinity;
	for (const { points } of strokes) {
		for (let i = 0; i < points.length; i += 2) {
			left = Math.min(left, points[i]);
			right = Math.max(right, points[i]);
		}
	}
	const pad = DRAWING.brush / 2;
	const shift = Math.max(left - pad, 0);
	const round = (value: number) => Math.round(value * 10) / 10;
	return {
		width: round(right - shift + pad),
		strokes: strokes.map(({ color, points }) => ({
			color,
			points: points.map((value, i) => (i % 2 ? value : round(value - shift)))
		}))
	};
}
