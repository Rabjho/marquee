# Saved state and share link format

## Saved state

Everything the app remembers is one JSON object in `localStorage` under the key
`marquee:v1`, written on every change. It is read by `load()` in `src/lib/store.svelte.ts`.
A missing, unparsable or invalid field takes its default; storage that cannot be read
starts with all defaults.

| Field          | Type                         | Default     | Meaning |
| -------------- | ---------------------------- | ----------- | ------- |
| `mode`         | `'text'` \| `'draw'`         | `'text'`    | Whether the editor shows the text box or the drawing pad |
| `draft`        | string                       | `''`        | What is in the text box |
| `sketch`       | `Stroke[]`                   | `[]`        | What is on the drawing pad, untrimmed |
| `editingId`    | string \| null               | `null`      | The saved entry being edited; Go updates it in place. Must name an existing entry |
| `entries`      | `Entry[]`                    | `[]`        | Saved messages and drawings. Entries with no text and no drawing are dropped |
| `playlistIds`  | string[]                     | `[]`        | Entry ids in the playlist, in play order. Unknown ids and duplicates are dropped |
| `size`         | `'big'` \| `'medium'` \| `'small'` | `'big'` | Text height: 0.9, 0.55 or 0.32 of the sign height |
| `look`         | `'smooth'` \| `'led'` \| `'pixels'` \| `'ascii'` | `'smooth'` | `led` is the Circles look |
| `frame`        | `'none'` \| `'line'` \| `'bulbs'` \| `'stripes'` | `'none'` | |
| `frameBlink`   | boolean                      | `false`     | The frame blinks at `blinkRate` by itself |
| `color`        | color preset id \| `'custom'` | `'white'`  | Current sign color |
| `customColor`  | `#rrggbb`                    | `#ffb000`   | Color chosen with the picker, stored lowercase |
| `hdr`          | boolean                      | `false`     | Extra-bright mode |
| `speed`        | number, 0.1 to 3             | 0.55        | Scroll speed in sign widths per second; clamped to range |
| `direction`    | `'left'` \| `'right'`        | `'left'`    | Scroll direction |
| `blink`        | `'flash'` \| `'strobe'` \| `'invert'` | `'flash'` | Blink style |
| `blinkRate`    | number, 0.5 to 3, step 0.25  | 3           | Blinks per second; clamped to range |

Color preset ids: `white`, `yellow`, `orange`, `red`, `pink`, `green`, `cyan`, `paper`
(black on white). With `hdr` on, only `white` and `paper` are shown; any other color shows
as white.

### Entry

```ts
type Entry = { id: string; text: string; drawing?: Drawing; color?: string };
```

- `id`: a random UUID.
- `text`: the message. Unused when `drawing` is set.
- `color`: a color preset id or `#rrggbb`. Entries saved before colors existed get the
  sign color at load time.

### Drawing and Stroke

```ts
type Stroke = { color: string | null; points: number[] };
type Drawing = { strokes: Stroke[]; width: number };
```

- Coordinates are on a strip 100 units tall. `width` is at most 6000; an invalid width
  becomes 150.
- `points` is a flat list `[x0, y0, x1, y1, ...]` with an even number of finite values,
  at least two. A single point draws a dot.
- `color` is `#rrggbb`, or `null` for the base ink: white on a black sign, black on a
  white one.
- Strokes that fail these rules are dropped. A drawing with no valid strokes is dropped.

### Older formats read on load

| Old shape | Read as |
| --------- | ------- |
| No `entries`, but `cards` and `selectedId` | Cards become entries. The selected text card becomes the draft. With more than one card, all start in the playlist |
| Entries with `on: true` and no `playlistIds` | Those entries form the playlist, in list order |
| `speed` as `'slow'`, `'medium'`, `'fast'` | 0.3, 0.55, 0.95 |
| Stroke with `d` (SVG path string) instead of `points` | The numbers in `d`, in order |

## Share link

```
https://marquee.0065537.xyz/#t=<message>
```

- The message follows `t=` in the fragment, encoded by `URLSearchParams` (spaces become `+`).
- Whitespace runs collapse to one space and the ends are trimmed, on writing and reading.
- On load, and on `hashchange` while open, a non-empty `t` switches to text mode, replaces
  the draft and stops editing any saved entry.
- Only text is carried. Drawings, colors and style settings are not.
- The QR code encodes the same URL at error correction level M.
