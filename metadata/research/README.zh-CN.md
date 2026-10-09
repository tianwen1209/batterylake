# 面向研究的数据集画像

[English](README.md) | [简体中文](README.zh-CN.md)

每个数据集对应一个 `dataset_NN.json`，由 `../datasets/dataset_NN.json` 推导而来。`datasets/` 描述原始数据*包含什么*，这一层回答研究者*能用它做什么*：哪些物理量存在或可推导，以及数据集实际支持哪些建模任务。

请把画像和 `../index_research.json` 当作只读数据。电芯规格与测试设定仍保存在 `provenance.derived_from` 指向的基础记录中。缺少循环数或温控设定并不否定有来源支持的波形通道。只有原始数据中存在有限的温度值，才算实测电芯温度；温控箱设定值不是记录的温度。数据集 32 的 EIS 温度值以频率为轴，属于温度记录，但不构成温度时间序列。

`../index_research.json` 是筛选入口：每个数据集一行，只保留值得筛选的字段（`complete_v_i_t_timeseries`、`soc_computable`、`soh_computable`、`capacity_degradation_present`、`ocv_present`、`internal_resistance_present`、`eis_present`、`thermal_characterization`、`suitable_tasks`、`source_confidence`），另有 `facets` 块列出出现过的所有 `category`、`suitable_tasks` 和 `source_confidence` 取值，筛选界面无需扫描各行或逐个打开文件。选定具体数据集后，通过 `record_path` 打开完整画像——索引行不能替代它。Schema：`../schema/batterylake-research-2.0.json`（画像）和 `../schema/batterylake-research-index-2.0.json`（`index_research.json`）。

## 字段

| 字段 | 含义 |
|---|---|
| `timeseries` | **处理后**数据中的标准时间序列情况，而非原始文件的内容。某个通道（`has_voltage_timeseries`、`has_current_timeseries`、`has_temperature_timeseries`，后者指电芯温度而非环境温度）在标准时间序列表中至少 1% 的行有值时计为存在；`complete_v_i_t_timeseries` 要求三者都达到 99% 以上。`resolution`：`full_waveforms`（V、I、T 均完整）、`partial_waveforms`（有标准序列但缺少或稀疏某个通道）、`waveform_sample_only`（序列仅来自源数据的样本）、`summary_tables_only`（只有 RPT、循环特征或检测表：38、39、40）、`unlabelled_channels`（无命名通道的原生矩阵或张量：12、30）、`not_standardised`（处理后的数据中没有标准时间序列表，即使原始数据含波形）。`signals_basis` 为 `processed_data`；`caveats` 列出限定它的基础记录标记，`not_standardised` 另加 `processed_series_missing`。其余字段（`soc`、`research_applicability`、`suitable_tasks`、`thermal`）仍读取原始信号。 |
| `soc.computable` | 电压和电流波形允许安时积分计算 SOC，或存在显式 `soc` 通道时为真。 |
| `soh.computable` | 仅当**人工整理的** `supported_tasks` 含 `SOH`、原始数据中有容量通道、且没有阻断标记（`capacity_exceeds_nominal`）时为真。整理过程带有仅凭列名无法看出的领域知识——例如某个容量列其实是吞吐量计数器。 |
| `capacity_degradation` | 是否存在纵向衰减趋势：有容量通道，`aging_type` 为 `cyclic`、`calendar`、`profile`、`field`、`mixed` 或 `second_life`，且循环数多于一次。数据集可以 `soh.computable: true`（一个快照标签）而 `capacity_degradation.present: false`（没有老化轴）。 |
| `ocv` | 仅当原始 README、原始文件布局或原始数据列明确说明有 OCV、伪 OCV、GITT 或弛豫测量时 `present: true`。`confidence` 为 `confirmed`（有专门的测试协议）或 `estimated`（作者提供的 OCV 估计列，数据集 11 和 13）。`basis` 注明所引用的原始文件或文档。 |
| `internal_resistance` | 原始数据含有已填充的电阻通道或表格，或原始文档说明测过直流内阻时 `present: true`。`confidence: derivable` 表示存在阻抗谱，可从中读出高频电阻。始终为空的电阻表头不算数。 |
| `eis` | 原始数据含阻抗谱（频率与阻抗通道或 EIS 文件）时 `present: true`。弛豫研究归入 `ocv`，不在此处。 |
| `thermal.thermal_characterization` | 滥用/热失控研究（`aging_type: abuse_thermal` 或 `application_domain: safety`）为真。`thermal.temperature_logging` 则要求有名称明确且含有限实测值的温度通道；温控设定、以角度为单位的相位，以及全为 NaN 的占位列不算实测温度。 |
| `research_applicability` | 五个布尔值：`parameter_identification`（需要 V 和 I）、`piml_calibration`（需要完整 V/I/T 波形，加上退化或热特性维度）、`soh_rul_prediction`、`simulation`（完整 V/I/T 波形）、`synthetic_data_generation`（完整 V/I/T 波形，且至少 20 个循环、3 个实体）。 |
| `suitable_tasks` | 该数据集适合的任务标签：`SOH_estimation`、`RUL_prediction`、`SOC_estimation`、`digital_twin_calibration`、`thermal_modelling`、`simulation`、`synthetic_data_generation`、`EIS_characterization`、`OCV_curve_extraction`、`fault_diagnosis`。 |
| `source_quality_flags` | 原样继承自 `datasets/dataset_NN.json`——见 [../docs/flags.zh-CN.md](../docs/flags.zh-CN.md)。`shared_cells_with_other_dataset` 等跨数据集事实保存在基础元数据中，不在此处计算。 |

## 出处（Provenance）

每个画像带有 `provenance` 块，仿照 `datasets/dataset_NN.json` 中的同名块。

| 字段 | 含义 |
|---|---|
| `derived_from` | 计算画像所依据的基础记录。 |
| `generated` | 画像最近一次生成的日期。 |
| `field_sources` | 每个字段组的取值来源，可取的值见下表。 |
| `confidence` | 继承自基础记录。画像的可信度不可能高于其输入。 |
| `last_verified` | 继承：基础记录的输入最近一次从原始数据读取的时间。 |

| 取值 | 含义 | 用于 |
|---|---|---|
| `dataset_record` | 原样复制自 `datasets/dataset_NN.json`。 | `ref_name`、`source_quality_flags` |
| `derived` | 由固定规则从基础记录字段计算得出。对 `ocv.*` 而言，也用于没有任何原始来源说明有 OCV 测量的数据集，意为"未证明存在"。 | `soc.*`、`soh.*`、`capacity_degradation.*`、`thermal.*`、`research_applicability.*`、`suitable_tasks` |
| `processed_data` | 由处理后数据的标准时间序列表计数（`timeseries` 块）。 | `timeseries.*` |
| `raw_data` | 读取自从原始数据提取的逐实体证据：电阻列、阻抗文件、EIS 谱。原始数据中什么也没有时同样使用该值。 | `internal_resistance.*`、`eis.*` |
| `hand_checked` | 已确认 OCV 与内部电阻测量的带出处表中的一条：从原始 README、原始文件布局或原始数据列读到、但基础 schema 不保存的事实。每条的 `basis` 指明所引用的原始文件。 | `ocv.*`（04、11、13、18、19、26、28、31）、`internal_resistance.*`（05、11、13、38） |
| `folder_layout` | 数据集所在的类别文件夹。 | `category` |

## 这一层不是什么

这一层不会重新解析原始数据；它重组 `datasets/` 记录，读取从原始文件提取的电阻和 EIS 证据，并加上上述少量人工核对的事实。每个不那么显然的布尔值都可追溯到这几处之一。
