# Website server backup

[中文](SERVER_BACKUP.zh-CN.md)

The website repository is cloned at `/home/zhutianwen/batterylake`, with `origin` set to `git@github.com:tianwen1209/batterylake.git` and branch `main`. This is separate from the battery data repository at `/home/zhutianwen/BatteryLake2026`.

The server runs `scripts/github_backup.sh` daily at **09:00 Asia/Singapore (UTC+08:00, also Beijing time)** through the user's crontab. It commits eligible local changes, incorporates upstream commits with a rebase, pushes without force and checks the remote commit. On a conflict it aborts the rebase, preserves the local backup commit and records the error. It also retries previously unpushed commits when there are no new file changes. Existing staged changes or an unfinished Git operation stop the automatic run.

`.gitignore` excludes local environment files, virtual environments and server logs. Logs stay at `/home/zhutianwen/batterylake/logs/github_backup.log`. Per-file and overall limits are 90 MiB and 250 MiB. Authentication uses the server's existing SSH key; no credentials are stored in this repository. The script uses a lock to prevent overlapping runs.

```bash
# Inspect candidates without committing, rebasing or pushing.
/home/zhutianwen/batterylake/scripts/github_backup.sh --dry-run

# Run a backup now.
/home/zhutianwen/batterylake/scripts/github_backup.sh

# Inspect scheduling and recent results.
crontab -l
tail -n 30 /home/zhutianwen/batterylake/logs/github_backup.log
```

The installed cron entry has a 15-minute execution limit:

```cron
CRON_TZ=Asia/Singapore
0 9 * * * /usr/bin/timeout 15m /home/zhutianwen/batterylake/scripts/github_backup.sh >> /home/zhutianwen/batterylake/logs/github_backup.log 2>&1
```

Committing and pushing the website may invoke the repository's existing GitHub automation. This backup configuration does not install or launch a web server.
