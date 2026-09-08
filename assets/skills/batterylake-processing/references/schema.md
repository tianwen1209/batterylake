# Schema 2.0.0

## 文件布局和版本

```text
Processed_Dataset/dataset_xx/
  README.md                     # 范围、证据、转换命令、限制
  TODO.md                       # 该数据集阶段清单
  status.json                   # 当前阶段，不以文件存在推断完成
  source_inventory.csv          # 输入文件路径/大小/SHA-256
  archive_members.csv           # 初始第一层 ZIP 清单
  inventory_report.json
  manifest.json                 # 实际输出文件清单、指纹和覆盖统计
  field_mapping.json            # 源字段、类型、单位、变换、标准去向
  canonical/
    entities.parquet            # 电芯/模块身份和别名
    experiments.parquet         # 实验类型、协议和来源证据
    source_tables/              # 全部源字段、原始顺序与结构
    time_series/                # 通用时序逻辑表，可分片
    cycles.parquet              # 能可靠识别的循环，包括不完整循环
    labels.parquet              # 作者标签和派生标签分开
    label_links.parquet         # 标签与样本的显式关联
    extras/                     # 额外字段、数组、对象结构、原始表示
    assets/                     # 协议、说明、非时序资产
  views/<profile_id>/
    profile.json                # 任务定义、字段、标签、筛选、预处理
    cycle_summary.parquet       # 适用时；可用 CSV
    sample_index.parquet        # 指向保真层的稳定键与窗口
    splits.csv                  # 训练/验证/测试对象及固定顺序
  validation/
    coverage.json
    fidelity.json
    benchmark_<profile_id>.json
```

规划/处理中可缺少尚未产生的文件；manifest 只列实际产物，不为未执行的阶段造空数据。格式由 manifest 明确，扩展名不能与实际存储不符。`canonical/source_tables` 可以按来源 schema 分片；benchmark 只依赖统一逻辑表，不直接依赖这些异构表。

统一标识使用字符串，不丢前导零。`dataset_id` 为目录名；`entity_id` 标识测量对象；`entity_kind` 为 cell/module/branch/unknown；已确认单电芯的 `cell_id` 在数据集内唯一；`physical_cell_id` 把同一真实电芯的跨文件/阶段记录连接起来。未确认身份不得臆造跨数据集相同电芯关系。

`source_id` 标识来源容器和对象，建议按相对路径+成员出现序号+对象路径的 SHA-256 生成。同名 ZIP 成员须含出现序号。`source_locator` 是结构化 JSON：archive_chain、member_index、sheet、object_path、record_index、physical_line（按需要填写）。CSV 记录号从 0 开始；物理行号从 1 开始，多行引号字段不得混淆两者。JSON Pointer 转义 `/` 和 `~`；HDF5 保存对象路径和引用关系。

## canonical 通用时序

逻辑主键：`dataset_id, source_id, record_index`；若源对象一行含多条独立传感器测量，再加 `channel_id`。一条源记录只能规范化一次，多个发布格式的别名不能在任务样本中重复。

| 字段 | 类型/可空 | 含义 |
|---|---|---|
| dataset_id, source_id | string/否 | 来源键 |
| record_index | int64/否 | 源对象内从 0 开始的记录顺序 |
| entity_id, cell_id, physical_cell_id | string/是 | 未确认的身份可空，不从任意文件号猜物理电芯 |
| experiment_id, experiment_type | string/是 | 类型：cycling_aging/rpt/capacity/diagnostic/soc/calendar/safety/formation/unknown |
| segment_id | string/是 | 时钟连续段，确认后填写 |
| cycle_id | int64/是 | 可靠识别后的循环内部键，诊断/安全记录不得填 0 |
| source_cycle_id, step_id, source_step_type | string/是 | 保留作者原标识 |
| step_type | string/是 | charge_cc/charge_cv/discharge/rest/pulse/drive/unknown |
| timestamp | string/是 | 无损 ISO 时间；未知时区保持无时区，源表示在 extras |
| source_time, source_time_unit | string/是 | 原始时间值及单位 |
| time_s, elapsed_test_s | float64/是 | 段相对秒数、实验累计秒数，未能确认时可空 |
| current_A, voltage_V | float64/是 | 正充负放、电芯/对象端电压 |
| temperature_C, ambient_temperature_C | float64/是 | 实测温度，额外传感器进 extras |
| charge_capacity_Ah, discharge_capacity_Ah | float64/是 | 原始累计计数器规范化值；保留累计范围/重置语义 |
| charge_energy_Wh, discharge_energy_Wh | float64/是 | 同上 |
| soc | float64/是 | 作者值规范化为比例；派生 SOC 独立说明 |
| sampling_interval_s | float64/是 | 确认的 segment 内前后点时间差；首点空 |
| source_file, source_locator | string/否 | 相对路径及结构化定位 |
| data_quality_flag | string/否 | `ok` 或分号分隔标记；unknown 不等于 ok |

