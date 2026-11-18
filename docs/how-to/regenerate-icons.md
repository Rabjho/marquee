# How to regenerate the app icons

This guide shows you how to rebuild `static/favicon.svg` and the PNG icons after changing
`scripts/icon.svg.mjs`. You need Node and ImageMagick (`magick`).

1. Write the SVG favicon:

   ```sh
   node scripts/icon.svg.mjs > static/favicon.svg
   ```

2. Render the regular PNG icons from it:

   ```sh
   magick -background black -density 300 static/favicon.svg -resize 512x512 static/icon-512.png
   magick -background black -density 300 static/favicon.svg -resize 192x192 static/icon-192.png
   magick -background black -density 300 static/favicon.svg -resize 180x180 static/apple-touch-icon.png
   ```

3. Render the maskable icon. The argument `0.72` shrinks the glyph so it stays inside the
   safe zone that Android crops to:

   ```sh
   node scripts/icon.svg.mjs 0.72 > /tmp/maskable.svg
   magick -background black -density 300 /tmp/maskable.svg -resize 512x512 static/icon-maskable-512.png
   ```

4. If you renamed or added an icon, update `static/manifest.webmanifest`.

Installed apps pick up a new icon only when they are reinstalled.
