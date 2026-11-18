# Marquee

Turns a phone into a handheld LED sign: type, tap Go, shake to flash. An installable,
offline web app, live at https://marquee.0065537.xyz. The product is described in
[the design document](Marquee%20PWA%20Design%20Document.md).

## What it does

You type a message, or draw one with a finger, and tap Go. The message scrolls across the
full screen until you tap to stop. The screen stays awake while it plays, and in portrait
the sign is drawn rotated so you can hold the phone upright. Shaking the phone makes the
sign blink; where shake is unavailable, a Blink button does the same. The app is meant
for bars, concerts and airports, so the controls are big and nothing needs setup.

Things you can change on the editing screen:

- Size, scroll speed and direction (left or right).
- Look: smooth text, LED circles, pixels or ASCII.
- Frame: none, line, bulbs or stripes.
- Color: eight presets or any color from the picker.
- Blink style (flash, strobe or invert) and blink rate.
- Stickers: a row of emoji to drop into a message.
- Extra-bright mode, which shows white on black or black on white as HDR for more
  brightness on phones that support it.

Messages and drawings you show are saved on the device, each with its color. Tap + on
saved entries to build a playlist, and Go plays them in order and loops. A message can
also be shared as a QR code or a link that carries the text after the `#`, so it never
reaches the server.

There are no accounts and no backend. Everything is stored in `localStorage` and the
service worker caches the app, so it works with no signal once installed. On iOS, install
it with Share, then Add to Home Screen.

## Stack

SvelteKit (static, client-only) with Tailwind CSS, plus `qrcode-generator` for the share QR code. Otherwise the
service worker, manifest, shake detection and wake lock are plain platform APIs ([why](docs/adr/0005-add-no-runtime-dependency-beyond-qrcode-generator.md)).

## Develop

```sh
npm install
npm run dev      # dev server
npm run check    # type check
npm run build    # static site in ./build
```

Shake, the wake lock and installation need HTTPS (or localhost), so test those on a phone
against a deployed build.

## Documentation

See [docs/index.md](docs/index.md). In short:

- How to [deploy](docs/how-to/deploy.md), [regenerate the icons](docs/how-to/regenerate-icons.md)
  and [regenerate the HDR assets](docs/how-to/regenerate-hdr-assets.md).
- Reference: the [source layout](docs/reference/source-layout.md) and the
  [saved state and share link format](docs/reference/saved-state-and-share-link.md).
- Background: [extra-bright mode](docs/explanation/extra-bright-mode.md),
  [shake detection](docs/explanation/shake-detection.md) and the
  [architecture decisions](docs/adr/index.md).
