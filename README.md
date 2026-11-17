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

| Path                                    | What                                                                  |
| --------------------------------------- | --------------------------------------------------------------------- |
| `src/routes/+layout.svelte`             | App shell: loads the global styles                                    |
| `src/routes/+layout.ts`                 | Turns off server rendering; the app is one prerendered shell          |
| `src/routes/+page.svelte`               | The editing screen: text or drawing, Go, saved list, style presets    |
| `src/lib/components/Stage.svelte`       | The playing screen: full screen, rotation, tap to stop                |
| `src/lib/components/Sign.svelte`        | The sign surface, shared by the stage and the preview                 |
| `src/lib/renderer.ts`                   | Draws the sign on a canvas: scrolling, looks, frames, blinking, HDR   |
| `src/lib/font5x7.ts`                    | The dot-matrix font used by the LED and ASCII looks                   |
| `src/lib/drawing.ts`                    | Stroke format for drawings, and trimming them to their content        |
| `src/lib/components/SavedList.svelte`   | Saved messages and drawings: tick for the playlist, arrange, edit     |
| `src/lib/components/Preview.svelte`     | The miniature sign next to the style options                          |
| `src/lib/components/Choice.svelte`      | Preset picker: a row of big radio buttons                             |
| `src/lib/components/Slider.svelte`      | Range slider with named ends, for speed and similar settings          |
| `src/lib/components/DrawingPad.svelte`  | Finger drawing on a long strip: inks, undo, clear, edge scrolling     |
| `src/lib/components/DrawingView.svelte` | Renders a stored drawing at any size                                  |
| `src/lib/store.svelte.ts`               | Text, drawing, saved list and settings, kept in `localStorage`        |
| `src/lib/shake.svelte.ts`               | Shake detection and the iOS motion permission                         |
| `src/lib/wakelock.ts`                   | Keeps the screen on while the sign plays                              |
| `src/lib/presets.ts`                    | Sizes, looks, frames, colors, blink styles, slider ranges, stickers   |
| `src/service-worker.ts`                 | Precaches the app for offline use                                     |
| `src/routes/layout.css`                 | Design tokens and blink animations                                    |
| `static/manifest.webmanifest`           | Install metadata: name, colors, icons                                 |
| `static/_headers`                       | Security and caching headers for the deployed site                    |
| `scripts/icon.svg.mjs`                  | Source of the app icon                                                |

## Deploy

`wrangler.jsonc` describes a Cloudflare Worker that serves `./build` as static assets.
In Cloudflare Workers Builds, connected to the GitHub mirror: build command
`npm run build`, deploy command `npx wrangler deploy`.

## Icons

`static/favicon.svg` and the PNG icons are generated from `scripts/icon.svg.mjs`
(needs ImageMagick). The maskable icon shrinks the glyph so it stays inside the safe zone:

```sh
node scripts/icon.svg.mjs > static/favicon.svg
magick -background black -density 300 static/favicon.svg -resize 512x512 static/icon-512.png
magick -background black -density 300 static/favicon.svg -resize 192x192 static/icon-192.png
magick -background black -density 300 static/favicon.svg -resize 180x180 static/apple-touch-icon.png
node scripts/icon.svg.mjs 0.72 > /tmp/maskable.svg
magick -background black -density 300 /tmp/maskable.svg -resize 512x512 static/icon-maskable-512.png
```

## HDR assets

Extra-bright mode shows the message as holes in a black canvas laid over an HDR white
video (`static/hdr-white.mp4`, HEVC HLG), with an HDR image (`static/hdr-white.avif`, PQ)
behind it for when the video cannot play. It stays white only: browsers cannot draw colors
brighter than normal white, only show HDR media, so each other color would need its own video.

Both were made with ffmpeg:

```sh
ffmpeg -f lavfi -i "color=c=white:s=64x64:r=1:d=600" -vf format=yuv420p10le \
  -c:v libx265 -crf 30 -x265-params "colorprim=bt2020:transfer=arib-std-b67:colormatrix=bt2020nc:range=limited:keyint=600" \
  -color_primaries bt2020 -color_trc arib-std-b67 -colorspace bt2020nc -color_range tv \
  -tag:v hvc1 -movflags +faststart -an static/hdr-white.mp4

ffmpeg -f lavfi -i "color=c=white:s=64x64" -frames:v 1 \
  -vf "format=yuv444p10le,setparams=color_primaries=bt2020:color_trc=smpte2084:colorspace=bt2020nc:range=pc" \
  -c:v libaom-av1 -still-picture 1 -crf 10 static/hdr-white.avif
```
