---
status: accepted
date: 2026-11-18
tags: [rendering, hdr]
---

# Get extra brightness from HDR media behind a cut-out canvas

## Context
Plain `#fff` is the brightest a page can draw; the display only goes brighter for HDR content. Safari 26 does not render HDR CSS colors, but it does show HDR video and images.

## Decision
In extra-bright mode, `Sign.svelte` lays the canvas over a looping HDR white video (`static/hdr-white.mp4`, HEVC HLG), with an HDR image (`static/hdr-white.avif`, PQ) behind it for when the video cannot play. White on black cuts the letters out of a black canvas; black on white cuts out the background. Only those two colors are allowed in this mode.

## Alternatives rejected
- HDR CSS colors (`color(rec2100-pq ...)`): not rendered by Safari.
- One HDR video per color: more assets to make and cache for little gain; white is the point of the mode.
- Detecting HDR with the `dynamic-range` media query: unreliable on iOS, so the mode is a manual toggle.

## Consequences
- Easier: works on any screen that brightens for HDR video, with no special canvas support.
- Harder: other colors and custom colors fall back to white while the mode is on. Low Power Mode blocks autoplay, leaving only the image.
- Revisit when: browsers render HDR colors in canvas or CSS.
