"""Joins the PNG frames from capture.ts into a looping GIF.

Usage: frames-to-gif.py <frames dir> <out.gif> <comma-separated durations in ms>
"""

import sys
from pathlib import Path

from PIL import Image

frames_dir, out, durations = sys.argv[1], sys.argv[2], sys.argv[3]
frames = [Image.open(path).convert("RGB") for path in sorted(Path(frames_dir).glob("*.png"))]

# One palette for every frame keeps colours from flickering between frames.
palette = frames[-1].quantize(colors=255, method=Image.Quantize.MEDIANCUT)
frames = [frame.quantize(palette=palette, dither=Image.Dither.FLOYDSTEINBERG) for frame in frames]

frames[0].save(
    out,
    save_all=True,
    append_images=frames[1:],
    duration=[int(d) for d in durations.split(",")],
    loop=0,
    optimize=True,
)
