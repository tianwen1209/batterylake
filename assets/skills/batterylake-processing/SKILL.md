---
name: batterylake-processing
description: Convert heterogeneous BatteryLake battery datasets into provenance-preserving standard data and explicit SOH/RUL benchmark views; use for dataset inventory, adapters, conversion, fidelity checks, and raw-versus-standard benchmark validation.
---

# BatteryLake 数据处理

在 BatteryLake 仓库执行。先定位包含 `Raw_Dataset` 与 `Processed_Dataset_Standard` 的仓库根目录；路径不明时依据当前目录定位，不硬编码另一台机器的用户路径。

读取根目录 `Processed_Dataset_Standard/README.md` 和该数据集 `Processed_Dataset/dataset_xx/TODO.md`。主规范是语义规则的唯一来源；本 skill 负责执行路由。读取 [schema](references/schema.md) 后设计 adapter；实施任务等价性验收时读取 [equivalence](references/equivalence.md)。

## 执行

1. 检查现有产物和 `status.json`，从未完成阶段继续。读取源 README、协议、元数据和作者代码，不以 cycle 文件名断言实验类型。使用 `scripts/inventory_datasets.py --dataset dataset_xx` 更新只读清单；正式转换前加 `--sha256`。
2. 完成全部归档成员/工作簿/对象结构的检查、字段覆盖映射、物理电芯身份、单位、时钟、循环边界和标签依据。`.part`、缺卷、仅样例、重复格式和发布版本须显式处理。源数据不可修改。
3. 在 `scripts/processing/` 实现可重跑 adapter，将**全部源测量和额外字段**保存至同名输出目录的 canonical 层。原始顺序、缺失、异常、RPT、作者标签、模块支路信息不得丢失。无法解码的测量记录为未转换，不能将原包复制/解压当作转换完成。
4. 用边界样例调试，覆盖时钟重置、缺口、重复源循环号、不完整循环和重复格式后全量运行。分块写入暂存路径，验证输入/代码/schema/config 指纹后才允许复用旧结果，成功后原子发布。不要重跑已经通过且输入未变的昂贵步骤。
5. 全量执行覆盖、主外键、顺序、缺失与原始/标准数值对照。统计量和图形只能补充，不能替代逐记录对照；记录实际未运行项。
6. 对适用任务生成明确 profile。循环内部键不是真实寿命轴；RUL 不用过滤后行号差。RPT 通过标签关联参与 SOH；保留作者基准，不默认换成首循环或 80% EOL。未知/不适用的标签留空并说明。
7. 按等价性契约执行独立 raw loader 与 standard loader 对照，先核对 X/y/mask/split 再模型推理和配对训练。未跑训练不得声称 CNN 结果一致。profile 不适用时给证据，继续保真任务。
8. 更新该数据集 TODO/status、manifest、字段映射、验证报告和根目录 TASKS。报告实际行数、覆盖范围、失败项与下一步；当前数据集有未解决源缺件时继续处理其他已可用数据。

## 不能被省略的判断

- 按实际格式识别容器并检查完整载荷与 EOF。`.pkl` 不一定是单对象 Pickle；PyTorch 包头、外部张量 storage 不可误报为样本。对照官方读取器，旧错误产物必须失效化后重建。
- 保真层不做重采样、清洗、插值、截断、float32 降精度或删除诊断数据。需要这些操作时放到可配置任务视图/特征阶段。
- 原始健康容量、部分放电吞吐量、RPT 容量、额定容量和作者 SOH 是不同量。来源或定义不明时保留数据、暂停依赖该定义的视图发布，不猜标签。
- 右删失不是“最后一行 EOL”；稀疏 RPT 可能只能确定 EOL 区间。源信息不足时如实记录，不编造循环或 RUL。
- 同一真实电芯、同源副本和重叠窗口不应泄漏到不同 split。scaler 和特征学习只用训练集。
- `inventoried`、`converted`、`canonical_validated`、`benchmark_verified` 是不同阶段。只有对应证据已生成才推进；不把非循环数据集标为已完成全部 SOH/RUL benchmark。
