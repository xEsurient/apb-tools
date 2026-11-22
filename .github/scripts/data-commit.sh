#!/usr/bin/env bash
set -euo pipefail
msg="$1"; shift
git config user.name "${COMMIT_NAME:?}"
git config user.email "${COMMIT_EMAIL:?}"
if [ -z "${DATA_BRANCH:-}" ]; then
  if [ -z "$(git status --porcelain -- "$@")" ]; then echo "No changes."; exit 0; fi
  git add -- "$@"
  git commit -m "$msg"
  for _ in 1 2 3; do
    if git pull --rebase && git push; then exit 0; fi
    git rebase --abort 2>/dev/null || true
    sleep 5
  done
  echo "::error::Could not push after 3 tries (another commit changed the same file?)."
  exit 1
fi
wt="${RUNNER_TEMP:-/tmp}/data-branch"
rm -rf "$wt"
set +e
git ls-remote --exit-code --heads origin "$DATA_BRANCH" >/dev/null
rc=$?
set -e
if [ "$rc" -eq 0 ]; then
  git fetch --depth 1 origin "+refs/heads/$DATA_BRANCH:refs/remotes/origin/$DATA_BRANCH"
  git worktree add --detach "$wt" "origin/$DATA_BRANCH"
elif [ "$rc" -eq 2 ]; then
  git worktree add --detach "$wt"
  git -C "$wt" checkout -q --orphan data-new
  git -C "$wt" rm -rfq .
else
  echo "::error::Could not reach the $DATA_BRANCH branch (git exit $rc)."
  exit 1
fi
for f in "$@"; do
  mkdir -p "$wt/$(dirname "$f")"
  cp "$f" "$wt/$f"
done
if [ -z "$(git -C "$wt" status --porcelain -- "$@")" ]; then echo "No changes."; exit 0; fi
git -C "$wt" add -- "$@"
git -C "$wt" commit -m "$msg"
for _ in 1 2 3; do
  if git -C "$wt" push origin "HEAD:refs/heads/$DATA_BRANCH"; then exit 0; fi
  git -C "$wt" fetch --depth 20 origin "+refs/heads/$DATA_BRANCH:refs/remotes/origin/$DATA_BRANCH"
  if ! git -C "$wt" rebase "origin/$DATA_BRANCH"; then git -C "$wt" rebase --abort 2>/dev/null || true; fi
  sleep 5
done
echo "::error::Could not push to $DATA_BRANCH after 3 tries."
exit 1
