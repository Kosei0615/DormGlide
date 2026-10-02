#!/usr/bin/env python3
"""Render DormGlide Instagram HTML templates to PNG and verify their QR codes.

Usage:
  python3 render_ig.py --size feed     marketing/instagram/02-sold-ac.html
  python3 render_ig.py --size portrait marketing/instagram/08-launch-1-cover.html
  python3 render_ig.py --size story    marketing/instagram/stories/s3-sold-ac.html
  python3 render_ig.py --check-only    marketing/instagram/*.png

Sizes: feed 1080x1080, portrait 1080x1350 (4:5), story 1080x1920.
The PNG is written next to the HTML with the same base name. Exit code is
non-zero if a QR code is missing or decodes to the wrong address, or if an
asset the HTML references does not exist next to it.
"""
import argparse, os, re, subprocess, sys

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
SIZES = {"feed": (1080, 1080), "portrait": (1080, 1350), "story": (1080, 1920)}
EXPECTED_QR = "https://dormglide.com/ig"


def missing_assets(html_path):
    base = os.path.dirname(os.path.abspath(html_path))
    html = open(html_path, encoding="utf-8").read()
    refs = set(re.findall(r'src="([^"]+)"', html))
    return [r for r in refs if not r.startswith(("http", "data:")) and not os.path.exists(os.path.join(base, r))]


def render(html_path, size):
    w, h = SIZES[size]
    out = os.path.splitext(os.path.abspath(html_path))[0] + ".png"
    subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
                    f"--window-size={w},{h}", f"--screenshot={out}",
                    "--virtual-time-budget=4000", "file://" + os.path.abspath(html_path)],
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
    return out


def check_qr(png_path, expected):
    try:
        import cv2
    except ImportError:
        subprocess.run([sys.executable, "-m", "pip", "install", "-q", "opencv-python-headless"], check=False)
        import cv2
    img = cv2.imread(png_path)
    if img is None:
        return False, "could not read image"
    val, _, _ = cv2.QRCodeDetector().detectAndDecode(img)
    size = f"{img.shape[1]}x{img.shape[0]}"
    if not val:
        return False, f"{size} QR NOT DECODED (clipped or missing?)"
    return val == expected, f"{size} QR -> {val}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("files", nargs="+")
    ap.add_argument("--size", choices=SIZES, default="feed")
    ap.add_argument("--check-only", action="store_true", help="files are PNGs; only verify QR codes")
    ap.add_argument("--expect", default=EXPECTED_QR)
    ap.add_argument("--no-qr", action="store_true", help="image intentionally has no QR code")
    a = ap.parse_args()

    failures = 0
    for f in a.files:
        if a.check_only:
            png = f
        else:
            miss = missing_assets(f)
            if miss:
                print(f"FAIL {f}: missing assets next to the HTML: {', '.join(miss)}")
                failures += 1
                continue
            png = render(f, a.size)
        if a.no_qr:
            print(f"OK   {png} (QR check skipped)")
            continue
        ok, msg = check_qr(png, a.expect)
        print(("OK   " if ok else "FAIL ") + f"{png}  {msg}")
        failures += (not ok)
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
