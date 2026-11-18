# How to regenerate the HDR assets

This guide shows you how to rebuild the two HDR white sources used by extra-bright mode.
You need an ffmpeg build with `libx265` and `libaom-av1`.

To see why there are two files and how they are used, read
[About extra-bright mode](../explanation/extra-bright-mode.md).

## The HDR video

`static/hdr-white.mp4`: 64×64 white, 10 minutes at 1 frame per second, HEVC with the HLG
transfer. The `hvc1` tag is required for Safari to play it.

```sh
ffmpeg -f lavfi -i "color=c=white:s=64x64:r=1:d=600" -vf format=yuv420p10le \
  -c:v libx265 -crf 30 -x265-params "colorprim=bt2020:transfer=arib-std-b67:colormatrix=bt2020nc:range=limited:keyint=600" \
  -color_primaries bt2020 -color_trc arib-std-b67 -colorspace bt2020nc -color_range tv \
  -tag:v hvc1 -movflags +faststart -an static/hdr-white.mp4
```

## The HDR image

`static/hdr-white.avif`: a 64×64 white AVIF with the PQ transfer, shown when the video
cannot play.

```sh
ffmpeg -f lavfi -i "color=c=white:s=64x64" -frames:v 1 \
  -vf "format=yuv444p10le,setparams=color_primaries=bt2020:color_trc=smpte2084:colorspace=bt2020nc:range=pc" \
  -c:v libaom-av1 -still-picture 1 -crf 10 static/hdr-white.avif
```

## Check the result

The effect only shows on an HDR-capable phone with brightness above about 80%. Deploy, turn
on Extra bright, and compare the sign with a plain white page: the letters should be
visibly brighter.
