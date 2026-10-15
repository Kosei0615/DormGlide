#!/bin/bash
# Rebuild the campus poster PDFs (Letter + Tabloid) and PNG previews from the
# poster HTML files. Run from the repo root after any poster edit.
#   scripts/build-posters.sh            # all four posters
#   scripts/build-posters.sh poster-dorm.html
set -eu
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
OUT=brand; PREV="${POSTER_PREVIEW_DIR:-$OUT/previews}"; mkdir -p "$PREV"
TAB='<style>@page{size:11in 17in;margin:0} .sheet{zoom:1.2941;height:13.12in} .hero{flex:1} .otter{top:0.1in;right:0.3in}</style>'
name_for() { case "$1" in
  poster-dorm.html) echo DormGlide-poster-dorm;; poster-glyde.html) echo DormGlide-poster-glyde;;
  poster-team-dorm.html) echo DormGlide-team-poster-dorm;; poster-team-glyde.html) echo DormGlide-team-poster-glyde;;
  *) echo "${1%.html}";; esac; }
for f in "${@:-poster-dorm.html poster-glyde.html poster-team-dorm.html poster-team-glyde.html}"; do
  for f2 in $f; do
    n=$(name_for "$f2")
    "$CH" --headless=new --no-pdf-header-footer --virtual-time-budget=5000 --print-to-pdf="$OUT/$n-letter.pdf" "file://$PWD/$f2" 2>/dev/null
    tmp="$PWD/.tabloid-$f2"; { cat "$f2"; echo "$TAB"; } > "$tmp"
    "$CH" --headless=new --no-pdf-header-footer --virtual-time-budget=5000 --print-to-pdf="$OUT/$n-tabloid.pdf" "file://$tmp" 2>/dev/null; rm -f "$tmp"
    "$CH" --headless=new --hide-scrollbars --window-size=864,1120 --force-device-scale-factor=1 --virtual-time-budget=5000 --screenshot="$PREV/$n.png" "file://$PWD/$f2" 2>/dev/null
    echo "built $n"
  done
done
