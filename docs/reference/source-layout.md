# Source layout

| Path                                     | What                                                                |
| ---------------------------------------- | ------------------------------------------------------------------- |
| `src/routes/+layout.svelte`              | App shell: loads the global styles                                  |
| `src/routes/+layout.ts`                  | Turns off server rendering; the app is one prerendered shell        |
| `src/routes/+page.svelte`                | The editing screen: text or drawing, Go, saved list, style presets, share link and QR |
| `src/routes/layout.css`                  | Design tokens and blink animations                                  |
| `src/lib/components/Stage.svelte`        | The playing screen: full screen, rotation, tap to stop, Blink button |
| `src/lib/components/Sign.svelte`         | The sign surface, shared by the stage and the preview; HDR layers   |
| `src/lib/components/Preview.svelte`      | The miniature sign next to the style options                        |
| `src/lib/components/SavedList.svelte`    | Saved messages and drawings: tick for the playlist, arrange, edit   |
| `src/lib/components/Choice.svelte`       | Preset picker: a row of big radio buttons                           |
| `src/lib/components/ColorPicker.svelte`  | The custom color picker                                             |
| `src/lib/components/CustomSwatch.svelte` | Rainbow tile at the end of a color row that opens the color picker  |
| `src/lib/components/Slider.svelte`       | Range slider with named ends, for speed and similar settings        |
| `src/lib/components/DrawingPad.svelte`   | Finger drawing on a long strip: inks, undo, clear, edge scrolling   |
| `src/lib/components/DrawingView.svelte`  | Renders a stored drawing at any size                                |
| `src/lib/renderer.ts`                    | `SignRenderer`: draws the sign on a canvas (scrolling, looks, frames, blinking, HDR) |
| `src/lib/font5x7.ts`                     | The dot-matrix font used by the dot looks                           |
| `src/lib/drawing.ts`                     | Stroke format for drawings, and trimming them to their content      |
| `src/lib/store.svelte.ts`                | Draft, drawing, saved list and settings, kept in `localStorage`     |
| `src/lib/presets.ts`                     | Sizes, looks, frames, colors, blink styles, slider ranges, stickers |
| `src/lib/shake.svelte.ts`                | Shake detection and the iOS motion permission                       |
| `src/lib/wakelock.ts`                    | Keeps the screen on while the sign plays                            |
| `src/lib/noUndo.ts`                      | Text box action that applies edits by script, leaving no undo history |
| `src/lib/ui.ts`                          | Tailwind class strings for the shared control styles                |
| `src/service-worker.ts`                  | Precaches the app and serves it cache-first                         |
| `static/manifest.webmanifest`            | Install metadata: name, colors, icons                               |
| `static/_headers`                        | Security and caching headers for the deployed site                  |
| `static/hdr-white.mp4`, `static/hdr-white.avif` | HDR white sources for extra-bright mode                      |
| `scripts/icon.svg.mjs`                   | Source of the app icon                                              |
| `vite.config.ts`                         | Build config, including the content security policy                 |
| `wrangler.jsonc`                         | Cloudflare Worker that serves `./build`                             |
