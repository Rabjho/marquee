---
status: accepted
date: 2026-11-18
tags: [storage, drawing]
---

# Store drawings as vector strokes

## Context
Drawings scroll on the sign like text, at any screen size, and are saved in localStorage ([0002](0002-keep-state-in-one-versioned-localstorage-key.md)). They switch between black and white with the sign color, and each look draws them differently.

## Decision
A drawing is a list of strokes on a strip 100 units tall and up to 6000 wide, each `{ color, points }`, trimmed to its content when saved (`src/lib/drawing.ts`). A `null` color means the base ink: white on a black sign, black on a white one.

## Alternatives rejected
- Bitmap images (the design document's plan): blurry when scaled to full screen, larger in storage, and their colors cannot be swapped afterwards.
- SVG path strings: the first format. Points are easier to validate and trace; the loader still reads the old strings.

## Consequences
- Easier: sharp at any size, small, and the renderer can trace strokes onto the dot looks.
- Harder: one brush, no fills or erasing.
- Revisit when: drawings need tools that do not map to strokes.
