# 数据集记录

[English](README.md) | [简体中文](README.zh-CN.md)

每个数据集对应一个 `dataset_NN.json`，由 `../schema/batterylake-dataset-2.0.json` 描述。这些文件是只读数据。各值的来源见 [../docs/pipeline.zh-CN.md](../docs/pipeline.zh-CN.md)。质量标记的定义见 [../docs/flags.zh-CN.md](../docs/flags.zh-CN.md)；建立在这些记录之上的研究层见 [../research/](../research/README.zh-CN.md)。

每个值都读取自数据集的原始文件——测量文件本身、文件名，以及随附的文档。这些无法提供某个值时，取自数据集的落地页或论文（登记表所列），并注明出处。**不从任何交付（delivery）URL 读取。** 没有任何来源记载的字段为 `null`。

## 如何阅读一条记录

- **`null` 表示未记载。** 当原始数据、其文档和落地页都没有声明时，标称容量、化学体系或电压窗口即为 `null`。它从不表示零。
- **`content.observed` 是实测；`cell.*` 是文档记载。** `observed` 保存原始数据中观测到的范围（电压、电流、温度、放电容量、电阻等）；`cell.voltage_min_V` 和 `voltage_max_V` 是协议的截止值。二者可能不一致——见越界标记。
- **为某项任务使用数据集之前，先检查 `quality.flags`。** `read.py` 中的 `usable_for()` 以参数形式接收要排除的标记，由各调用方自行决定哪些标记会阻断使用。

```python
soh_ready = usable_for(index, "SOH", exclude_flags=(
    "capacity_exceeds_nominal", "duplicate_of_other_dataset"))
```

## 字段参考

仅解释从名称看不出含义的字段，其余字段与字面意思一致。

### 标识（Identity）

| 字段 | 含义 |
|---|---|
| `ref_name` | 项目的参考名称，格式 `年份_机构_化学体系_形态_条件`，来自登记表（登记表没有时取原始 README）。 |
| `ref_name_aliases` | 该数据集用过的所有其他名称，使旧引用仍可解析。每项含 `name`、`status`（`historical`：同一研究被取代的旧名；`mismatched`：属于另一项研究的名称）和 `seen_in`（`registry_history` 表示登记表在早期提交中用过的名称，`raw_readme` 表示原始 README 的"Other names"行）。索引行只保存名称。 |
| `doi` 与 `paper_doi` | `doi` 标识数据集本身；`paper_doi` 标识描述它的论文。只有登记表的落地页、原始文档或落地页元数据声明了时才记录。通常只有其中一个。 |
| `source_url` | 数据的上游来源，来自登记表。 |

### 电芯（Cell）

| 字段 | 含义 |
|---|---|
| `cathode_chemistry` / `anode_chemistry` | 规范化为受控词表。`mixed` 表示数据集涵盖多种；此时逐电芯的值在 `cells[]` 中。 |
| `chemistry_label_raw` | 规范化之前的原始化学体系字符串。 |
| `cell_format_code` | 已声明或可推导出的行业尺寸代码（`18650`、`21700`、`26650`、`14500`、`502030`）。 |
| `dimensions_mm.basis` | 来源给出尺寸时为 `stated`；由尺寸代码推得时为 `inferred_from_format_code`（18650 即 18 mm x 65 mm）。只有后者是惯例而非测量。 |
| `capacity_basis` | `rated` 是厂家铭牌值；`measured` 表示该值是电芯实际放出的容量。 |
| `voltage_level` | `cell` 或 `pack`。原始数据报告的是电池组电压而截止值是单体级时，二者不可比较（标记 `pack_level_voltage`）。 |
| `voltage_min_V` / `voltage_max_V` | 文档记载的协议截止电压窗口，而非观测范围。 |

### 条件（Conditions）

