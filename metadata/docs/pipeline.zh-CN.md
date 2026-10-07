# 元数据的来源

[English](pipeline.md) | [简体中文](pipeline.zh-CN.md)

说明如何判断 `../datasets/*.json` 和 `../index.json` 中某个值来自哪里、可信程度如何，以及推导字段的含义。字段含义见 [../datasets/README.zh-CN.md](../datasets/README.zh-CN.md)；标记定义见 [flags.zh-CN.md](flags.zh-CN.md)。

每个已填字段都在记录的 `provenance.field_sources` 中注明来源，使用方无需猜测。没有任何来源记载的字段为 `null`。

## 来源顺序

取值只来自数据集自身的原始文件，不使用其他描述数据的来源。交付（delivery）URL 不是来源。原始文件无法提供某个字段时，回退到数据集自己的公开落地页及其关联论文。来源按优先顺序如下：

1. **原始数据本身**——解析每个测量文件：列名和单位、数值范围、行数和循环数、实体（电芯/模组/车辆）标识、文件格式。
2. **原始文件名与文件夹布局**——作者编码在文件名中的测试温度、SOC、倍率和电芯标识（`..._25C_0.5C_...`）。
3. **随原始数据附带的作者文档**——README、PDF、作者表格（`main.xlsx`、`Labels.xls`、`Readme.txt`）。
4. **登记表**——`dataset_registry.csv`：`dataset_name`、`ref_name`、`source_url` 以及记账列。
5. **落地页和论文**——数据集的公开落地页及其 DOI 指向的论文，用于 1–3 无法提供的值（化学体系、标称容量、测试协议）。
6. **电芯本身的制造商数据手册**——当关于该*数据集*的所有来源（1–5）都未声明电芯的标称容量、电压范围或尺寸，但原始数据、其文档或落地页给出了真实的制造商和型号（例如 "Molicel INR-21700-P42A"）时，由该型号的官方数据手册提供数值。绝不会从型号命名规律去猜测规格。未能识别出具体型号的电芯（如内部代号 "Cell A"，或只知道化学体系）不会去查找，该字段保持 `null`。
7. 以上皆未记载的字段保持 `null`。绝不按数值大小猜测——单位来自列名或作者文档，而不是数字看起来有多大。

## 如何阅读出处

