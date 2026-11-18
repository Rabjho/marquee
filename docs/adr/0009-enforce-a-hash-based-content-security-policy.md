---
status: accepted
date: 2026-11-18
tags: [security, hosting]
---

# Enforce a hash-based content security policy

## Context
Shared links put arbitrary text into the app ([0003](0003-carry-shared-messages-in-the-url-fragment.md)). The site is static, so headers come from `static/_headers` and the build.

## Decision
SvelteKit writes a CSP `<meta>` tag at build time in hash mode (`vite.config.ts`): `self` only, no inline scripts except SvelteKit's hashed startup script. `static/_headers` adds what a meta tag cannot set (`frame-ancestors`) and the other security and caching headers.

## Alternatives rejected
- No CSP: a mistake rendering shared text could run script.
- Nonce mode: needs a server to mint nonces per response.
- All of it in `_headers`: the startup script hash changes every build.

## Consequences
- Easier: no inline script or third-party origin runs, even by mistake.
- Harder: inline styles (`style-src-attr`) are allowed only because SvelteKit's announcer needs them; any new origin (fonts, analytics) needs a policy change.
- Revisit when: the app loads anything from another origin.
