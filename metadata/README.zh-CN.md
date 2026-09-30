# BatteryLake 元数据

[English](README.md) | [简体中文](README.zh-CN.md)

机器可读的数据集元数据：**每个数据集一条 JSON 记录**，外加一个**全局索引**。该索引是数据集页面、基准测试、数据平台和 studio 的唯一事实来源。另有第二层面向研究的画像，说明每个数据集可以用于什么。

每个值都读取自数据集的原始文件：测量文件本身、它们的文件名与文件夹布局，以及随附的文档。原始数据无法提供某个字段时，回退到数据集的公开落地页及其关联论文，即 `dataset_registry.csv` 以及数据集 DOI 和论文 DOI 所指向的来源。交付（delivery）URL 不是来源。没有任何来源记载的字段为 `null`。

## 去哪里看

| 我想…… | 阅读 |
|---|---|
| 从代码中查询元数据 | 下文的[使用方式](#使用方式) |
| 理解某个字段或出处取值 | [datasets/README.zh-CN.md](datasets/README.zh-CN.md) |
| 了解某个质量标记的含义 | [docs/flags.zh-CN.md](docs/flags.zh-CN.md) |
| 找出适合 SOH、RUL、数字孪生、热建模、仿真或合成数据任务的数据集 | [research/README.zh-CN.md](research/README.zh-CN.md) |
| 了解某个值来自哪里、可信程度如何 | [docs/pipeline.zh-CN.md](docs/pipeline.zh-CN.md) |

```
metadata/
  index.json                  <- 首先阅读：每个数据集一行 + 各分面的取值集合
  index_research.json         <- research/ 中研究画像的可筛选索引
  README.md / README.zh-CN.md 本概览（英文 / 简体中文）
  datasets/                   完整记录，包含逐电芯的行
    README.md / README.zh-CN.md   字段参考、出处、约定
    dataset_NN.json               40 条记录（dataset_01 至 dataset_41，无 dataset_10）
  research/                   基于 datasets/ 生成的面向研究的画像
    README.md / README.zh-CN.md   各字段的含义及其推导方式
    dataset_NN.json               40 份画像
  docs/
    flags.md / flags.zh-CN.md         质量标记词表
    pipeline.md / pipeline.zh-CN.md   各值的来源及可信程度
  schema/
    batterylake-dataset-2.0.json         记录 schema
    batterylake-index-2.0.json           索引 schema
    batterylake-research-2.0.json        研究画像 schema
    batterylake-research-index-2.0.json  研究索引 schema
  read.py                     无依赖的读取器，供基准测试和平台使用
```

## 使用方式

### 索引是入口

`index.json` 包含 `counts`、`facets` 和 `datasets`。先在 `datasets` 上筛选，只有需要逐电芯细节时才通过 `record_path` 打开完整记录。`facets` 列出每个可筛选字段出现过的所有取值，筛选界面无需扫描各行。

```python
from metadata.read import load_index, find, load_record, iter_cells, usable_for, by_ref_name

index = load_index()
find(index, cathode_chemistry="LFP", form_factor="cylindrical", min_n_entities=10)
find(index, application_domain=["EV_field", "HEV"], supported_tasks="SOH")
record = load_record("dataset_41")
by_ref_name(index, "2021_KIT_NMC-SiO_18650_MultiC_MultiT")   # 旧名称仍能找到 dataset_14
for cell in iter_cells(record):       # 数据集默认值已补全到每个电芯
    print(cell["cell_id"], cell["nominal_capacity_Ah"], cell["temperature_C"])
```

```ts
// 数据集页面 / studio：索引是纯 JSON，无需加载器
import index from "../metadata/index.json";

const rows = index.datasets.filter(
  (d) => d.cathode_chemistry === "NMC" && d.n_entities >= 20,
);
const options = index.facets.form_factor;          // 构建筛选控件
const record = await fetch(`/metadata/${rows[0].record_path}`).then((r) => r.json());
```

### 从索引到取值

1. **筛选索引。** `find(index, ...)` 返回索引行；`facets(index)` 列出各筛选项可接受的取值；`by_ref_name(index, name)` 可按当前或已弃用的参考名称找到数据集。
2. **打开记录**：只有需要行内没有的信息时，才用 `load_record(row["dataset_id"])`。`iter_cells(record)` 逐电芯产出完整的行，数据集级取值已补全。
3. **把 `null` 理解为"未记载"**，绝不是零。`provenance.field_sources` 说明每个已填字段的来源，`content.observed` 保存原始数据实际测得的内容。
4. **使用数据集前先检查 `quality.flags`**（[docs/flags.zh-CN.md](docs/flags.zh-CN.md)）。`usable_for(index, task, exclude_flags=...)` 可在整个索引上应用这一检查。
5. **判断建模适用性**，使用 `index_research.json` 和 `research/` 中的画像（[research/README.zh-CN.md](research/README.zh-CN.md)）。

### 值得筛选的字段

`cathode_chemistry`、`anode_chemistry`、`form_factor`、`cell_format_code`、`manufacturer`、`institution`、`year`、`aging_type`、`application_domain`、`protocol_class`、`c_rate_profile`、`entity_type`、`supported_tasks`、`signals`、`source_format`、`quality_flags`，以及数值范围 `nominal_capacity_Ah`、`nominal_voltage_V`、`voltage_min_V` / `voltage_max_V`、`temperature_min_C` / `temperature_max_C`、`charge_c_rate_max` / `discharge_c_rate_max`、`n_entities`、`raw_bytes`。

## 当前构建的覆盖情况

40 个数据集，3,451 个实体（电芯、模组或车辆，由 `entity_type` 说明），4,135 个原始文件，300.8 GB，记录的循环计数之和为 7,848,847。各数据集的计数定义不同，比较前请查阅 `content.cycle_basis`。40 个数据集均已从原始文件解析（`provenance.confidence: verified`）；已知缺失、无法读取或尚未解析的输入在各条记录中有注明。

| 字段 | 有值的数据集数 |
|---|---:|
| 正极化学体系 | 36 / 40 |
| 形态 | 36 / 40 |
| 标称容量 | 29 / 40 |
| 完整电压截止值 | 23 / 40 |
| 数据集 DOI / 论文 DOI | 31 / 14（共 40） |
| 有名称的信号 | 38 / 40（12 和 30 存储的是无标签通道） |
| 循环数 | 29 / 40（11 个仍为空，包括循环老化数据集 19、36、37） |

有些字段保持 `null`，因为原始数据及其文档没有记载——例如许多数据集的标称容量只出现在数据及其 README 都没有附带的论文中。`datasets/README.zh-CN.md` 说明了如何理解 `null`，每条记录中的 `provenance.field_sources` 说明每个已填字段的来源。

部分电芯数与登记表不同，因为记录统计的是原始数据实际提供的对象（`scale.n_entities`），而登记表可能统计整个上游研究（`scale.n_entities_declared`）；`partial_raw` 标记会标出这些数据集。
