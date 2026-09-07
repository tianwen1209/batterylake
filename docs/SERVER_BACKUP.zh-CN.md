# 网页仓库服务器备份

[English](SERVER_BACKUP.md)

网页仓库克隆在 `/home/zhutianwen/batterylake`，远程地址为 `git@github.com:tianwen1209/batterylake.git`，分支为 `main`。它与 `/home/zhutianwen/BatteryLake2026` 中的数据仓库独立。

首次启用需要将 `/home/zhutianwen/.ssh/id_ed25519_batterylake_web.pub` 添加到该仓库的 [Deploy keys](https://github.com/tianwen1209/batterylake/settings/keys)，并勾选 **Allow write access**。服务器原有部署密钥无权写入此仓库。定时配置已经安装，但上传需要先完成这一步。专用私钥保存在仓库之外，备份脚本和本地 Git 配置均显式使用该密钥。详见 [GitHub 部署密钥说明](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/managing-deploy-keys)。

服务器通过当前用户的 crontab，每天**新加坡／北京时间 09:00（UTC+08:00）**运行 `scripts/github_backup.sh`。脚本提交符合规则的本地改动，通过 rebase 整合远程提交，正常推送并核对远程提交号，不使用强制推送。出现冲突会中止 rebase，保留本地备份提交并记录错误。即使本次没有新改动，也会重试之前未推送的提交。若已有暂存改动或未结束的 Git 操作，自动任务停止。

`.gitignore` 排除本地环境文件、虚拟环境和服务器日志。日志在 `/home/zhutianwen/batterylake/logs/github_backup.log`，单文件上限 90 MiB，备份文件总量上限 250 MiB。认证使用服务器专用 SSH 密钥，仓库不保存凭据。文件锁防止任务重叠。

```bash
# 试运行：检查候选文件，不提交、不 rebase、不推送。
/home/zhutianwen/batterylake/scripts/github_backup.sh --dry-run

# 立即备份。
/home/zhutianwen/batterylake/scripts/github_backup.sh

# 查看定时配置及最近结果。
crontab -l
tail -n 30 /home/zhutianwen/batterylake/logs/github_backup.log
```

安装的 cron 配置限制每次最长运行 15 分钟：

```cron
CRON_TZ=Asia/Singapore
0 9 * * * /usr/bin/timeout 15m /home/zhutianwen/batterylake/scripts/github_backup.sh >> /home/zhutianwen/batterylake/logs/github_backup.log 2>&1
```

网页仓库推送后可能触发现有 GitHub 自动化。此次备份配置不安装或启动网页服务。
