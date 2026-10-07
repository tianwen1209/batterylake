# 质量标记词表

[English](flags.md) | [简体中文](flags.zh-CN.md)

标记位于每条 `../datasets/dataset_NN.json` 记录的 `quality.flags` 中，并由研究画像以 `source_quality_flags` 继承。本文件是它们的唯一定义处。如何按标记筛选见 [../datasets/README.zh-CN.md](../datasets/README.zh-CN.md)。

每个标记都是根据原始数据、原始文件清单或登记表计算出来的（`sample_only_raw` 是唯一例外：对于原始文件夹里只有一个名为 `sample_data` 的文件的数据集，它为人工设置）。没有一个是猜的，除这一个之外也没有一个是人工设置的。标记分三组。**出现位置**一列列出带有该标记的数据集。

**阻断（Blocking）——数据有误或对建模有误导。**

| 标记 | 含义 | 出现位置 |
|---|---|---|
| `capacity_exceeds_nominal` | 各实体最大观测放电容量的中位数超过标称容量的 3 倍。要么某个通道累计的是搬运的电荷而不是每个循环重置，要么标称值描述的是另一种电芯。此时用容量除以标称值计算 SOH 没有意义。数据集 05 在 1.85 Ah 的电芯上达到 164 Ah；数据集 22 和 23 在 3.5 Ah 的电芯上达到约 500 Ah；数据集 02 在 1.1 Ah 的电芯上达到 55 Ah（CALCE 广为人知的 Arbin 累计导出格式）。 | 02, 05, 22, 23 |

**部分（Partial）——数据本身可靠，但不完整或有重叠。**

| 标记 | 含义 | 出现位置 |
|---|---|---|
| `partial_raw` | 在原始数据中找到的实体少于登记表声明的数量；比较 `n_entities` 与 `n_entities_declared`。 | 03, 08, 16, 19, 25, 29, 30 |
| `sample_only_raw` | 原始数据只是来源的节选，而非完整序列。人工设置。 | 15 |
| `incomplete_raw_files` | 原始文件中存在未下载完的标记（`*.part`、锁文件），说明部分文件没有完整下载。 | 17, 29 |
| `unreadable_raw_files` | 部分原始文件为空、已损坏或并非其声称的格式，无法解析。 | 05, 14 |
| `shared_cells_with_other_dataset` | 同一批物理电芯出现在多个数据集编号下：实体标识有交集，或人工维护的共享研究记录把两者关联起来。把这两个数据集当作独立样本合并或划分训练/测试集会造成泄漏。 | 11, 13（228 个电芯）, 25, 27 |
| `duplicate_of_other_dataset` | 本数据集的大部分文件在另一个数据集中以相同行数重现，即它是副本或重新打包。两者择一使用。 | 22, 23 |

**提示（Informational）——值得了解，不阻断任何使用。**

| 标记 | 含义 | 出现位置 |
|---|---|---|
| `multi_chemistry` | 数据集涵盖多种正极化学体系，因此 `chemistry_is_multi` 为 true，`cathode_chemistries` 列出多个值，逐电芯的值在 `cells[]` 中。 | 06, 16, 20, 24, 26, 29, 31, 33, 34, 35, 39, 40 |
| `voltage_excursion_below_cutoff` / `voltage_excursion_above_cutoff` | 观测电压超出文档记载截止值 0.05 V 以上。通常是传感器毛刺、静置步骤的伪迹或文档不一致；裁剪之前先查看 `content.observed.voltage_V`。 | 低于：01, 05, 06, 07, 08, 11, 13, 19, 22, 23, 38 · 高于：01, 02, 05, 06, 07, 09, 19, 21, 22, 23, 28, 38 |
| `pack_level_voltage` | 观测电压超过单体截止电压的 10 倍，说明原始数据是电池组级别。取代"高于截止值"标记。 | 目前无 |
| `temperature_basis_differs_from_data` | 文档记载的测试温度与原始数据测得的温度相差超过 10 °C，说明记录的温度是设定值、起始值或其他量，而不是实际测得的值。请阅读 `temperature_basis`。 | 目前无 |
