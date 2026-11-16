// Prints the app icon as SVG: an amber dot-matrix "M" on black.
// Usage: node scripts/icon.svg.mjs [scale]   (scale < 1 shrinks the glyph for maskable icons)
const scale = Number(process.argv[2] ?? 1);
const rows = ['X...X', 'XX.XX', 'X.X.X', 'X.X.X', 'X...X', 'X...X', 'X...X'];
const pitch = 56;
const r = 21;
const w = 5 * pitch;
const h = 7 * pitch;
let dots = '';
rows.forEach((row, y) =>
	[...row].forEach((c, x) => {
		const cx = x * pitch + pitch / 2;
		const cy = y * pitch + pitch / 2;
		dots += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${c === 'X' ? '#ffb000' : '#2a1d00'}"/>`;
	})
);
const tx = (512 - w * scale) / 2;
const ty = (512 - h * scale) / 2;
console.log(
	`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#000"/><g transform="translate(${tx} ${ty}) scale(${scale})">${dots}</g></svg>`
);
