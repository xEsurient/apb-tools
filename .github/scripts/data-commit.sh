#!/usr/bin/env bash
set -euo pipefail
msg="$1"; shift
git config user.name "${COMMIT_NAME:?}"
git config user.email "${COMMIT_EMAIL:?}"
if [ -z "${DATA_BRANCH:-}" ]; then
  if [ -z "$(git status --porcelain -- "$@")" ]; then echo "No changes."; exit 0; fi
  git add -- "$@"
  git commit -m "$msg"
  for _ in 1 2 3; do git pull --rebase && git push && exit 0; sleep 5; done
  exit 1
fi
wt="${RUNNER_TEMP:-/tmp}/data-branch"
rm -rf "$wt"
if git fetch --depth 1 origin "+refs/heads/$DATA_BRANCH:refs/remotes/origin/$DATA_BRANCH" 2>/dev/null; then
  git worktree add --detach "$wt" "origin/$DATA_BRANCH"
else
  git worktree add --detach "$wt"
  git -C "$wt" checkout -q --orphan data-new
  git -C "$wt" rm -rfq .
fi
for f in "$@"; do
  mkdir -p "$wt/$(dirname "$f")"
  cp "$f" "$wt/$f"
done
if [ -z "$(git -C "$wt" status --porcelain -- "$@")" ]; then echo "No changes."; exit 0; fi
git -C "$wt" add -- "$@"
git -C "$wt" commit -m "$msg"
git -C "$wt" push origin "HEAD:refs/heads/$DATA_BRANCH"
