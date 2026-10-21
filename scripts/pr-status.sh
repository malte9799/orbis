#!/usr/bin/env bash
# Maintains ONE status comment per PR (updated in place) showing build/publish progress.
# usage: pr-status.sh <stage> [final-state]   final-state: done | failed | cancelled
# env: GH_TOKEN, REPO, BRANCH, URL, RUN_URL, SHA
set -u
stage="${1:-}"; final="${2:-}"
state="${RUNNER_TEMP:-/tmp}/pr-status"
mkdir -p "$state"
if [ -z "$final" ]; then echo "$stage" > "$state/stage"; fi
# re-check while no PR was found: it may be opened while the build is running
# (without a PR gh prints an empty line / "null", so only a number counts as found)
pr=$(cat "$state/pr" 2>/dev/null || true)
if ! [[ "$pr" =~ ^[0-9]+$ ]]; then
  pr=$(gh pr list --repo "$REPO" --head "$BRANCH" --state open --json number -q '.[0].number' 2>/dev/null || true)
  [[ "$pr" =~ ^[0-9]+$ ]] || exit 0   # no open PR for this branch (yet)
  echo "$pr" > "$state/pr"
fi

steps=("Abhängigkeiten installieren" "Texturen & Modelle" "Build" "Veröffentlichen" "Online prüfen")
cur=$(cat "$state/stage" 2>/dev/null || echo "")

rows=""; seen=0
for s in "${steps[@]}"; do
  if [ "$final" = done ]; then icon="✅"
  elif [ "$s" = "$cur" ]; then
    seen=1
    case "$final" in failed) icon="❌";; cancelled) icon="⏹️";; *) icon="⏳";; esac
  elif [ $seen -eq 0 ]; then icon="✅"
  else icon="⚪"; fi
  rows+="| $icon | $s |"$'\n'
done

case "$final" in
  done)      head="### ✅ Preview bereit"$'\n\n'"**$URL**"$'\n\n'"_Pages braucht nach dem Push ggf. ~1 Min., bis die Seite erreichbar ist._" ;;
  failed)    head="### ❌ Build/Deploy fehlgeschlagen" ;;
  cancelled) head="### ⏹️ Abgebrochen" ;;
  *)         head="### ⏳ Preview wird gebaut …"$'\n\n'"Link (sobald fertig): $URL" ;;
esac

body="<!-- orbis-preview-status -->
$head

| | Schritt |
|---|---|
$rows
Commit \`${SHA:0:7}\` · [Workflow-Lauf]($RUN_URL) · $(date -u +%H:%M:%S) UTC"

id=$(gh api "repos/$REPO/issues/$pr/comments" --paginate \
  -q '[.[] | select(.body | contains("<!-- orbis-preview-status -->"))][0].id' 2>/dev/null || true)
if [ -n "$id" ]; then
  gh api -X PATCH "repos/$REPO/issues/comments/$id" -f body="$body" >/dev/null || true
else
  gh api -X POST "repos/$REPO/issues/$pr/comments" -f body="$body" >/dev/null || true
fi
