#!/bin/bash
# Wait until GitHub Pages serves the same bytes as the local file(s).
# Usage: wait_deploy.sh marketing/instagram/02-sold-ac.png [more repo-relative paths...]
# Run from the repo root (the DormGlide folder). Prints one line when all are live.
# Metricool fetches media by public URL, so scheduling before this passes would
# publish the OLD image.
set -u
for f in "$@"; do [ -f "$f" ] || { echo "no such file: $f"; exit 2; }; done
deadline=$(( $(date +%s) + 600 ))
while :; do
  all=1
  for f in "$@"; do
    local_size=$(stat -f%z "$f")
    remote_size=$(curl -s "https://dormglide.com/$f?cb=$RANDOM$RANDOM" | wc -c | tr -d ' ')
    [ "$local_size" = "$remote_size" ] || all=0
  done
  [ "$all" = 1 ] && { echo "deployed: $*"; exit 0; }
  [ "$(date +%s)" -ge "$deadline" ] && { echo "TIMEOUT waiting for deploy: $*"; exit 1; }
  sleep 12
done
