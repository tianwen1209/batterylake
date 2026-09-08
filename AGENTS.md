# Website repository instructions

This repository contains the BatteryLake website. It is independent of the data repository at `/home/zhutianwen/BatteryLake2026`.

## Publish each completed change

The owner explicitly requires immediate GitHub updates after every completed website modification (2026-09-08).

- Finish the change, run the relevant checks and review the diff.
- Commit and push to `origin/main` before reporting completion. This is already authorized; do not wait for the daily backup or ask for permission again.
- Verify the remote commit and report any push failure accurately. Do not report a local-only commit as published.
- Preserve unrelated work, exclude credentials and runtime artifacts, and do not force-push.
- With a clean Git index and reviewed working changes, `bash scripts/github_backup.sh` performs the commit, push and remote verification using the configured credentials.

Keep the daily **09:00 Asia/Singapore (Beijing time)** backup as an additional safeguard. See [the backup guide](docs/SERVER_BACKUP.md) and [中文版](docs/SERVER_BACKUP.zh-CN.md).
