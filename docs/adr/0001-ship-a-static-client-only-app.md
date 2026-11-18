---
status: accepted
date: 2026-11-16
tags: [architecture, hosting]
---

# Ship a static, client-only app with no backend

## Context
The app is used in bars, concerts and airports, often with poor signal, by people who will not sign up for anything. It must work offline once installed and needs HTTPS for motion sensors, the wake lock and installation.

## Decision
We build Marquee as a SvelteKit static site with `ssr = false`: one prerendered shell, served as static assets by a Cloudflare Worker with no Worker script. All state lives on the device.

## Alternatives rejected
- Server rendering or API routes: nothing needs a server, and a server cannot help when there is no signal.
- Accounts and sync: on the design document's cut list; they add setup, which breaks "no setup".
- Cloudflare Pages: Workers static assets does the same job and is where Cloudflare puts new work.

## Consequences
- Easier: hosting is free and trivial, there is nothing to run or secure server-side, and the app works offline.
- Harder: nothing moves between devices except through a share link ([0003](0003-carry-shared-messages-in-the-url-fragment.md)).
- Browser-only code still belongs in `onMount` or event handlers.
- Revisit when: a feature needs data from more than one device.
