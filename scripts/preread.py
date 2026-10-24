"""Pre-reads a manual so the app never waits on Claude (or lego.com) for it.

Renders every page like the app does (1200 px wide JPEG), sends each to /api/extract,
and writes public/steps/<file id>.json with the steps for every page (empty pages included,
so the app knows to skip them). The app loads this file before reading pages itself.

Usage (needs PyMuPDF: pip install pymupdf, and the dev server running with a Claude key):
  python scripts/preread.py path/to/6455750.pdf --id 6455750 [--api http://localhost:3000]
"""

import argparse
import base64
import json
import os
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor

import pymupdf

WIDTH = 1200


def render(doc, index):
    page = doc[index]
    scale = WIDTH / page.rect.width
    pix = page.get_pixmap(matrix=pymupdf.Matrix(scale, scale))
    return "data:image/jpeg;base64," + base64.b64encode(pix.tobytes("jpeg", jpg_quality=85)).decode()


def extract(api, image, attempts=3):
    body = json.dumps({"page": image}).encode()
    for attempt in range(attempts):
        try:
            req = urllib.request.Request(f"{api}/api/extract", body, {"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=120) as res:
                return json.load(res)["steps"]
        except Exception as e:  # retry transient failures
            if attempt == attempts - 1:
                raise
            time.sleep(2 * (attempt + 1))
    return []


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("--id", required=True, help="file id used in the app's PDF path, e.g. 6455750")
    ap.add_argument("--api", default="http://localhost:3000")
    ap.add_argument("--workers", type=int, default=4)
    args = ap.parse_args()

    doc = pymupdf.open(args.pdf)
    n = doc.page_count
    print(f"{n} pages")
    images = [render(doc, i) for i in range(n)]  # render first (PyMuPDF isn't thread-safe)

    pages, failed = {}, []
    started = time.time()

    def work(i):
        try:
            pages[str(i + 1)] = extract(args.api, images[i])
        except Exception as e:
            failed.append(i + 1)
            print(f"page {i + 1} failed: {e}", file=sys.stderr)
        done = len(pages) + len(failed)
        if done % 10 == 0:
            print(f"{done}/{n} pages ({time.time() - started:.0f} s)")

    with ThreadPoolExecutor(args.workers) as pool:
        list(pool.map(work, range(n)))

    # Page images for pages with steps, so the app doesn't need the PDF at all for this manual.
    os.makedirs(f"public/steps/{args.id}", exist_ok=True)
    for key, steps in pages.items():
        if steps:
            i = int(key) - 1
            scale = WIDTH / doc[i].rect.width
            pix = doc[i].get_pixmap(matrix=pymupdf.Matrix(scale, scale))
            with open(f"public/steps/{args.id}/{key}.jpg", "wb") as f:
                f.write(pix.tobytes("jpeg", jpg_quality=80))

    out = f"public/steps/{args.id}.json"
    with open(out, "w") as f:
        json.dump({"pageCount": n, "pages": dict(sorted(pages.items(), key=lambda kv: int(kv[0])))}, f)
    steps = sum(len(s) for s in pages.values())
    print(f"Wrote {out}: {steps} steps on {sum(1 for s in pages.values() if s)} pages; failed pages: {failed or 'none'}")


if __name__ == "__main__":
    main()
