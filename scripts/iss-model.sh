#!/usr/bin/env bash
# Detailed ISS model (NASA 3D Resources "International Space Station (ISS) (D) (IGOAL)", ~96 MB),
# hosted as asset of the "models" GitHub release of this repo.
#   bash scripts/iss-model.sh public/models/iss-detail.glb
# Run by the deploy workflow. The app falls back to the small bundled iss.glb if it is missing.
set -euo pipefail
out="${1:-public/models/iss-detail.glb}"
repo="${GITHUB_REPOSITORY:-malte9799/orbis}"
url="https://github.com/${repo}/releases/download/models/iss-detail.glb"
mkdir -p "$(dirname "$out")"
curl -fL --retry 3 -o "$out.tmp" "$url"
mv "$out.tmp" "$out"
ls -l "$out"
