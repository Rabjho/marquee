# Marquee PWA: Design Document

Nov 16, 2026 · @Rabjho

## Overview

This app turns a phone into a handheld LED sign: type a message, tap Go, and it scrolls as huge text across the screen. Shaking the phone makes it blink. It is a small installable web app (PWA) built for noisy, dark, low-attention settings such as bars, concerts, airports and parties, where the person using it may be distracted, tired or drunk.

The pitch in one line: type, tap Go, shake to flash.

This document describes the full "maximal" product and then cuts it into shippable stages, so that the earliest version stays extremely simple.

## Design principles

"Drunk simple" means every feature must still work for someone who is distracted, in the dark, with one hand free and poor signal. In practice:

- **One obvious action per screen.** The home screen is a text box and a giant Go button.
- **Big, forgiving targets.** No small text, no hidden gestures, nothing to discover.
- **No setup.** No accounts, no onboarding, no settings page, no confirmations.
- **Presets over pickers.** Three speeds and a handful of colors instead of sliders and color wheels.
- **It remembers.** The last text and the playlist persist, so reopening the app picks up where the person left off.
- **Works offline.** Venues often have bad signal, so everything runs from the installed app.
- **Dark by default.** The interface is low-glare so it does not blind the user before the sign is even on.

## Core experience (v1)

The whole first version is a single loop with two states, editing and playing.

1. The app opens straight to a text box with the keyboard already up.
2. The person types a message and taps the large **Go** button.
3. The message scrolls full screen in landscape at maximum size. The screen stays awake while it plays.
4. Tapping anywhere stops playback and returns to the text box.
5. The last message is saved automatically, so the next launch starts with it already filled in.

Text auto-fits the screen height, so short messages fill the screen and long ones scroll. Emoji come free from the system keyboard and must render at full size.

## Controls

Controls are limited to the few things people actually want to change, and each is a preset rather than a continuous input.

| Control | Options | Notes |
| --- | --- | --- |
| Speed | Slow, medium, fast | Three big buttons, no slider |
| Color | 6 to 8 high-contrast presets | For example white on black, yellow on black, neon pink; no color picker |
| Blink style | Flash, strobe, invert | Used by shake and the manual blink button |
| Direction | Left or right | Matters for Arabic and Hebrew |

Controls appear on the editing screen only. While playing, the screen shows nothing but the message.

## Shake to blink

Shaking the phone while a message plays makes the sign flash for a couple of seconds. It is the signature feature, so it has to work on every platform or fail gracefully.

**How it works.** The app listens to the `devicemotion` event and measures the size of the acceleration vector. When it jumps well above the resting value of about 9.8 m/s², it counts as a shake. A one-second cooldown prevents repeated triggers. Using the vector magnitude means axis direction and sign differences between devices do not matter.

**iOS permission.** iOS only allows the motion permission to be requested from a tap, so the request is attached to the Go button and feels like part of starting. Once denied, the page cannot ask again until the app is fully restarted, so the denied state explains how to recover.

**Cross-platform handling.** The code feature-detects instead of checking the operating system:

- If `DeviceMotionEvent.requestPermission` exists (iOS), the permission flow above runs.
- Otherwise (Android, most browsers) listening starts immediately over HTTPS.
- Desktop browsers expose the event but never fire it, so the app waits about a second for real sensor data before deciding shake is available.
- If shake is unavailable or denied, a visible **Blink** button takes its place.

**Limits.** Shake only works while the app is open in the foreground, and the listener must live in the top-level page, since motion events inside iframes are unreliable on iOS 26.

## Playlist and loop

The playlist lets a person line up several messages and run them in a loop. The home screen becomes a list of large message cards, and a list with one card behaves exactly like v1.

- **Play one or all.** Tapping a card plays that message. A Play all button runs every card in order and repeats.
- **Add and remove.** A single "+" button opens the text box. Deleting is a swipe or a clear ✕. Drag-to-reorder is optional and can wait.
- **One style.** To stay simple, color and speed are global. If per-card settings are added later, color is the only one worth keeping.
- **Transitions.** A short gap or quick blink between messages costs almost nothing and looks good. Shake can also skip to the next message.
- **Storage.** The list is saved on the device. Whether it is meant as a long-term library or just tonight's set is an open question (see below), because a long-term library needs managing and cleaning up.

## Drawings and stickers

Visual messages come in two steps, from cheap to expensive.

**Stickers first.** A row of about 20 big emoji or stickers (hearts, a beer, a taxi, a wave, arrows) gives most of the fun with no drawing skill. They can sit inside a text message or stand alone as a card in the playlist.

**Free drawing later.** A finger-draw canvas whose result scrolls as one more marquee item, like a hand-painted sign. It keeps the tool set minimal: one brush size, a few colors, undo, and clear. Drawings are stored as small images on the device and rendered the same way as text.

Free drawing is the riskiest simplicity trade-off, since a drunk person's sketch tends to become a blob. That is why stickers come first and drawing waits for v2. If the HDR mode is built, drawings need the same HDR treatment as text.

## HDR max-brightness mode

An optional toggle that makes the text brighter than normal white. It is a stretch feature and should be prototyped first, because it is the riskiest part of the product.

