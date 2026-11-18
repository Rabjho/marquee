---
status: accepted
date: 2026-11-16
tags: [sharing, privacy]
---

# Carry shared messages in the URL fragment

## Context
People want to pass a message to a friend's phone, as a link or a QR code. There is no backend to store it ([0001](0001-ship-a-static-client-only-app.md)), and messages can be personal.

## Decision
A share link is `/#t=<message>`, encoded with `URLSearchParams`. The app reads it on start and on `hashchange`, and puts the message in the text box. The QR code encodes the same link.

## Alternatives rejected
- Query string (`?t=`): sent to the server and written to its logs.
- Short links stored server-side: needs a backend and keeps people's messages.

## Consequences
- Easier: sharing works offline and the message never leaves the two phones.
- Harder: links carry text only. Drawings, colors and style are not shared, and long messages make long links and dense QR codes.
- Revisit when: drawings need to be shareable.