源字段必须全部保存在 `source_tables` 或 typed extras。原始文字表可以每列字符串存储以精确保留数字词法和缺失标记，同时生成 float64 标准列；原始二进制数组保持 dtype、shape、顺序和层级。该做法是过渡保真实现，不意味着所有实验语义已确认。可解析但无法映射单位的字段留原表，报告未标准化，不伪填标准列。

扩展数据不是无类型的大字符串：每个条目含 source_id、object_path、dtype、shape、encoding、storage_path。字符串/空列表/null/NaN/Inf 分别编码；不能让 JSON 默认把它们混为 null。Excel 保留 sheet 名、单元格地址、公式与缓存值、原始文件来源；图表/批注/样式等资产保留来源文件或无损包，数值缓存缺失不能自己执行猜算。作者代码、视频、PDF 和未知二进制留资产及内容哈希，未解码测量标为 `unsupported_measurement`，不能称完整标准化。

## cycles、labels 和关联

`cycles` 主键为 dataset_id + entity_id + cycle_id。至少包括 source_cycle_id、实验顺序、segment 列表、completeness、aging_cycle_count、equivalent_full_cycles、elapsed_time_s 和各值证据。源老化轴未知则空；内部键连续不代表源生命周期连续。

`labels` 主键为 dataset_id + label_id：entity_id、label_name（capacity/soh/rul/eol 等）、value、unit、origin（author/derived）、method、reference_capacity_Ah、measurement_time、available_time、aging_axis_name/value、source_locator、quality。离散/文字标签使用 typed value，不能强制 float。作者的原始百分数在源表示保留，标准标签明确做了 /100。

`label_links` 主键为 dataset_id + profile_id + sample_key + label_id；记录 direct/previous/nearest/interpolated 等关联、因果限制和时间间隔。多标签或重复容量测试不得自动平均。RPT 不是一个老化循环，但可以是一个监督学习样本或某个老化样本的目标来源。

EOL 标签增加 event_observed、censoring_type（none/right/interval/unknown）、axis_unit、lower_bound、upper_bound、definition、definition_source。未观测事件的 value 可空，但删失终点仍须保留。不要把缺标签和零 RUL 混淆。

## cycling_aging_v2 视图

沿用历史两表通用字段，字段定义以这里和主 README 为准：

- `cycle_summary` 主键 dataset_id + cell_id + cycle_id；包含 source_cycle_id、start_time/end_time、nominal_capacity_Ah、soh_reference_capacity_Ah、capacity_Ah、charge/discharge_capacity_Ah、charge/discharge_energy_Wh、soh、eol_definition/eol_source/eol_cycle_id、rul_cycles/rul_method、temperature_max_C/temperature_avg_C、charge/discharge_duration_s、voltage_min/max_V、coulombic_efficiency、sample_count、source_file、data_quality_flag。
- 增加 profile_id、experiment_id、capacity_label_id、soh_label_id、rul_label_id、aging_axis_name、aging_axis_value、eol_axis_value、capacity_method、cycle_completeness、censoring_type。`sample_count` 是视图实际引用的行数。
- 可输出 `time_series.csv/parquet`，或由 sample_index 引用 canonical 时序；两者逻辑等价。沿用 dataset_id、cell_id、segment_id、cycle_id、sample_id（段内从 0 开始）、timestamp、time_s、step_id/type、电流/电压/温度/容量/能量/SOC、sampling_interval_s、source_file/source_row、data_quality_flag，并增加 source_id/record_index。
- summary 的 capacity_Ah 是该 profile 声明的健康容量；可能来自 RPT 标签。循环部分放电吞吐量只能放 discharge_capacity_Ah，不自动代替 capacity_Ah。没有合法健康容量时可留空，该样本不进入需要 SOH 目标的任务。
- eol_definition/eol_source 在尚未选择 EOL profile 时允许空；不能为了满足历史必填列制造默认事件。
- 主键唯一、外键有效、引用行数正确、顺序稳定。保真表不要求每行有 cycle，循环视图要求每行指向合法 cycle；不把非循环数据的空 cycle 当校验失败。