| 字段 | 含义 |
|---|---|
| `temperature_basis` | 温度数字的性质。`chamber_setpoint`：指令的测试温度。`measured`：取自原始数据，用于没有记载设定值的情形。`onset`：该值是起始温度（加速量热），不是测试温度。`unspecified`：未记录。 |
| `temperature_setpoints_C` | 数据集中出现的每个不同温度（来自文档或原始名称），使多温度研究不只显示最小值和最大值。 |
| `charge_c_rate_max` / `discharge_c_rate_max` | 协议文本中声明或原始名称中编码的最高倍率。`null` 表示未声明，这在行驶工况和现场数据中很常见。 |
| `c_rate_profile` | 电流的形状而非大小：`constant`、`multistage`、`dynamic`、`drive_cycle`。 |
| `protocol_class` | 便于筛选的粗分类：`CC-CV`、`multistage_CC`、`drive_cycle`、`calendar_hold`、`pulse`、`RPT_only`、`abuse`、`mixed`。原文保留在 `protocol_charge_raw` 和 `protocol_discharge_raw`。 |
| `aging_type` | 使电芯老化的方式：`cyclic`、`calendar`、`profile`（重复的负载曲线）、`second_life`、`field`、`abuse_mechanical`、`abuse_thermal`、`characterization`（无老化）、`mixed`。 |
| `soc_window_*` | 百分比，0–100。 |

### 规模（Scale）

| 字段 | 含义 |
|---|---|
| `entity_type` | `cells[]` 中一行是什么：`cell`、`module` 或 `vehicle`。`n_entities` 统计的是这些，因此并不总是电芯数。 |
| `n_entities` 与 `n_entities_declared` | 原始数据中找到的实体数，与登记表声明的数量。二者有差距时设置 `partial_raw`。 |
| `n_cycles_total` | 在原始数据中统计的循环数：每个文件内不同循环编号的个数，再对文件求和（测试仪在每个文件中重新计数）。对非循环数据集，一个单位是一次测试或一个检查点，而不是一个循环；`content.cycle_basis` 会说明。 |
| `cycles_per_entity_median` | 各实体的中位数；当各电芯寿命差异很大时，它比总数更能描述数据集。 |
| `n_raw_files`、`raw_bytes` | 数据集原始数据文件夹顶层的文件数和字节数（压缩包只算一个）。 |

### 内容（Content）

| 字段 | 含义 |
|---|---|
| `signals` | 在原始数据中找到的通道，按列名映射为受控词表。原始文件没有列名时为空（数据集 12 和 30）。 |
| `signals_basis` | `signals` 的确定方式：`raw_data`（从测量文件读取的列名）；原始文件没有表头、通道取自文档时为 `raw_docs`、`landing_page` 或 `paper`，未经文件核实；完全没有信号时为 `null`。 |
| `raw_columns` | `signals` 背后的原始表头，原样保存。 |
| `has_waveforms` | 存在逐采样点的电压数据时为真，区别于逐循环或逐测试的汇总表。 |
| `cycle_basis` | 本数据集中一个循环是什么（见 `n_cycles_total`）。 |
| `observed` | 在所有实体上测得的范围：`voltage_V`、`current_A`、`temperature_C`、`discharge_capacity_Ah`、`discharge_capacity_Ah_median_of_entity_max`，以及存在时的电阻和 SOC。 |
| `source_format` | 原始数据中的文件格式（含压缩包内）：csv、mat、xlsx、pkl 等。 |
| `supported_tasks` | 数据集原则上可支持的任务，来自原始文档。还要检查 `quality.flags`——数据集可能列出 SOH，却仍无法用于 SOH。 |

### 电芯列表（Cells）

`cells[]` **只保存某个电芯与数据集级取值不同的字段**，因此统一的数据集每个电芯只占一行。`read.py` 的 `iter_cells()` 会用数据集默认值补全每个电芯并返回完整行。

| 字段 | 含义 |
|---|---|
| `cell_id` | 原始数据中找到的实体标识（文件名主干、文件夹或文件内标识）。在数据集内唯一。 |
| `labels` | 来源提供的、原样保存的标签：`anomaly_label`（12）、`fault_label`（30）、`observed_score` 和 `calculated_score`（34）、编码在原始名称中的 SOC 窗口和倍率。 |

