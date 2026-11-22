#!/usr/bin/env bash
set -euo pipefail
[ -n "${DATA_BRANCH:-}" ] || exit 0
if ! git fetch --depth 1 origin "+refs/heads/$DATA_BRANCH:refs/remotes/origin/$DATA_BRANCH" 2>/dev/null; then
  echo "No $DATA_BRANCH branch yet: using the copies on this branch."
  exit 0
fi
for f in "$@"; do
  if git cat-file -e "origin/$DATA_BRANCH:$f" 2>/dev/null; then
    mkdir -p "$(dirname "$f")"
    git show "origin/$DATA_BRANCH:$f" > "$f"
    echo "Loaded $f from $DATA_BRANCH."
  fi
done
