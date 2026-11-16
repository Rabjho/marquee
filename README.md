# Marquee

Turns a phone into a handheld LED sign: type, tap Go, shake to flash. An installable,
offline web app. The product is described in [the design document](Marquee%20PWA%20Design%20Document.md).

## Stack

SvelteKit (static, client-only) with Tailwind CSS, plus `qrcode-generator` for the share QR code. Otherwise the
service worker, manifest, shake detection and wake lock are plain platform APIs.

## Develop

```sh
npm install
npm run dev      # dev server
npm run check    # type check
npm run build    # static site in ./build
```

Shake, the wake lock and installation need HTTPS (or localhost), so test those on a phone
against a deployed build.

## Layout

| Path | What |
| --- | --- |
| `src/routes/+page.svelte` | The editing screen: text box, Go, stickers, playlist, style presets |
| `src/lib/components/Stage.svelte` | The playing screen: full screen, rotation, tap to stop |
| `src/lib/components/Sign.svelte` | The sign surface itself, shared by the stage and the preview |
| `src/lib/components/Preview.svelte` | The miniature sign next to the style options |
| `src/lib/components/DrawingPad.svelte` | Finger drawing: one brush, a few inks, undo, clear |
| `src/lib/components/DrawingView.svelte` | Renders a stored drawing at any size |
| `src/lib/store.svelte.ts` | Messages and settings, saved to `localStorage` |
| `src/lib/shake.svelte.ts` | Shake detection and the iOS motion permission |
| `src/lib/presets.ts` | Speeds, colors, blink styles, stickers |
| `src/service-worker.ts` | Precaches the app for offline use |
| `src/routes/layout.css` | Design tokens and blink animations |
| `scripts/icon.svg.mjs` | Source of the app icon |

## Deploy

`wrangler.jsonc` describes a Cloudflare Worker that serves `./build` as static assets.
In Cloudflare Workers Builds, connected to the GitHub mirror: build command
`npm run build`, deploy command `npx wrangler deploy`.

## Icons

`static/favicon.svg` and the PNG icons are generated from `scripts/icon.svg.mjs`
(needs ImageMagick):

```sh
node scripts/icon.svg.mjs > static/favicon.svg
magick -background black -density 300 static/favicon.svg -resize 512x512 static/icon-512.png
```