### 出处（Provenance）

`provenance` 记录记录中各值的来源。

| 字段 | 含义 |
|---|---|
| `field_sources` | 把字段路径（或用 `*` 表示的字段组）映射到其取值来源。可取的值见下表。 |
| `confidence` | `verified` 表示已解析原始数据，`asserted` 表示仅凭文档信任地采用了取值。 |
| `last_verified` | 原始数据最近一次被读取的时间，使过期记录一目了然。 |
| `raw_evidence` | 指向构建本记录所用的逐实体原始提取结果的引用。 |
| `landing_evidence` | 指向所查阅的落地页和 DOI 记录的引用。 |

`field_sources` 各取值的含义：

| 取值 | 含义 | 典型字段 |
|---|---|---|
| `raw_data` | 从原始测量文件测得：表头、数值、行数和循环数。 | `content.signals`、`content.observed`、`scale.n_entities`、`scale.n_cycles_total` |
| `raw_filenames` | 从原始文件名或文件夹名解析（温度、SOC、倍率、电芯标识）。 | `conditions.temperature_setpoints_C`、`cells[].labels` |
| `raw_docs` | 读取自随原始数据附带的 README、PDF 或表格。 | `cell.nominal_capacity_Ah`、`conditions.protocol_charge_raw` |
| `raw_inventory` | 按原始文件清单计数，不打开文件。 | `scale.n_raw_files`、`scale.raw_bytes`、`content.source_format` |
| `registry` | 取自登记表 `dataset_registry.csv`（只读）。 | `identity.dataset_name`、`identity.source_url`、`identity.ref_name`、`scale.n_entities_declared` |
| `landing_page` | 读取自数据集的公开落地页（登记表的 `source_url`），用于原始数据未声明的值。 | 文件只含 V 和 I 的数据集的 `cell.cathode_chemistry` |
| `paper` | 读取自关联论文（通过其 DOI），用于原始数据和落地页都未声明的值。 | `cell.nominal_capacity_Ah` |
| `datasheet` | 读取自该电芯本身的制造商数据手册（按型号查得），用于任何关于该*数据集*的来源都未声明的值。 | `cell.nominal_capacity_Ah`、`cell.voltage_min_V`/`voltage_max_V`、`cell.dimensions_mm` |
| `relationships` | 取自人工维护的、记录哪些数据集共享同一上游研究的记录。 | `identity.study_group` |
| `ref_name` | 从参考名称解析得到。 | `identity.year` |
| `derived` | 按固定规则由其他字段计算，不含新信息。 | `cell.dimensions_mm`、`quality.flags` |
| `curated` | 依据某个明确来源做出的人工判断。 | `conditions.aging_type`、`content.supported_tasks`、`scale.entity_type` |

`field_sources` 的意义在于：没有它，`null` 与经核对确认的缺失看起来毫无区别；而只想要实测事实的使用方可以只保留 `raw_data`、`raw_filenames` 和 `raw_inventory`。

## 约定

- **缺失用 `null` 表示**，绝不用 `"unknown"`、`"ambient"`、`"dynamic"` 或 `0`。绝不使用占位字符串。
- **单位写在字段名中**（`_Ah`、`_V`、`_C`、`_pct`）。范围用两个数值字段，或 `content.observed` 下的二元数组 `[min, max]`，绝不用 `"10/25/35/45"` 这样的字符串。
- **受控词表**定义在数据集 schema 的 `$defs` 中；原始文本另存于 `*_raw` 字段，不丢失信息。
- **电芯只保存差异值。** `cells[]` 中的条目只在该电芯与数据集级取值不同时才列出某字段；`iter_cells()` 负责补全。
- **绝不按数值大小猜测单位。** 单位来自列名或作者文档；两者都没有声明时，该值不予收录。
