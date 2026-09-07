#!/usr/bin/env bash
# Daily server backup of this website repository. No force pushes.
set -Eeuo pipefail
umask 077
export PATH=/usr/local/bin:/usr/bin:/bin

REPO_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)"
EXPECTED_REMOTE="git@github.com:tianwen1209/batterylake.git"
BRANCH=main
SSH_KEY=/home/zhutianwen/.ssh/id_ed25519_batterylake_web
DRY_RUN=false
INDEX_TOUCHED=false
REBASE_STARTED=false

log() { printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S %z')" "$*"; }
fail() { log "ERROR: $*" >&2; exit 1; }
cleanup() {
    result=$?
    if [[ "$REBASE_STARTED" == true ]]; then
        git rebase --abort || true
        log 'Aborted automatic rebase; local backup commits remain available.'
    fi
    if [[ "$INDEX_TOUCHED" == true ]]; then
        git reset -q HEAD -- . || true
        log 'Restored the initially clean index; working files were kept.'
    fi
    exit "$result"
}

case "${1:-}" in
    '') [[ $# == 0 ]] || fail 'Usage: github_backup.sh [--dry-run]' ;;
    --dry-run) [[ $# == 1 ]] || fail 'Usage: github_backup.sh [--dry-run]'; DRY_RUN=true ;;
    *) fail 'Usage: github_backup.sh [--dry-run]' ;;
esac

cd "$REPO_DIR"
[[ -d .git ]] || fail "Repository is missing: $REPO_DIR"
exec 9>.git/github_backup.lock
flock -n 9 || fail 'Another website backup is running.'
[[ "$(git remote get-url origin)" == "$EXPECTED_REMOTE" ]] || fail 'Unexpected origin remote.'
[[ "$(git branch --show-current)" == "$BRANCH" ]] || fail 'Expected the main branch.'
[[ -r "$SSH_KEY" ]] || fail 'SSH key is unavailable.'
git diff --cached --quiet || fail 'Staged changes already exist; leaving them untouched.'
for operation in MERGE_HEAD rebase-merge rebase-apply CHERRY_PICK_HEAD REVERT_HEAD; do
    [[ ! -e ".git/$operation" ]] || fail 'Finish the existing Git operation before backup.'
done
trap cleanup EXIT
export GIT_SSH_COMMAND="/usr/bin/ssh -i $SSH_KEY -o IdentitiesOnly=yes -o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=20"

log "Fetching origin/$BRANCH."
timeout 180 git fetch --quiet origin "$BRANCH"
count=0
total=0
while IFS= read -r -d '' path; do
    [[ -f "$path" && ! -L "$path" ]] || continue
    bytes=$(stat -c %s -- "$path")
    (( bytes <= 90 * 1024 * 1024 )) || fail "File exceeds the 90 MiB backup limit: $path"
    total=$((total + bytes))
    count=$((count + 1))
done < <(git ls-files --cached --others --exclude-standard -z)
(( total <= 250 * 1024 * 1024 )) || fail 'Eligible repository files exceed the 250 MiB backup limit.'
log "Preflight passed: $count eligible files, $total bytes."
if [[ "$DRY_RUN" == true ]]; then
    changes=$(git add --dry-run -A | wc -l)
    log "Dry run passed: $changes changes; no commit, rebase or push performed."
    exit 0
fi

INDEX_TOUCHED=true
git add -A
if ! git diff --cached --quiet; then
    secret_pattern='BEGIN (RSA |OPENSSH )?PRIVATE KEY|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}'
    if git grep --cached -I -q -E "$secret_pattern"; then
        fail 'A staged file matches a private-key or GitHub-token pattern.'
    fi
    git diff --cached --check
    git commit -q -m "Website server backup $(date '+%Y-%m-%d %H:%M:%S %z')"
    log "Created local backup commit $(git rev-parse --short HEAD)."
fi
INDEX_TOUCHED=false
# A prior push failure can leave unpublished commits even with a clean worktree.
# Always compare and push history, including when this run made no new commit.
if ! git merge-base --is-ancestor "origin/$BRANCH" HEAD; then
    git diff --quiet || fail 'Files changed during backup; retry after edits settle.'
    REBASE_STARTED=true
    if ! git -c core.editor=true rebase "origin/$BRANCH"; then
        fail 'Remote changes conflict with the local backup; see the log. No force push was attempted.'
    fi
    REBASE_STARTED=false
fi
commit=$(git rev-parse HEAD)
timeout 180 git push --quiet origin "HEAD:refs/heads/$BRANCH"
remote=$(timeout 90 git ls-remote origin "refs/heads/$BRANCH" | awk '{print $1}')
[[ "$remote" == "$commit" ]] || fail 'Remote advanced or push verification failed; rerun backup.'
log "Backup completed and verified on GitHub: $commit"
