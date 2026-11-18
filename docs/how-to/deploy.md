# How to deploy Marquee

This guide shows you how to put a new build live on Cloudflare.

The site is a Cloudflare Worker with no script: `wrangler.jsonc` binds `./build` as static
assets, and `static/_headers` sets the response headers.

## From Workers Builds (normal route)

Connect the Worker to the GitHub mirror in Cloudflare Workers Builds, with:

- Build command: `npm run build`
- Deploy command: `npx wrangler deploy`

Every push to the branch set as production in Workers Builds then builds and deploys.

## By hand

```sh
npm run build
npx wrangler deploy
```

`wrangler` asks you to log in the first time.

## Check the deploy

Open the site on a phone, close it and open it again. The service worker serves the new
version once the old one is replaced; if an installed app still shows the old version,
close it fully and reopen it.

If a page fails to load with a CSP error in the console, see
[ADR 0009](../adr/0009-enforce-a-hash-based-content-security-policy.md) for where the policy lives.