## manifest 与状态

manifest 记录 schema_version、dataset_id、source_inventory 指纹、adapter/version/hash、配置指纹、软件环境、命令、范围（全量/本地样例/部分成员）、输入输出文件及 SHA-256、行数、排序键、字段映射、排除/未解码项和验证路径。路径相对数据集输出目录，避免只能在当前主机读取。

状态分别表达：`conversion`、`canonical_validation`、`benchmark_validation`、`upstream_completeness`，不得压成一个模糊 done。`canonical_validated` 要求全部测量已解码、覆盖与数值核验完成；完整保存未知原始包仍不满足这个条件。`benchmark_verified` 必须绑定具体 profile 和训练环境。日历/安全数据只能把不适用的 profile 记 `not_applicable`，其保真任务仍须完成。

## 已实现的读取接口与 native profiles

`scripts/processing/loader.py` 提供 `BatteryDataset` 和 `iter_profile_samples(dataset_path, profile_id)`。统一样本返回 `X`（有名称的 NumPy 数组）、`y`、`valid`、`group_id`、`sample_id` 和 `metadata`。数组保持原始长度；框架所需的 padding、插值、特征选取和 scaler 必须由 benchmark profile 明确配置。不同任务的输入通道可以不同，不能仅凭统一接口宣称任务相同。未分配 train/validation/test；`group_id` 仅提供分组依据。

- dataset_12：`native_charging_snippet_v1`，128×8 原始矩阵和作者离散标签。`canonical/native_samples` 的 Parquet 行使用 dtype + shape + array_order + matrix_bytes；元数据按类型编码。不能把作者默认 capacity=0 当 SOH。旧包头对象已从有效 catalogue 移除，loader 拒绝把 PyTorch MAGIC 当样本。
- dataset_18：`author_rpt_soh_v1`，保留作者 Step 13 C/3 充电曲线及其 RPT 容量归一化规则，源 MAT 标签做独立对照。
- dataset_38：`native_rpt_c5_relative_capacity_v1`，原始 C/5 放电曲线，SOH 明确定义为该电芯初次 RPT 的容量比。缺失容量的原始空列表在 `capacity_native_json` 保留，`label_valid=false`；`rpt_id` 不是老化循环号。
- dataset_39：`native_q_relative_capacity_v1`，作者 Q/dQ 曲线及相对初始容量；作者容量单位保持 native。不同源 MAT 中相同电芯短名称加来源命名空间。
- dataset_41：`native_cycle_relative_capacity_v1`，原始循环曲线及相对作者首次 dq；作者 RUL 原值另存，EOL 定义未核实。

这些 profile 的验证报告确认输入/目标对照范围；未运行配对模型训练，不标 `benchmark_verified`。作者特征、RPT 和充电片段分别存 `cycle_features`、`rpt_samples`、`native_samples` 等逻辑表，通过 manifest 路由，不制造空的循环表。

全体源表仍能由 `BatteryDataset.source_table(source_id)` 读取。`iter_signal_batches()` 默认要求 canonical 验收通过；探索性读取未验收投影必须显式传 `allow_unreviewed=True`。指定列时应先查看实际 schema，原始附加通道不会因标准列集合而被删除。

新增 dataset_16 的 `author_pulse_soh_v1` 使用作者 SOC ALL 表的 U1–U21 和原始 SOH；dataset_41 的 `author_rul_native_v1` 使用作者原始 rul 值。后者只支持作者标签复现，不代表所有数据集共享同一物理 EOL 定义。

dataset_29 的 `canonical/nested_tables` 将嵌套字符串中的数据表展开，JSON 单元格保留原始类型及缺失键。dataset_37 的 `canonical/time_axes` 按 source_id + record_index 与信号表关联，loader 检查每批行号一致；合法时钟使用十进制秒保存，未知单位的数值时间保留在源表。物理身份元数据冲突时保持空值。
