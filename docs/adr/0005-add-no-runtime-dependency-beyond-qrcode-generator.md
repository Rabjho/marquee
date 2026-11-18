---
status: accepted
date: 2026-11-18
tags: [dependencies, offline]
---

# Add no runtime dependency beyond qrcode-generator

## Context
The app is small, must load from cache with no signal, and is maintained by one person. The platform already provides what it needs: service worker, manifest, `devicemotion`, the wake lock, canvas.

## Decision
The stack is plain SvelteKit and Tailwind. The only runtime package is `qrcode-generator`, loaded on demand for the share QR code. The service worker (`src/service-worker.ts`) is written by hand: it precaches the build on install and serves cache-first. Any new package is discussed before it is added.

## Alternatives rejected
- `@vite-pwa/sveltekit` (named in the design document): Workbox config and a dependency to replace 50 lines of service worker.
- UI component libraries: the controls are a few big buttons and sliders, styled to the app's own palette.
- Writing a QR encoder by hand: error correction and masking are easy to get wrong, for no gain.

## Consequences
- Easier: small bundle, few updates to track, every line of offline behavior is readable.
- Harder: platform quirks (iOS permission flow, wake lock release on hide) are handled in our own code.
- Revisit when: offline needs grow past precaching, such as background updates or runtime caching rules.
