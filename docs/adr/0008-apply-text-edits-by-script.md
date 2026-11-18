---
status: accepted
date: 2026-11-18
tags: [input, ios]
---

# Apply text edits by script so iOS has no typing to undo

## Context
Shaking is the app's main gesture. On iOS, shaking a page that has typing to undo pops up "Undo Typing", on top of the sign. A page cannot turn the prompt off, and WebKit keeps undo history for the whole page, so replacing the text box does not clear it.

## Decision
The `noUndo` action (`src/lib/noUndo.ts`) cancels each `beforeinput` and applies the edit with `setRangeText`, which the browser does not record. Autocorrect is off. Edits that cannot be cancelled (input-method composition, replacements with no known range) are left to the browser.

## Alternatives rejected
- Clearing history by recreating the text box: WebKit keeps the history per page.
- `contenteditable` with a custom editor: much more code for the same result.
- Doing nothing: the prompt covers the sign at the moment people shake.

## Consequences
- Easier: shaking only blinks.
- Harder: the action must cover every `inputType`; new browser input types fall through to the browser. Undo and redo do nothing, and autocorrect is lost.
- Revisit when: iOS lets a page opt out of shake to undo.
