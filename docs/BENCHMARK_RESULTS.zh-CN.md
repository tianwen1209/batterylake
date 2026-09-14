# 网页公开 benchmark 结果

[English](BENCHMARK_RESULTS.md) · [查看结果](https://tianwen1209.github.io/batterylake/#benchmarks)

Benchmarks 页新增的 **Benchmark results** 展示 BatteryLake2026 的实际实验记录，下方仍保留访客自己的训练包配置流程。

## 范围与统计

冻结范围包含 19 个循环老化数据集、24 个 profile、七模型、种子 0–4。共 **8,540 次有效拟合：SOH 5,145 次、RUL 3,395 次**，其中包含六个独立 SOH 跨数据集迁移方向。每个原 profile 在继承分区内最多选择训练 18、验证 6、测试 6 颗电芯，保留所选电芯完整可用历史。

这些是实验子集，不能替换首页的完整原始发布规模。数据集编号为 01、03、04、05、06、07、08、09、11、17、18、19、21、23、27、36、37、38、41；续测或不同寿命轴不重复算作新数据集。

七模型为 Linear Regression、Random Forest、XGBoost、LSTM、Transformer、CNN 和 PINN4SOH。当前结果使用替换后的作者网络版本，排除旧 MLP PINN。另行统计的 1,571 次 PINN 重跑包含 351 次历史实验，不再叠加到 8,540 次主实验总数。

## 如何阅读

- 按数据集、任务、profile、容量／标签口径和划分协议筛选。没有有效点值 RUL 的范围明确显示无结果，不以零误差代替。
- 排名来自 processed 路：先分别计算每颗测试电芯的 RMSE，再对电芯等权平均，最后对五种子平均。MAE 同样使用电芯等权。SD 是五种子间样本标准差（`ddof=1`），不是置信区间；精确并列取平均名次。
- SOH 误差单位为比例，乘以 100 得百分点。RUL 保留来源循环、记录操作、天数或作者寿命轴单位。不同单位和标签不能合并成总榜。
- 共有 168 组独立排名，另有 287 项协议／标签比较。Cross-cell 分离物理电芯；Temporal 在分区边界后排除前 15 个窗口锚点；Random 有意允许同电芯及窗口重叠，属于泄漏对照，不进入无泄漏榜单。预处理器只拟合训练集。
- 表格电芯／样本数是当前条件有有效标签的测试范围。profile 的继承分区电芯数是任务筛选前的选定范围，不代表 Random／Temporal 的实际分区数量。

## 双路比较与限制

展开对照表可查看固定 baseline 标签、cross-cell 协议的 raw-A、raw-B 重复训练和 processed 五种子平均 RMSE，以及逐样本最大预测差。固定 checkpoint 的双路推理检查记录在下载 JSON 中。

**266/266 组直接比较通过**。TOST 统计等价未成立：140 组测试电芯不足五颗，126 组差值方差退化，统计等价声明为零。预注册 RMSE 比值区间为 0.95–1.05。其他标签、协议、迁移实验不继承这项配对通过结论。

- 06／07／08：来源是 BatteryLife 处理版，不宣称验证了未取得的 BatteryArchive 原始 CSV；六个迁移方向使用这三个来源。
- 11 KIT：v2 EOC 温度端点特征，V/I 缺失，不是完整波形实验。
- 19 Oxford：仅 Group 5。
- 27／37：冻结电芯没有合格的观测终点，保留右删失；37 使用事故筛查后的 v7。
- 03／41：作者 RUL 与观测阈值任务分开；初始容量和额定容量归一化分别保留。
- CALCE 及其他未验收范围不计为成功。

LLM 实验、人工 Gold／评审和第二机器复现是独立工作，模型训练完成不代表它们完成。

## 文件和更新

### 动态预测对比图

图随所选实验条件更新，可切换 SOH／RUL、模型和测试电芯，并播放、暂停、重置或拖动进度。参考曲线来自保存的任务标签；作者 RUL 仍沿用独立 profile，不重新推断终点。播放只是依次呈现保存的测试预测，不是在浏览器实时训练或推理。有配对 raw-A 结果时可叠加虚线，数值相同的曲线会重合。

图固定使用**种子 0**，与表格的五种子平均区分。每个条件按紧凑 JSON `[20260910, case_id, cell_id]` 的 SHA-256 从小到大，选取最多三颗合格测试电芯，不按误差挑选。每颗最多等距保留 512 个记录锚点，包含首尾；数值保持原样，不平滑、不补造中间值，连线仅帮助观察趋势。全量指标不受显示抽样影响。**Save image (SVG)** 可下载包含图例、寿命轴、标签、模型及种子的矢量图。系统启用减少动态效果时不自动播放，但仍可手动播放。

`trajectories/index.json` 覆盖全部 168 个条件，按需加载小型 JSON；记录样本身份、来源预测哈希和任务 ID。完整预测归档保留在服务器。更新指标快照后可重新导出图示：

```bash
/home/zhutianwen/BatteryLake2026/Benchmark/runs/harness-cpu-env/bin/python \
  scripts/export_benchmark_trajectories.py
```

导出器核对每项结果身份与预测哈希，只取有效测试行，并严格检查模型／来源路之间电芯、寿命轴、标签及样本顺序对齐。

公开文件位于网页仓库的 `assets/data/benchmark-results/`，访客不需要访问服务器或数据仓库：

- `snapshot.json`：交互表、范围、来源哈希及数据仓库提交号。
- `model_rankings.csv`：1,176 行排名。
- `current_harness_metrics.csv`：8,540 次拟合的指标、来源路、种子及代码指纹。
- `current_harness_equivalence.json`：配对及统计限制。
- `current_harness_rankings.json`：协议／标签比较。
- `FINAL_SUMMARY.json`：原始汇总与输入哈希。

导出器逐字节复制五份原报告，并校验哈希、唯一拟合、七模型五种子覆盖及 processed 聚合指标。大型数据、预测、权重、日志和私密配置不会导出。

```bash
cd /home/zhutianwen/batterylake
python3 scripts/export_benchmark_results.py \
  --benchmark-root /home/zhutianwen/BatteryLake2026/Benchmark
python3 -m unittest discover -s tests -p test_benchmark_results.py
```

网页是发布快照，不是实时服务器监控。日期来自来源汇总。审核刷新后立即提交推送网页仓库，等待 GitHub Pages 部署。来源报告与汇总哈希冲突时，导出器拒绝发布。
