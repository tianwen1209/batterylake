# BatteryLake 本地编辑说明

这个文件夹是从 `/Users/tony/Downloads/batterylake-main.zip` 解压整理出来的本地 HTML 版本，原始压缩包没有被修改。

## 主要文件

- `index.html`: 主网站页面，主要编辑入口。
- `assets/`: 页面图片和本地脚本资源。
- `reference-aws.html` / `reference-kaggle.html`: 原包里的参考页面，通常不用改。
- `README.md`: 原项目说明。

## 推荐预览方式

在这个文件夹里启动一个本地服务器，再用浏览器打开：

```bash
python3 -m http.server 8000
```

然后访问：

```text
http://localhost:8000/
```

也可以直接双击 `index.html` 打开，但页面里有远程数据源和字体，用本地服务器预览更稳定。

## 修改建议

- 改首页文字、栏目、数据卡片：编辑 `index.html`。
- 改 logo 或首页图片：替换 `assets/` 里的图片，文件名保持不变最省事。
- 页面数据默认使用 `index.html` 里内置的数据。原始包里的 GitHub CSV 地址当前返回 404，所以我在本地版里关闭了自动远程同步。
- 如果以后有新的 CSV 地址，把 `index.html` 里的 `GITHUB_CSV_URL` 改成正确地址即可恢复同步。

## 本地化调整

我已把 PapaParse 从 CDN 改成本地文件：

```text
assets/vendor/papaparse.min.js
```

这样本地预览时少依赖一个外部脚本。
