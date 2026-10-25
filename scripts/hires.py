"""
Renders a pre-read manual's step pages at 2400 px wide into public/steps/<id>/hi/<page>.jpg.
Used only for the hologram cut-outs: parts in the 1200 px page images are too small to look sharp.

  python scripts/hires.py --id 6455750 --pdf path/to/6455750.pdf
(needs PyMuPDF: pip install pymupdf)
"""

import argparse
import json
import os

import pymupdf

WIDTH = 2400


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--id", required=True)
    p.add_argument("--pdf", required=True)
    args = p.parse_args()
    with open(f"public/steps/{args.id}.json") as f:
        pages = json.load(f)["pages"]
    doc = pymupdf.open(args.pdf)
    out = f"public/steps/{args.id}/hi"
    os.makedirs(out, exist_ok=True)
    total = 0
    for key, steps in pages.items():
        if not steps:
            continue
        page = doc[int(key) - 1]
        scale = WIDTH / page.rect.width
        data = page.get_pixmap(matrix=pymupdf.Matrix(scale, scale)).tobytes("jpeg", jpg_quality=82)
        with open(f"{out}/{key}.jpg", "wb") as f:
            f.write(data)
        total += len(data)
    print(f"Wrote {sum(1 for s in pages.values() if s)} pages to {out} ({total / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
