---
status: accepted
date: 2026-11-18
tags: [storage]
---

# Keep all state in one localStorage key, migrated on load

## Context
The app must remember the draft, saved entries, the playlist and every setting between launches, with no backend ([0001](0001-ship-a-static-client-only-app.md)). The saved shape has already changed several times (playlist cards became saved entries, speed presets became a slider, entries gained colors), and installed apps carry old data forward.

## Decision
We save the whole state as one JSON object under `marquee:v1` on every change. `load()` in `src/lib/store.svelte.ts` validates every field, falls back to defaults, and converts older shapes in place instead of bumping the key.

## Alternatives rejected
- IndexedDB: asynchronous and more code, for a few kilobytes of data.
- One key per setting: no single place to validate and migrate.
- A new key per format change: users would lose their saved entries on update.

## Consequences
- Easier: one read on start, one write per change; corrupt or blocked storage starts fresh instead of crashing.
- Harder: every format change needs a migration branch in `load()`, kept forever.
- localStorage is capped at about 5 MB, which long drawings could approach.
- Revisit when: drawings or entry counts push storage near the cap.
