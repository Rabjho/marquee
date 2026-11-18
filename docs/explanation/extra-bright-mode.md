# About extra-bright mode

Extra bright makes the sign brighter than a web page normally can. This page explains
why that takes a video, and why the mode only allows white on black and black on white.
The decision itself is recorded in [ADR 0006](../adr/0006-get-extra-brightness-from-hdr-media.md).

## Why white is not the brightest a page can show

A phone maps ordinary white (`#fff`) to whatever the brightness slider allows. On screens
that support HDR, the system keeps some headroom in reserve: when HDR content is on screen,
the backlight goes up and ordinary content is scaled down by the same amount, so that
ordinary white still looks the same. Only the HDR content gets brighter.

So the letters themselves have to be HDR content. A page cannot ask for that with CSS
colors on Safari, which does not render HDR colors, but it can show HDR video and, since
Safari 26, HDR images.

## How the sign uses the video

The sign is drawn on a canvas ([ADR 0004](../adr/0004-draw-the-sign-on-a-canvas.md)).
In extra-bright mode, a looping HDR white video sits under the canvas, and the canvas
becomes a stencil:

- White on black: the canvas is black, and the letters are holes. The HDR white shows
  through the letter shapes.
- Black on white: the canvas draws the letters black, and the background is the hole.

Both cases need only one HDR source, plain white. Any other color would need its own
video in that color, so the mode falls back to white instead. Since the point of the mode
is to be seen across a dark room, white is also the brightest choice.

The video is tiny (64×64, one frame per second) and stretched to fill the sign. Behind it
sits an HDR AVIF image, for when the video cannot play: iOS blocks autoplay in Low Power
Mode, and some browsers do not decode HEVC.

## What limits the effect

- The headroom depends on the phone. iPhones give little extra brightness below about 80%
  on the brightness slider. Android phones tend to allow less headroom than iPhones.
- Older iPhones and most LCD screens have no headroom, so the mode does nothing there.
- Browsers do not reliably report whether a screen supports HDR (the `dynamic-range`
  media query is unreliable on iOS), so the mode is a manual toggle and not detected.
- More brightness means more battery drain and heat.

To rebuild the two HDR files, see
[How to regenerate the HDR assets](../how-to/regenerate-hdr-assets.md).
