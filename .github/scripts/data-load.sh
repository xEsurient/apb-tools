#!/usr/bin/env bash
set -euo pipefail
[ -n "${DATA_BRANCH:-}" ] || exit 0
set +e
git ls-remote --exit-code --heads origin "$DATA_BRANCH" >/dev/null
rc=$?
set -e
if [ "$rc" -eq 2 ]; then
  echo "No $DATA_BRANCH branch yet: using the copies on this branch."
  exit 0
fi
if [ "$rc" -ne 0 ]; then
  echo "::error::Could not reach the $DATA_BRANCH branch (git exit $rc): stopping instead of using possibly stale copies."
  exit 1
fi
git fetch --depth 1 origin "+refs/heads/$DATA_BRANCH:refs/remotes/origin/$DATA_BRANCH"
for f in "$@"; do
  if git cat-file -e "origin/$DATA_BRANCH:$f" 2>/dev/null; then
    mkdir -p "$(dirname "$f")"
    git show "origin/$DATA_BRANCH:$f" > "$f"
    echo "Loaded $f from $DATA_BRANCH."
  fi
done
