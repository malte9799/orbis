#!/usr/bin/env bash
# Single place that writes the `gh-pages` branch (used by deploy.yml and preview-cleanup.yml).
# The branch is kept as ONE amended commit; pushes use --force-with-lease and are retried, so parallel runs
# (main deploy, branch previews, cleanup) never overwrite each other's changes.
#
# usage: gh-pages.sh slug <branch>            print the preview directory name of a branch
#        gh-pages.sh publish <dir> <src>      replace <dir> with the contents of <src> ("." = site root, keeps preview/)
#        gh-pages.sh cleanup [branch...]      remove the previews of the given branches and of all deleted branches
# env: GH_TOKEN, REPO (owner/name), GITHUB_SHA (publish)
set -euo pipefail

slug() { sed 's#[^A-Za-z0-9._-]#-#g' <<<"$1"; }

cmd="${1:-}"; shift || true
if [ "$cmd" = slug ]; then slug "$1"; exit 0; fi
case "$cmd" in publish|cleanup) ;; *) echo "usage: $0 slug|publish|cleanup …" >&2; exit 2;; esac

remote="https://x-access-token:${GH_TOKEN}@github.com/${REPO}.git"
git_() { git -c user.name='github-actions[bot]' -c user.email='41898282+github-actions[bot]@users.noreply.github.com' "$@"; }
if [ "$cmd" = publish ]; then src=$(cd "$2" && pwd); fi

apply() {  # runs inside the gh-pages checkout
  case "$cmd" in
    publish)
      local dir="$1"
      if [ "$dir" = . ]; then
        find . -mindepth 1 -maxdepth 1 ! -name .git ! -name preview -exec rm -rf {} +
      else
        rm -rf "$dir"; mkdir -p "$dir"
      fi
      cp -a "$src/." "$dir/"
      # marker so the online check can tell this deploy from a previous one
      echo "$GITHUB_SHA" > "$dir/deploy.txt"
      touch .nojekyll
      ;;
    cleanup)
      local b live
      for b in "$@"; do rm -rf "preview/$(slug "$b")"; done
      live=$(git ls-remote --heads "$remote" | sed 's#.*refs/heads/##' | while read -r b; do slug "$b"; done)
      for d in preview/*/; do
        [ -d "$d" ] || continue
        grep -qxF "$(basename "$d")" <<<"$live" || { echo "removing orphaned $d"; rm -rf "$d"; }
      done
      ;;
  esac
}

work=$(mktemp -d "${RUNNER_TEMP:-/tmp}/gh-pages.XXXXXX")
for attempt in $(seq 1 8); do
  rm -rf "$work"
  base=""
  if git ls-remote --exit-code --heads "$remote" gh-pages >/dev/null; then
    git clone -q --depth 1 --branch gh-pages "$remote" "$work"
    base=$(git -C "$work" rev-parse HEAD)
  elif [ "$cmd" = cleanup ]; then
    echo "no gh-pages branch – nothing to clean up"; exit 0
  else
    mkdir -p "$work"; git -C "$work" init -q -b gh-pages
  fi

  (cd "$work" && apply "$@")
  git -C "$work" add -A
  if [ -n "$base" ] && git -C "$work" diff --cached --quiet; then echo "gh-pages unchanged"; exit 0; fi
  msg="${cmd^} ${GITHUB_SHA:-} $(date -u +%Y-%m-%dT%H:%MZ)"
  if [ -n "$base" ]; then git_ -C "$work" commit -q --amend -m "$msg"; else git_ -C "$work" commit -q -m "$msg"; fi

  # lease: only push if nobody else pushed since our clone (empty base = branch must not exist yet)
  if git -C "$work" push -q --force-with-lease="gh-pages:$base" "$remote" HEAD:gh-pages; then
    echo "gh-pages updated ($cmd, attempt $attempt)"; exit 0
  fi
  echo "gh-pages changed meanwhile – retrying ($attempt)"
  sleep $((attempt * 2 + RANDOM % 5))
done
echo "::error::could not update gh-pages after 8 attempts"
exit 1