**Why plain white is not enough.** Standard white (`#fff`) is the brightest level the system maps to the brightness slider. Extra brightness only appears when the display shows HDR content: the backlight ramps up for the HDR content, and standard content is scaled down by the same amount ([WebKit bug discussion](https://bugs.webkit.org/show_bug.cgi?id=250813)). So the text itself must be HDR.

**What is available.** Safari has supported HDR video since 2020, and Safari 26 added HDR images, including in canvas ([WebKit blog](https://www.webkit.org/?p=16993)). The CSS property `dynamic-range-limit: no-limit` allows full HDR brightness and ships in Chrome 136 and Safari 26.0 ([ICS MEDIA](https://ics.media/en/entry/251024/)).

**Likely approach.** When the toggle is on, a tiny looping HDR white video or image is used as the text fill, for example through a mask, so the glyphs themselves are HDR. The background stays pure black. Safari 26 does not render HDR CSS colors, so the content must be an image or video.

**Constraints and caveats.**

- Headroom depends on the phone's brightness slider. On iPhone, headroom is limited to 3 stops below roughly 80% brightness ([Greg Benz](https://gregbenzphotography.com/hdr-photos/apple-macos-ios-hdr-iso-gain-map-21496-1/)), so the app should tell the user to raise brightness.
- Android headroom appears limited to about 2.3 stops ([Greg Benz](https://gregbenzphotography.com/hdr-photos/the-best-of-hdr-photography-in-2025)).
- The `dynamic-range` media query has been unreliable on iOS Safari, so detection is by test, with a manual toggle ([WebKit bug](https://bugs.webkit.org/show_bug.cgi?id=254489)).
- Battery drain and heat will rise, so a visible warning or auto-off is needed.
- Not confirmed: that this works in a standalone Home Screen PWA. It should, since it is the same WebKit, but it needs a test on a real iPhone.
- Older iPhones and LCD screens will not show the effect, and the toggle should do nothing there.

## Platform support and technical notes

The app is a SvelteKit static site with PWA support, hosted on Cloudflare. Everything it needs works on iOS and Android as an installed web app, with a few known gaps that do not affect the core product.

| Capability | iOS PWA | Needed for |
| --- | --- | --- |
| Installable, runs offline | Yes (service worker) | Offline use, home-screen icon |
| Motion sensor (`devicemotion`) | Yes, after a tap permission | Shake to blink |
| Screen wake lock | Yes, iOS 18.4 or later | Keeping the sign on |
| Vibration | No | Not needed |
| Background sync, Bluetooth, NFC | No | Not needed |
| Push notifications and badges | Yes, once installed | Not needed |
| HDR images and video | Yes, Safari 26 | HDR brightness mode |

Sources: [MobiLoud](https://www.mobiloud.com/blog/progressive-web-apps-ios), [firt.dev](https://firt.dev/notes/pwa-ios/). Some blogs claim background sync or Bluetooth now work on iOS; the more careful compatibility trackers say they do not, and none of them is needed here.

**Svelte.** Browser APIs work normally in Svelte. Anything touching `window`, `navigator` or `DeviceMotionEvent` runs only in `onMount` or event handlers, so server rendering never sees it. Because the app is fully static, the root layout sets `ssr = false`.

**Hosting.** Cloudflare serves the static build. The PWA plugin `@vite-pwa/sveltekit` produces the manifest and service worker. The app needs HTTPS, which Cloudflare provides, for motion sensors and installation.

**Install.** iOS has no install prompt, so the app should show a one-line hint (Share, then Add to Home Screen). On iOS 26, every site added to the Home Screen opens as a web app by default ([Michael Tsai](https://mjtsai.com/blog/?p=49472)).

## Scope and roadmap

The product ships in three stages. Each stage is usable on its own, and the early ones stay as simple as possible.

1. **v1: the sign.** Text box, Go, full-screen scroll, tap to stop, speed and color presets, shake to blink with a manual fallback, last text remembered, offline install.
2. **v1.5: the set.** Playlist with loop, the sticker row, skip-on-shake, and a shareable link or QR code that carries the text (`#t=HELLO`, kept after the `#` so the message is never sent to the server).
3. **v2: the extras.** Free drawing and the HDR max-brightness mode, once an HDR prototype has proven it works on a real iPhone.

**Cut list.** These stay out of every version: custom fonts and effects, gradients and backgrounds, accounts and sync, a settings page, history, themes, and sound beyond an optional single beep on shake.

## Risks and open questions

**Risks**

- **HDR mode may not work in a standalone iOS PWA.** Mitigation: build a 20-line test page and try it on a real iPhone before committing.
- **Accidental shake triggers.** Holding the phone up to show the sign can set off a blink. Mitigation: a sensible threshold and a cooldown, tested on real devices.
- **iOS motion permission denied.** It cannot be re-requested until restart. Mitigation: the manual Blink button and a clear recovery message.
- **Battery and heat** in bright mode. Mitigation: a visible warning and auto-off.
- **Feature creep.** Playlist, drawing and HDR each strain the "drunk simple" goal. Mitigation: ship in the staged order above.

**Open questions**

- [ ] Is shake only a blink trigger, or should it also start and stop playback? Shaking while holding the phone up could toggle it by accident.
- [ ] Should the iOS motion permission prompt appear on the first Go tap?
- [ ] Is the playlist a long-term library or just tonight's set?
- [ ] For drawings, are users sketching freely, or making arrows, hearts and signs that stickers would cover better?
- [ ] Should there be a manual blink button on every platform, or only as a fallback?
