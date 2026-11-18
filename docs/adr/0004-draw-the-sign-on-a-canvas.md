---
status: accepted
date: 2026-11-18
tags: [rendering]
---

# Draw the sign on a canvas with one renderer

## Context
The sign has four looks (smooth text, LED circles, pixels, ASCII), four frames, three blink styles, drawings, emoji, right-to-left text and messages of any length. The playing screen and the editing preview must look the same.

## Decision
`SignRenderer` in `src/lib/renderer.ts` draws every frame onto a `<canvas>` and draws only what is on screen. `Sign.svelte` wraps it and is used both full screen by `Stage` and in miniature by `Preview`.

## Alternatives rejected
- DOM text with CSS transforms and animations: dot looks, frames and per-cell effects need pixel control, and very long messages make huge layers.
- SVG: fine for one look, slow when every LED is an element.
- WebGL: more power than needed, and more code than plain 2D canvas.

## Consequences
- Easier: one place owns everything visual; preview and stage cannot drift apart.
- Harder: screen readers cannot read the canvas; the stage only announces "Sign playing". Text layout (emoji, RTL) is done by hand.
- Revisit when: canvas performance limits a new look on low-end phones.
