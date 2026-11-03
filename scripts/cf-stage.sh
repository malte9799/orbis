#!/usr/bin/env bash
# Stages dist/ for the Cloudflare assets Worker (wrangler.jsonc): dist/ -> dist-cf/orbis/, so /orbis/... maps to files.
# Fails (listing the files) if a file exceeds the 25 MiB Workers-assets limit or the file count exceeds 20,000.
# Big assets belong in the R2 bucket (ASSETS_BASE); run this AFTER the "Remove assets from dist" step.
# usage: cf-stage.sh [dist-dir] [out-dir]
set -euo pipefail
src="${1:-dist}"; out="${2:-dist-cf}"
[ -f "$src/index.html" ] || { echo "::error::$src/index.html missing – run pnpm build first" >&2; exit 1; }

rm -rf "$out"; mkdir -p "$out/orbis"
cp -a "$src/." "$out/orbis/"

limit=$((25 * 1024 * 1024))
big=$(find "$out" -type f -size +"${limit}"c -exec ls -l {} + | awk '{printf "  %.1f MiB  %s\n", $5/1048576, $NF}' || true)
count=$(find "$out" -type f | wc -l | tr -d ' ')
echo "staged $count files in $out/orbis ($(du -sh "$out" | cut -f1))"
fail=0
if [ -n "$big" ]; then
  echo "::error::files over 25 MiB (Workers assets limit) – they must come from orbis-assets (set ASSETS_BUCKET + ASSETS_BASE):" >&2
  echo "$big" >&2
  fail=1
fi
if [ "$count" -gt 20000 ]; then echo "::error::$count files > 20,000 (Workers assets limit)" >&2; fail=1; fi
exit $fail