`provenance.field_sources` 把字段路径（或一组字段）映射到来源。各来源的定义见 [../datasets/README.zh-CN.md](../datasets/README.zh-CN.md#出处provenance)。若只保留实测事实，保留来源为 `raw_data`、`raw_filenames` 或 `raw_inventory` 的字段。若要了解一条记录中有多少是文档记载而非实测，统计 `raw_docs`、`landing_page`、`paper` 和 `datasheet`。原始数据已被解析时 `provenance.confidence` 为 `verified`，仅凭文档取值时为 `asserted`。

## 各字段的来源

### 1. 从原始数据测得（`raw_data`）

每个数据集的原始文件被读取为实体列表，含行数、循环数以及每个量（电压、电流、温度、容量、电阻、SOC、OCV）的观测范围，另有原始列名、文件清单以及无法读取的文件。这些构成 `content.observed`、`content.signals`、`content.raw_columns`、`scale.n_entities` 和 `scale.n_cycles_total`。

如何理解这些值：

- 列名仅按名称映射为信号。单位换算来自表头（`mA`、`mAh`、`mV`）；单独的 `capacity` 列绝不缩放。需要确认换算的地方用数据核对过，例如数据集 20 的 mA/mAh 列通过对电流积分与容量比对。
- **循环数**按文件统计不同循环编号的个数，再对文件求和，因为测试仪在每个文件中重新计数。带检查点表征的数据集记录 `content.cycle_basis`，说明"一个循环"指什么（数据集 04：每 100 循环检查点对应的老化循环数；滥用或脉冲数据集中一个单位是一次测试）。
- 读取的格式：CSV、XLSX/XLS、MATLAB v5 和 v7.3（含 MATLAB table）、HDF5、Python pickle、`.mpt`（BioLogic），以及 zip/rar/7z/tar.gz 压缩包（含嵌套压缩包）。
- pickle 使用**受限反序列化器**读取，只允许 numpy、pandas、collections 和 torch 张量重建函数。需要其他内容的 pickle 会被拒绝，而不是执行。
- 无法读取的文件（零字节成员、锁文件、未下载完的文件）不会被悄悄丢弃：它们会触发 `unreadable_raw_files` 和 `incomplete_raw_files` 标记（见 [flags.zh-CN.md](flags.zh-CN.md)）。

### 2. 从原始文件名、文件夹或文档读取（`raw_filenames`、`raw_docs`、`raw_inventory`）

`raw_filenames`：从文件名和文件夹路径解析（温度、SOC、倍率、电芯标识）。`raw_docs`：读取自随原始数据附带的作者 README、PDF 或表格。`raw_inventory`：按文件清单计数，不打开文件（`scale.n_raw_files`、`scale.raw_bytes`、`content.source_format`）。

### 3. 从登记表、落地页和论文读取（`registry`、`landing_page`、`paper`）

`registry` 用于 `identity.dataset_name`、`ref_name`、`source_url` 和 `scale.n_entities_declared`。`landing_page` 与 `paper` 用于已抓取页面所声明的值——例如原始文件只记录电压和电流的数据集的化学体系。`identity.doi` / `paper_doi` 中的 DOI 必须是登记表的落地页、原始文档或落地页元数据所声明的；只出现在二手清单里的 DOI 不予记录。

### 3a. 从制造商数据手册读取（`datasheet`）

对于已识别出真实制造商和型号（而非研究内部代号）的具体商用电芯，当关于该数据集本身的来源都未声明 `cell.nominal_capacity_Ah`、`cell.voltage_min_V`/`voltage_max_V` 和 `cell.dimensions_mm` 时，会从该型号自己的官方数据手册中读取这些值。记录中的引用注明所读取的文件。只以内部代号（如 "Cell A"）或仅知化学体系标识电芯的数据集没有型号可查，这些字段保持 `null`，不会去猜测。

### 4. 按规则推导（`derived`）

| 字段 | 规则 |
|---|---|
| `cell.cell_format_codes` | 在形态或型号字符串中找到的第一个尺寸代码：18650、21700、26650、14500、502030、20700、32700 |
| `cell.dimensions_mm` | 按惯例由尺寸代码得出（18650 = 18 x 65 mm），标记 `basis: inferred_from_format_code`；若来源明确给出尺寸则解析该值（`basis: stated`） |
| `conditions.charge_c_rate_max`、`discharge_c_rate_max` | 分别从协议或原始名称中编码的倍率（`0.5C`、`C/5`、`1/3 C`）解析各方向的最大倍率，并汇总所有实体。若倍率由有符号观测电流除以额定 Ah 推算，则来源为 `raw_data`，记录备注会注明这是观测电流估计值。 |
| `conditions.c_rate_profile` | WLTP、UDDS、Artemis、US06、FUDS 或 DST → `drive_cycle`；dynamic、profile 或 flight → `dynamic`；multistage 或 step → `multistage`；否则 `constant` |
| `conditions.protocol_class` | 对协议文本按顺序做关键词匹配：abuse/indentation/ARC/runaway、calendar/storage、pulse/relaxation、drive cycle、multistage、RPT、CC-CV，否则 `mixed` |
| `cell.chemistry_is_multi` | 出现多于一种不同正极化学体系时为真 |
| `identity.notes` | 开头（数量、化学体系、规格、实体类型；与登记数量不同时在括号中标出登记数）和论文引文（在 `evidence/paper_metadata.json` 中按 `paper_doi` 查找）由记录自身字段生成；二者之间的描述语句由人工整理（curation 中的 `notes_detail`），复述本记录的 `conditions.*`、`content.*` 和 `quality.notes`。来源为 `curated`。 |
| `identity.year` | `ref_name` 开头的四位数字 |
| `scale.n_cycles_total`、`cycles_per_entity_median` | 来自上述逐实体循环数 |
| `quality.flags` | 由原始数据、文件清单和登记表计算——见 [flags.zh-CN.md](flags.zh-CN.md) |
| 索引 `facets` | 各字段在全部记录中出现的所有取值 |

### 5. 人工整理（`curated`）

人工整理的值是依据某个明确来源做出的判断。涵盖：

| 字段组 | 内容 |
|---|---|
| `institution`、`aging_type`、`application_domain`、`entity_type`、`supported_tasks` | 依据原始文档、落地页、论文或登记表中一处明确陈述做出的判断。`application_domain`（`lab`）与 `entity_type`（`cell`）在没有相反证据时取默认值。 |
| `charging_profile` | `CC-CV`、`dynamic` 或 `multi-rate`，按占主导的循环协议标注，只依据原始测量文件（抽样循环的充电电流）或随附文档。两者都没有显示协议时为 `null`。 |
| `cell`、`conditions` | 从文档、落地页或论文读到的事实（化学体系、标称容量、电压窗口、温度设定点、协议文本） |
| `doi`、`paper_doi` | 原始文档或落地页声明的 DOI |
| 逐实体的值 | 温度、SOC 等取自原始名称而不是手工录入的值 |
| `quality.notes` 与少数标记 | 发现的情况，以及人工设置的标记（`sample_only_raw`） |

## 对某个值存疑时

- 在 `provenance.field_sources` 中查找其路径，确认来源。
- 把 `cell.*` 中记载的值与 `content.observed` 中的实测范围对比。差距会触发电压越界或容量标记（见 [flags.zh-CN.md](flags.zh-CN.md)）。
- 阅读 `quality.notes` 和 `content.cycle_basis`；它们承载单个字段无法表达的内容，例如"循环"的含义，或某个值为何是 `null`。
- 登记表的数量高于 `scale.n_entities` 时会设置 `partial_raw`，`scale.n_entities_declared` 保存登记表的数字。元数据统计的是原始数据实际提供的部分；登记表往往统计整个上游研究。
