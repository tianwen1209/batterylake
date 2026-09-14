# Benchmark 真实曲线展示

[English](BENCHMARK_RESULTS.md) · [Benchmark 页面](https://tianwen1209.github.io/batterylake/#benchmarks)

公开页面使用**真实测试标签与已保存的模型预测**绘图，可切换数据集、任务和模型。按论文发布要求，不展示数字刻度、数值悬浮提示、指标和排名。原概念示意动画已移除。

覆盖十九个数据集：01、03、04、05、06、07、08、09、11、17、18、19、21、23、27、36、37、38、41。各数据集均有 SOH 曲线；Onori 二次寿命（27）与事故筛查后的 HM（37）在当前定义下右删失，不提供点值 RUL。每个可用任务都提供 Linear Regression、Random Forest、XGBoost、LSTM、Transformer、CNN、PINN 图像。PINN 使用已完成的 PINN4SOH 替换实验。原有的本地训练包配置流程继续保留。

## 每张图代表什么

- 使用冻结的 baseline 标签、固定种子 `0` 和每个数据集／任务的一颗测试电芯。按 `[20260910, case_id, cell_id]` 的 SHA-256 排序，选择首颗合格身份。选择不依赖预测误差，各模型及 raw／processed 共用所选电芯。
- 使用跨电芯测试。**XJTU 的 RUL 是例外**：已完成的 baseline 只有时间划分和随机划分。网页明确展示时间划分的参考标签与 processed 预测，不补造 raw 配对曲线，也不标为跨电芯结果。
- SOH 展示主 profile；MATR 续测和 EVERLASTING 操作数实验作为独立结果继续保留在服务器。EVERLASTING 图使用主 profile 的时间轴。MATR／HUST RUL 使用作者终点；ILCC RUL 使用时间匹配后的扩展 profile。
- 保留 06／07／08 的 BatteryLife 处理版来源、KIT 温度端点输入、Oxford 仅 Group 5、HM 事故筛查 v7 的范围限定。不声称覆盖完整原始发布版，也不声称验证了尚未获取的 BatteryArchive 原始 CSV。

绿色为参考标签，橙色虚线为 raw 输入预测（BatteryLife 对应来源处理版预测），蓝色为 processed 输入预测。预测一致时曲线可能重合。每张图使用所选电芯全部有效测试观测，不平滑、不插值生成新样本、不裁掉预测误差、不平均不同种子，也不按效果挑选。相邻有效观测用直线连接；被排除或无效的观测会断开曲线。动画只是沿寿命轴逐渐展示真实图像，不是在浏览器中实时推理。

标签与预测共用同一套线性坐标尺度，范围包含全部显示值，包括离群值和负预测。每张图独立计算范围，不能把像素距离直接当作跨模型或跨数据集的数值指标。一颗电芯的图是可视化样例，不代表总体排名。

## 生成和追溯

`scripts/render_benchmark_curves.py` 将当前指标文件哈希与 `FINAL_SUMMARY.json` 对照，核验已完成任务的身份、种子、代码指纹和预测文件哈希，再严格检查不同模型及 raw／processed 的样本、标签、寿命轴和掩码对齐。来源不符时直接失败，不替换数据。

公开目录 `assets/images/benchmark-curves/` 只包含 PNG 像素和采用字段白名单的展示索引 `index.json`（数据集、任务、模型、电芯身份、profile、划分方式、轴名称、图片文件名）。不包含标签／预测数值数组、坐标范围、指标或 PNG 内的数值元数据；前端不请求底层结果文件。曲线形状按要求公开，图像不能保证无法被近似读图。

完整来源证据、样本键、坐标范围与源文件／图像哈希保存在服务器：

```text
/home/zhutianwen/BatteryLake2026/Benchmark/runs/website_curve_exports/20260914-real-curves/audit.json
```

使用现有 CPU 环境重新生成，无需训练：

```bash
cd /home/zhutianwen/batterylake
/home/zhutianwen/BatteryLake2026/Benchmark/runs/harness-cpu-env/bin/python \
  scripts/render_benchmark_curves.py \
  --audit /home/zhutianwen/BatteryLake2026/Benchmark/runs/website_curve_exports/20260914-real-curves/audit.json
```

可用状态和范围于 2026-09-14 对照冻结 harness 清单和完成记录核查。不要根据网站数据集目录的展示状态推断实验完成。后续修改需重新核对来源凭证，并保留不同任务和划分方式的区别。

旧数值资产仍未发布，并保留 Git 忽略规则。完整实验产物及原数值网页备份继续保存在服务器。本次修改不改写先前公开的 Git 提交或缓存副本。
