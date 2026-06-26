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

# 1) Pull remote changes first (rebase to keep history linear).
#    This avoids conflicts if you also edited files on GitHub web.
echo "⬇️  Pulling latest from GitHub..."
if ! git pull --rebase origin main; then
  echo ""
  echo "⚠️  Pull failed (likely a conflict)."
  echo "   Resolve the conflict, then run:  git rebase --continue"
  echo "   Or abort with:                   git rebase --abort"
  exit 1
fi

# 2) Stage everything (respects .gitignore).
git add -A

# 3) If nothing changed, stop here — already in sync.
if git diff --cached --quiet; then
  echo "✅ Nothing to commit — already in sync with GitHub."
  exit 0
fi

# 4) Show what's about to be committed.
echo ""
echo "📝 Changes to sync:"
git status -s
echo ""

# 5) Commit (custom message or timestamped default).
if [ "$#" -ge 1 ] && [ -n "$1" ]; then
  MSG="$1"
else
  MSG="Sync: $(date '+%Y-%m-%d %H:%M:%S')"
fi
git commit -q -m "$MSG"
echo "✔️  Committed: $MSG"

# 6) Push to GitHub.
echo "⬆️  Pushing to GitHub..."
git push -q origin main

echo "──────────────────────────────────────────"
echo "✅ Done — local folder is now in sync with GitHub."
