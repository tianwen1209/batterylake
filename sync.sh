#!/usr/bin/env bash
#
# sync.sh — One-click sync: pull latest from GitHub, then commit & push local changes.
#
# Usage:
#   ./sync.sh                 # auto commit message with timestamp
#   ./sync.sh "your message"  # custom commit message
#
set -euo pipefail

# Always run from the folder this script lives in
cd "$(dirname "$0")"

echo "🔋 BatteryLake sync"
echo "──────────────────────────────────────────"

# 1) Stage everything (respects .gitignore).
git add -A

# 2) Commit local changes (if any) BEFORE pulling — rebase needs a clean tree.
if git diff --cached --quiet; then
  echo "ℹ️  No local changes to commit."
else
  echo "📝 Changes to sync:"
  git status -s
  echo ""
  if [ "$#" -ge 1 ] && [ -n "$1" ]; then
    MSG="$1"
  else
    MSG="Sync: $(date '+%Y-%m-%d %H:%M:%S')"
  fi
  git commit -q -m "$MSG"
  echo "✔️  Committed: $MSG"
fi

# 3) Pull remote changes (rebase to keep history linear).
#    Tree is clean now, so this is safe. Avoids conflicts if you also
#    edited files on GitHub web.
echo "⬇️  Pulling latest from GitHub..."
if ! git pull --rebase origin main; then
  echo ""
  echo "⚠️  Pull failed (likely a conflict)."
  echo "   Resolve the conflict, then run:  git rebase --continue"
  echo "   Or abort with:                   git rebase --abort"
  exit 1
fi

# 4) Push to GitHub (only if local is ahead).
if [ -n "$(git log origin/main..main 2>/dev/null)" ]; then
  echo "⬆️  Pushing to GitHub..."
  git push -q origin main
else
  echo "✅ Nothing to push — already in sync with GitHub."
  exit 0
fi

echo "──────────────────────────────────────────"
echo "✅ Done — local folder is now in sync with GitHub."
