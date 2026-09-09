/* BatteryLake AI assistant — built-in knowledge base.
 *
 * Answers common questions about the platform without any network call:
 * catalog statistics (computed live from the dataset list), individual
 * datasets, chemistry / form-factor / category look-ups, the processing skill,
 * status.json fields, benchmarks, quality, citation, team and navigation.
 * Also produces a compact grounding context for the optional remote model.
 *
 * Answers use a tiny markdown subset rendered by assistant.js:
 *   **bold**, `code`, - bullets, blank line = paragraph,
 *   [label](#page), [label](dataset:dataset_03), [label](https://...)
 */
(function () {
  'use strict';

  var SITE = 'https://tianwen1209.github.io/batterylake/';
  var REPO_SITE = 'https://github.com/tianwen1209/batterylake';
  var REPO_PREP = 'https://github.com/tianwen1209/BatteryLake-Benchmark-DataPrep';
  var ARXIV = 'https://arxiv.org/abs/2607.09762';

  var CATEGORY_LABELS = {
    cycle_aging: 'Cycle aging', calendar_aging: 'Calendar aging', characterization: 'Characterization',
    field_data: 'Field data', field_fault_diagnosis: 'Field fault diagnosis', soh_estimation: 'SOH estimation',
    soc_estimation: 'SOC estimation', eis: 'EIS / impedance', thermal_runaway: 'Thermal runaway / safety', ev: 'EV fleet'
  };
  var CATEGORY_LABELS_ZH = {
    cycle_aging: '循环老化', calendar_aging: '日历老化', characterization: '表征测试',
    field_data: '现场数据', field_fault_diagnosis: '现场故障诊断', soh_estimation: 'SOH 估计',
    soc_estimation: 'SOC 估计', eis: 'EIS / 阻抗', thermal_runaway: '热失控 / 安全', ev: '电动汽车'
  };
  var STATUS_LABELS = { done: 'Processed (standard v2 output available)', wip: 'Processing in progress', pending: 'Pending processing' };
  var STATUS_LABELS_ZH = { done: '已处理（有 v2 标准产物）', wip: '处理中', pending: '待处理' };

  /* ── helpers ─────────────────────────────────────────────────────── */
  var CJK = /[぀-ヿ㐀-鿿]/;
  function isZh(text) { return CJK.test(text || ''); }
  var PUNCT = { '？': '?', '！': '!', '，': ',', '。': '.', '、': ',', '；': ';', '：': ':', '（': '(', '）': ')', '【': '[', '】': ']', '“': '"', '”': '"', '‘': "'", '’': "'" };
  function norm(text) {
    return String(text || '').toLowerCase()
      .replace(/[？！，。、；：（）【】“”‘’]/g, function (c) { return PUNCT[c] || c; })
      .replace(/\s+/g, ' ').trim();
  }
  function latinTokens(text) {
    return (norm(text).match(/[a-z0-9][a-z0-9.\-]*/g) || []).map(function (t) { return t.replace(/[.\-]+$/, ''); }).filter(function (t) { return t.length >= 2; });
  }
  function fmtInt(n) { return Number(n || 0).toLocaleString('en-US'); }
  function fmtCycles(n) {
    n = Number(n) || 0;
    if (n >= 1e6) return (n / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    return fmtInt(n);
  }
  function fmtGB(mb, zh) {
    var gb = (Number(mb) || 0) / 1000;
    if (!gb) return zh ? '未记录' : 'n/a';
    if (gb < 0.001) return '<1 MB';
    if (gb >= 100) return Math.round(gb) + ' GB';
    if (gb >= 1) return gb.toFixed(1).replace(/\.0$/, '') + ' GB';
    return Math.round(Number(mb) || 0) + ' MB';
  }
  function brief(text, max) {
    text = String(text || '').replace(/\s+/g, ' ').trim();
    max = max || 220;
    if (text.length <= max) return text;
    var cut = text.slice(0, max);
    var stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('; '));
    return (stop > 80 ? cut.slice(0, stop + 1) : cut) + ' …';
  }
  function safe(fn, fallback) { try { var v = fn(); return v === undefined ? fallback : v; } catch (_) { return fallback; } }

  function catalog() {
    return safe(function () {
      if (typeof getCatalogDatasets === 'function') return getCatalogDatasets();
      if (typeof DATASETS !== 'undefined') return DATASETS.filter(function (d) { return typeof isHiddenFromCatalog !== 'function' || !isHiddenFromCatalog(d); });
      return [];
    }, []);
  }
  function metrics() {
    var m = safe(function () { return typeof computeHomeMetrics === 'function' ? computeHomeMetrics() : null; }, null);
    if (m && m.datasets) return m;
    return { datasets: 40, labs: 31, yearMin: 2007, yearMax: 2026, years: 19, cycles: 2240000, cells: 1819, volumeGB: 245 };
  }
  function chemList() {
    var set = {};
    catalog().forEach(function (d) { String(d.chemistry || '').split(/[\/,\-]/).forEach(function (c) { c = c.trim(); if (c && c !== 'Multi' && c !== 'Unknown') set[c] = 1; }); });
    return Object.keys(set).sort();
  }
  function formList() {
    var set = {};
    catalog().forEach(function (d) { if (d.form) set[d.form] = 1; });
    return Object.keys(set).sort();
  }

  /* ── dataset rendering ───────────────────────────────────────────── */
  function datasetCard(d, zh) {
    var cat = (zh ? CATEGORY_LABELS_ZH : CATEGORY_LABELS)[d.category] || d.category || '—';
    var status = (zh ? STATUS_LABELS_ZH : STATUS_LABELS)[d.status] || d.status || '—';
    var cells = String(d.cells || '').trim().replace(/^[—–-]+$/, '') || (zh ? '未记录' : 'not recorded');
    var cycles = Number(d.cycles) ? fmtInt(d.cycles) : (zh ? '未统计' : 'not established');
    var links = ['[' + (zh ? '在目录中打开' : 'Open in catalog') + '](dataset:' + d.id + ')'];
    if (d.doi) links.push('[' + (zh ? '原始来源' : 'Source / DOI') + '](' + d.doi + ')');
    if (d.processed_url) links.push('[' + (zh ? '处理后数据' : 'Processed data') + '](' + d.processed_url + ')');
    var lines = ['**' + d.name + '** (`' + d.id + '`)'];
    if (zh) {
      lines.push('- 标准名：`' + d.ref_name + '`');
      lines.push('- 化学体系 / 形态：' + (d.chemistry || '—') + ' · ' + (d.form || '—'));
      lines.push('- 电芯数：' + cells + ' · 循环数：' + cycles + ' · 原始数据量：' + fmtGB(d.size_mb, true));
      lines.push('- 类别：' + cat + ' · 状态：' + status);
      if (d.notes) lines.push('- 备注：' + d.notes);
      if (d.evidence) lines.push('- 统计依据：' + brief(d.evidence));
    } else {
      lines.push('- Reference name: `' + d.ref_name + '`');
      lines.push('- Chemistry / form factor: ' + (d.chemistry || '—') + ' · ' + (d.form || '—'));
      lines.push('- Cells: ' + cells + ' · Cycles: ' + cycles + ' · Source volume: ' + fmtGB(d.size_mb));
      lines.push('- Category: ' + cat + ' · Status: ' + status);
      if (d.notes) lines.push('- Notes: ' + d.notes);
      if (d.evidence) lines.push('- Count basis: ' + brief(d.evidence));
    }
    return lines.join('\n') + '\n\n' + links.join(' · ');
  }
  function datasetLine(d, zh) {
    var cellsRaw = String(d.cells || '').trim().replace(/^[—–-]+$/, '');
    var cells = cellsRaw ? cellsRaw + (/^[\d,]+$/.test(cellsRaw) ? (zh ? ' 个电芯' : ' cells') : '') : '';
    var vol = Number(d.size_mb) ? fmtGB(d.size_mb) : '';
    var bits = [d.chemistry, d.form, cells, vol].filter(Boolean).join(' · ');
    return '- [' + d.name + '](dataset:' + d.id + ') — ' + bits;
  }
  function datasetList(items, title, zh) {
    var shown = items.slice(0, 12);
    var out = title + '\n' + shown.map(function (d) { return datasetLine(d, zh); }).join('\n');
    if (items.length > shown.length) out += '\n' + (zh ? '- …还有 ' + (items.length - shown.length) + ' 个，见 [数据集目录](#datasets)' : '- … and ' + (items.length - shown.length) + ' more in the [Datasets catalog](#datasets)');
    return out;
  }

  /* ── dataset look-ups ────────────────────────────────────────────── */
  var CHEM_WORDS = { lfp: 'LFP', nmc: 'NMC', nmc811: 'NMC', lco: 'LCO', nca: 'NCA', lmo: 'LMO', lto: 'LTO', '磷酸铁锂': 'LFP', '三元': 'NMC', '钴酸锂': 'LCO' };
  var FORM_WORDS = { '18650': '18650', '21700': '21700', pouch: 'Pouch', prismatic: 'Prismatic', cylindrical: 'Cylindrical', '软包': 'Pouch', '方形': 'Prismatic', '圆柱': 'Cylindrical' };
  var CATEGORY_WORDS = [
    [/calendar|日历/, 'calendar_aging'], [/thermal runaway|thermal|safety|热失控|安全/, 'thermal_runaway'],
    [/\beis\b|impedance|阻抗/, 'eis'], [/fault|故障/, 'field_fault_diagnosis'], [/field data|\bfield\b|现场|实车/, 'field_data'],
    [/electric vehicle|\bev\b|\bevs\b|电动汽车|车队/, 'ev'], [/\bsoc\b|state of charge/, 'soc_estimation'],
    [/characteri[sz]ation|表征/, 'characterization'], [/cycle aging|cycling|循环老化/, 'cycle_aging']
  ];
  var STOP = { the: 1, and: 1, for: 1, with: 1, what: 1, which: 1, how: 1, many: 1, are: 1, is: 1, there: 1, dataset: 1, datasets: 1, data: 1, battery: 1, batteries: 1, tell: 1, about: 1, show: 1, list: 1, all: 1, have: 1, does: 1, you: 1, can: 1, please: 1, info: 1, information: 1, cells: 1, cell: 1, cycles: 1, from: 1, this: 1, that: 1, any: 1, give: 1, find: 1, search: 1, one: 1, use: 1, using: 1, some: 1, has: 1, was: 1, who: 1, where: 1, when: 1, why: 1, lithium: 1, ion: 1, aging: 1, ageing: 1, degradation: 1, me: 1, in: 1, of: 1, on: 1, to: 1, it: 1, its: 1 };

  function datasetTokens(d) {
    var text = [d.name, String(d.ref_name || '').replace(/_/g, ' '), d.id, d.notes].join(' ');
    return latinTokens(text).filter(function (t) { return !STOP[t]; });
  }
  function findDatasets(query) {
    var q = norm(query);
    var items = catalog();
    var idMatch = q.match(/dataset[_\s-]?(\d{1,2})\b/);
    if (idMatch) {
      var id = 'dataset_' + (idMatch[1].length === 1 ? '0' + idMatch[1] : idMatch[1]);
      var hit = items.filter(function (d) { return d.id === id; });
      if (hit.length) return { mode: 'card', items: hit, score: 10 };
    }
    var qTokens = latinTokens(q).filter(function (t) { return !STOP[t]; });
    var scored = items.map(function (d) {
      var toks = datasetTokens(d);
      var nameToks = latinTokens(d.name);
      var score = 0;
      qTokens.forEach(function (t) {
        if (CHEM_WORDS[t] || FORM_WORDS[t]) return;
        if (nameToks.indexOf(t) >= 0) score += 3;
        else if (toks.indexOf(t) >= 0) score += 2;          // ref_name / id / notes (e.g. author names)
        else if (t.length >= 4 && toks.some(function (x) { return x.indexOf(t) === 0 || (t.indexOf(x) === 0 && x.length >= 4); })) score += 1;
      });
      if (q.indexOf(norm(d.name)) >= 0) score += 6;
      return { d: d, score: score };
    }).filter(function (s) { return s.score >= 2; }).sort(function (a, b) { return b.score - a.score; });
    if (scored.length) {
      var top = scored[0].score;
      var keep = scored.filter(function (s) { return s.score >= Math.max(2, top - 1.5); }).map(function (s) { return s.d; });
      return { mode: keep.length === 1 ? 'card' : 'list', items: keep, score: top };
    }
    return null;
  }
  function filterDatasets(query) {
    var q = norm(query);
    var toks = latinTokens(q);
    var chem = null, form = null, cat = null;
    toks.forEach(function (t) { if (CHEM_WORDS[t]) chem = chem || CHEM_WORDS[t]; if (FORM_WORDS[t]) form = form || FORM_WORDS[t]; });
    Object.keys(CHEM_WORDS).forEach(function (k) { if (CJK.test(k) && q.indexOf(k) >= 0) chem = chem || CHEM_WORDS[k]; });
    Object.keys(FORM_WORDS).forEach(function (k) { if (CJK.test(k) && q.indexOf(k) >= 0) form = form || FORM_WORDS[k]; });
    for (var i = 0; i < CATEGORY_WORDS.length; i++) { if (CATEGORY_WORDS[i][0].test(q)) { cat = CATEGORY_WORDS[i][1]; break; } }
    if (!chem && !form && !cat) return null;
    var items = catalog().filter(function (d) {
      if (chem && String(d.chemistry || '').toUpperCase().indexOf(chem) < 0) return false;
      if (form && String(d.form || '').toLowerCase().indexOf(form.toLowerCase()) < 0) return false;
      if (cat && d.category !== cat) return false;
      return true;
    });
    return { chem: chem, form: form, cat: cat, items: items };
  }

  /* ── FAQ entries ─────────────────────────────────────────────────── */
  function statsAnswer(zh) {
    var m = metrics();
    if (zh) {
      return '目前 BatteryLake 目录里的数字（页面加载时从数据集列表实时计算）：\n' +
        '- 精选数据集：**' + m.datasets + '** 个\n' +
        '- 来源机构：**' + m.labs + '** 个（' + m.yearMin + '–' + m.yearMax + '）\n' +
        '- 电芯总数：**' + fmtInt(m.cells) + '**\n' +
        '- 循环总数：**' + fmtCycles(m.cycles) + '**\n' +
        '- 原始数据量：**' + Math.round(m.volumeGB) + ' GB**（按原作者发布的完整数据集统计）\n\n' +
        '涵盖化学体系：' + chemList().join(' · ') + '；形态：' + formList().join(' · ') + '。查看 [数据集目录](#datasets)。';
    }
    return 'Current BatteryLake catalog figures (computed live from the dataset list):\n' +
      '- Curated datasets: **' + m.datasets + '**\n' +
      '- Source institutions: **' + m.labs + '** (' + m.yearMin + '–' + m.yearMax + ')\n' +
      '- Total cells: **' + fmtInt(m.cells) + '**\n' +
      '- Total cycles: **' + fmtCycles(m.cycles) + '**\n' +
      '- Source data volume: **' + Math.round(m.volumeGB) + ' GB** (full datasets as published by the originating labs)\n\n' +
      'Chemistries: ' + chemList().join(' · ') + '. Form factors: ' + formList().join(' · ') + '. Browse the [Datasets catalog](#datasets).';
  }

  var FAQ = [
    {
      id: 'intro',
      keys: ['what is batterylake', 'about batterylake', 'introduce', 'introduction', 'overview', 'what does this site', 'what is this website', 'purpose', 'batterylake是什么', '什么是batterylake', '介绍一下', '这个网站是做什么', '这是什么', '平台介绍', '简介'],
      en: function () { return '**BatteryLake** is an open data foundation for battery prognostics and health management. It curates, standardizes and evaluates lithium-ion battery aging datasets from research labs worldwide so that machine-learning models for **state-of-health (SOH)** estimation and **remaining-useful-life (RUL)** prediction can be compared fairly.\n\nMain areas: [Datasets](#datasets) catalog with source and processed downloads, [Preprocessing](#preprocessing) agent skill that converts raw data into the BatteryLake v2.0.0 standard, [Quality](#quality) assessment, [Benchmarks](#benchmarks) for SOH/RUL experiments, a [Model library](#models) and a developer [API console](#apis). It is built at Nanyang Technological University (see [About](#about)).'; },
      zh: function () { return '**BatteryLake** 是面向电池预测与健康管理（PHM）的开放数据基础平台：汇集、标准化并评估全球实验室的锂离子电池老化数据集，让 **SOH（健康状态）估计** 和 **RUL（剩余寿命）预测** 模型可以公平对比。\n\n主要板块：[Datasets](#datasets) 数据集目录（含原始与处理后数据下载）、[Preprocessing](#preprocessing) 把原始数据转换成 BatteryLake v2.0.0 标准的 Agent skill、[Quality](#quality) 质量评估、[Benchmarks](#benchmarks) SOH/RUL 实验、[Model library](#models) 模型库、[APIs](#apis) 开发者控制台。项目由南洋理工大学（NTU）团队维护，见 [About](#about)。'; }
    },
    {
      id: 'stats',
      keys: ['how many datasets', 'number of datasets', 'how many cells', 'how many cycles', 'total cycles', 'total cells', 'data volume', 'how big', 'how much data', 'statistics', 'stats', 'how many institutions', 'how many labs', 'catalog size', 'total size', '多少个数据集', '有多少数据集', '数据集数量', '多少个cell', '多少电芯', '多少个电芯', '多少循环', '多少个循环', '数据量', '多大', '统计', '多少个机构', '多少机构', '总共', '一共'],
      en: function () { return statsAnswer(false); },
      zh: function () { return statsAnswer(true); }
    },
    {
      id: 'chemistries',
      keys: ['which chemistries', 'what chemistries', 'chemistries covered', 'chemistry list', 'form factors', 'which form factor', 'what form factors', '有哪些化学体系', '哪些化学体系', '化学体系有', '有哪些形态', '哪些形态', '电芯形态'],
      en: function () { return 'Chemistries in the catalog: **' + chemList().join(' · ') + '** (plus several multi-chemistry datasets).\nForm factors: **' + formList().join(' · ') + '**.\n\nAsk for example "which datasets are LFP?" or "pouch cell datasets" to get the matching list, or filter directly in the [Datasets catalog](#datasets).'; },
      zh: function () { return '目录中的化学体系：**' + chemList().join(' · ') + '**（另有多个混合体系数据集）。\n形态：**' + formList().join(' · ') + '**。\n\n可以直接问“有哪些 LFP 数据集”或“软包电芯数据集”，我会列出匹配项；也可以在 [数据集目录](#datasets) 里筛选。'; }
    },
    {
      id: 'download',
      keys: ['how to download', 'download dataset', 'download the data', 'where to download', 'get the data', 'access the data', 'raw data', 'source data', 'processed data', 'sharepoint', 'download link', '怎么下载', '如何下载', '下载数据', '在哪下载', '哪里下载', '获取数据', '原始数据', '处理后的数据', '下载链接'],
      en: 'Open the [Datasets catalog](#datasets), click a dataset card, and use the two links in the detail window:\n- **Source** — the original archive/DOI published by the authors.\n- **Processed** — the BatteryLake standardized output (canonical parquet tables + benchmark views), hosted on the NTU SharePoint folder linked from each card.\n\nThe detail window also shows chemistry, form factor, cell and cycle counts, the count basis, and processing status. Datasets marked "pending" only have the source link so far. You can also ask me about a specific dataset by name, e.g. "NASA PCoE dataset".',
      zh: '打开 [数据集目录](#datasets)，点击任一数据集卡片，在详情窗口里有两个链接：\n- **Source** — 原作者发布的原始数据 / DOI。\n- **Processed** — BatteryLake 标准化产物（canonical parquet 表 + benchmark 视图），存放在每张卡片链接的 NTU SharePoint 目录。\n\n详情窗口还会显示化学体系、形态、电芯/循环数量、统计依据和处理状态。状态为 pending 的数据集目前只有原始数据链接。也可以直接问我某个数据集，例如“NASA PCoE 数据集”。'
    },
    {
      id: 'schema',
      keys: ['schema', 'data format', 'file format', 'parquet', 'canonical', 'file layout', 'folder structure', 'output structure', 'what files', 'time_series', 'entities.parquet', 'labels.parquet', 'cycles.parquet', 'manifest', 'views', 'profile.json', 'standard v2', 'v2.0.0', 'load in python', 'read_parquet', 'pandas', '数据格式', '文件格式', '文件结构', '目录结构', '输出结构', '有哪些文件', '标准格式', '怎么读取', '如何读取', '用python读'],
      en: 'Every processed dataset follows the **BatteryLake v2.0.0 standard** (`Processed_Dataset/dataset_xx/`):\n- `canonical/` — provenance-preserving fidelity layer: `entities.parquet` (cell/module identity), `experiments.parquet`, `source_tables/` (all source fields in original order), `time_series/` (canonical time series), `cycles.parquet`, `labels.parquet` + `label_links.parquet` (author vs derived labels), `extras/`, `assets/`.\n- `views/<profile_id>/` — explicit SOH/RUL task views: `profile.json`, `cycle_summary.parquet`, `sample_index.parquet`, `splits.csv`.\n- `validation/` — `coverage.json`, `fidelity.json`, `benchmark_<profile>.json`.\n- `status.json`, `manifest.json`, `field_mapping.json`, `source_inventory.csv`, `README.md`, `TODO.md`.\n\nLoad with pandas: `pd.read_parquet("canonical/cycles.parquet")`. Full details: [Schema reference](skill/?doc=schema) and the [Processing standard](skill/?doc=standard); the [Preprocessing page](#preprocessing) has an interactive output explorer.',
      zh: '每个处理后的数据集都遵循 **BatteryLake v2.0.0 标准**（`Processed_Dataset/dataset_xx/`）：\n- `canonical/` — 保真层，保留完整来源：`entities.parquet`（电芯/模块身份）、`experiments.parquet`、`source_tables/`（全部源字段、原始顺序）、`time_series/`（通用时序）、`cycles.parquet`、`labels.parquet` + `label_links.parquet`（作者标签与派生标签分开）、`extras/`、`assets/`。\n- `views/<profile_id>/` — 明确的 SOH/RUL 任务视图：`profile.json`、`cycle_summary.parquet`、`sample_index.parquet`、`splits.csv`。\n- `validation/` — `coverage.json`、`fidelity.json`、`benchmark_<profile>.json`。\n- `status.json`、`manifest.json`、`field_mapping.json`、`source_inventory.csv`、`README.md`、`TODO.md`。\n\n用 pandas 读取：`pd.read_parquet("canonical/cycles.parquet")`。详见 [Schema 参考](skill/?doc=schema) 与 [处理规范](skill/?doc=standard)；[Preprocessing 页面](#preprocessing) 有交互式的输出结构浏览器。'
    },
    {
      id: 'skill',
      keys: ['skill', 'batterylake-processing', 'install the skill', 'how to install', 'claude code', 'codex', 'agent', 'preprocessing', 'preprocess', 'how to process', 'convert', 'conversion', 'etl', 'pipeline', 'adapter', 'run the skill', 'download skill', '怎么安装', '如何安装', '安装skill', '安装技能', '预处理', '怎么处理', '如何处理', '处理流程', '处理数据', '转换', '技能'],
      en: 'The **batterylake-processing** skill is an instruction package for a coding agent (Claude Code or Codex) that converts one raw dataset into the BatteryLake v2.0.0 standard.\n\nInstall:\n- Download `batterylake-processing.zip` from the [Preprocessing page](#preprocessing).\n- Claude Code: `unzip batterylake-processing.zip -d .claude/skills/` then invoke `/batterylake-processing`.\n- Codex: `unzip batterylake-processing.zip -d .agents/skills/` and mention the skill by name.\n\nRun: open your BatteryLake repository (the folder holding `Raw_Dataset` and `Processed_Dataset_Standard`), pick the dataset on the Preprocessing page, copy the generated prompt into the agent. The skill works through five gates (Inventory → Semantics → Conversion → Fidelity → Equivalence) and writes `status.json` as evidence. Docs: [SKILL.md](skill/?doc=skill) · [Processing standard](skill/?doc=standard).',
      zh: '**batterylake-processing** 是一个给编码 Agent（Claude Code 或 Codex）使用的 skill 指令包，负责把一个原始数据集转换成 BatteryLake v2.0.0 标准。\n\n安装：\n- 在 [Preprocessing 页面](#preprocessing) 下载 `batterylake-processing.zip`。\n- Claude Code：`unzip batterylake-processing.zip -d .claude/skills/`，然后用 `/batterylake-processing` 调用。\n- Codex：`unzip batterylake-processing.zip -d .agents/skills/`，在请求中提到 skill 名称即可。\n\n运行：在你的 BatteryLake 仓库（包含 `Raw_Dataset` 和 `Processed_Dataset_Standard` 的目录）打开 Agent，在 Preprocessing 页面选择数据集，复制生成的提示词发给 Agent。skill 会依次通过五个 gate（Inventory → Semantics → Conversion → Fidelity → Equivalence），并把证据写入 `status.json`。文档：[SKILL.md](skill/?doc=skill) · [处理规范](skill/?doc=standard)。'
    },
    {
      id: 'gates',
      keys: ['five gates', '5 gates', 'gates', 'acceptance gate', 'how it works', 'inventory', 'semantics', 'fidelity', 'equivalence', 'workflow stages', 'processing stages', 'stages', '五个gate', '五个阶段', '五个关卡', '处理阶段', '验收', '等价性', '保真', '语义', '清单', '工作流程'],
      en: 'The processing skill passes each dataset through **five gates**, each with explicit evidence:\n- **I · Inventory** — every archive member, workbook and object is listed with size and SHA-256; nothing is inferred from file names.\n- **S · Semantics** — field mapping, physical cell identity, units, clocks, cycle boundaries and label basis are decided from READMEs, protocols and author code.\n- **C · Conversion** — a re-runnable adapter writes *all* source measurements into the canonical layer; no resampling, cleaning or truncation in the fidelity layer.\n- **V · Fidelity** — record-by-record comparison of raw vs standard values, coverage, keys and ordering.\n- **E · Equivalence** — an independent raw loader and the standard loader must produce the same X/y/mask/splits and the same model results before a task view is called benchmark-verified.\n\nSee the illustrated cards on the [Preprocessing page](#preprocessing).',
      zh: '处理 skill 让每个数据集依次通过 **五个 gate**，每个都要有明确证据：\n- **I · Inventory 清单** — 列出全部归档成员、工作簿和对象（大小 + SHA-256），不靠文件名猜测。\n- **S · Semantics 语义** — 依据 README、协议和作者代码确定字段映射、物理电芯身份、单位、时钟、循环边界和标签依据。\n- **C · Conversion 转换** — 可重跑的 adapter 把 *全部* 源测量写入 canonical 层；保真层不做重采样、清洗或截断。\n- **V · Fidelity 保真** — 逐记录对照原始与标准数值、覆盖率、主外键和顺序。\n- **E · Equivalence 等价性** — 独立的 raw loader 与 standard loader 必须得到相同的 X/y/mask/split 和相同的模型结果，任务视图才算 benchmark-verified。\n\n见 [Preprocessing 页面](#preprocessing) 的图解卡片。'
    },
    {
      id: 'status',
      keys: ['status.json', 'status file', 'canonical_validated', 'benchmark_verified', 'inventoried', 'converted', 'verify', 'verification', 'validate', 'check my dataset', 'is my dataset done', 'stage', 'upstream_completeness', 'benchmark_validation', 'canonical_validation', '状态文件', '验证', '校验', '怎么验证', '如何验证', '检查我的数据集', '是否完成', '处理完成了吗'],
      en: '`status.json` in each processed dataset records the current stage; completion is never inferred from files merely existing. Stage fields:\n- `inventoried` — the read-only inventory (source_inventory.csv, archive_members.csv) is complete.\n- `converted` — the adapter has written the canonical layer and manifest.json.\n- `canonical_validated` — coverage / fidelity checks passed record by record.\n- `benchmark_verified` — raw-vs-standard task equivalence was demonstrated for the applicable profiles.\nDimensions such as `conversion`, `canonical_validation`, `benchmark_validation` and `upstream_completeness` carry the detail, with `pending`, `partial` or `not_applicable` values when work remains.\n\nDrop your own `status.json` (or the whole dataset folder) into the **Verify** box on the [Preprocessing page](#preprocessing) to see the stage track and dimensions rendered.',
      zh: '每个处理后数据集的 `status.json` 记录当前阶段，不会因为文件存在就当作完成。阶段字段：\n- `inventoried` — 只读清单（source_inventory.csv、archive_members.csv）已完成。\n- `converted` — adapter 已写出 canonical 层和 manifest.json。\n- `canonical_validated` — 覆盖率 / 保真检查逐记录通过。\n- `benchmark_verified` — 对适用 profile 完成了 raw 与 standard 的任务等价性验证。\n`conversion`、`canonical_validation`、`benchmark_validation`、`upstream_completeness` 等维度记录细节，未完成时取值 `pending`、`partial` 或 `not_applicable`。\n\n把你的 `status.json`（或整个数据集文件夹）拖到 [Preprocessing 页面](#preprocessing) 的 **Verify** 区域，即可看到阶段进度和各维度的可视化。'
    },
    {
      id: 'naming',
      keys: ['ref_name', 'reference name', 'naming', 'naming standard', 'naming convention', 'name format', 'what does the name mean', '命名', '命名规范', '命名标准', '标准名', '名字的含义', '名称格式'],
      en: 'Each dataset gets a machine-readable **ref_name** with seven underscore-separated fields: `Year_Source_Chemistry_FormFactor_ChargeRate_DischargeRate_Temperature`.\nExample: `2007_NASA_PCoE_LCO_18650_1C_1C_25T` = published 2007, NASA PCoE lab, LCO chemistry, 18650 cells, 1C charge, 1C discharge, 25 °C. Multi-valued fields use `MultiC` / `MultiT`.\n\nTry the interactive sequencer on the [Naming Standard page](#naming).',
      zh: '每个数据集都有一个机器可读的 **ref_name**，由七个下划线分隔的字段组成：`年份_来源_化学体系_形态_充电倍率_放电倍率_温度`。\n例如 `2007_NASA_PCoE_LCO_18650_1C_1C_25T` = 2007 年发布、NASA PCoE 实验室、LCO 体系、18650 电芯、1C 充电、1C 放电、25 °C。多取值字段写作 `MultiC` / `MultiT`。\n\n可以在 [命名规范页面](#naming) 里试试交互式的字段演示。'
    },
    {
      id: 'benchmarks',
      keys: ['benchmark', 'benchmarks', 'soh estimation', 'rul prediction', 'run an experiment', 'training package', 'train a model', 'split', 'train/val/test', 'evaluate', 'evaluation', 'compare models', 'leaderboard', 'results', '基准', '基准测试', '怎么跑实验', '如何做实验', '训练', '划分', '训练包', '评估', '模型对比', '结果'],
      en: 'The [Benchmarks page](#benchmarks) walks through six steps: **Select task** (SOH estimation or RUL prediction) → **Select data** (filter curated datasets) → **Split data** (train/val/test by cell, manual or ratio) → **Select models** → **Local run** → **View results**.\n\nIt generates a reproducible training package (`bt_benchmark_<task>_<model>.zip`): copy the processed dataset into `data/`, `pip install -r requirements.txt`, `bash run_benchmark.sh`, then upload the `outputs/` folder back on the same page to see metrics, per-cell trajectories and model comparisons.',
      zh: '[Benchmarks 页面](#benchmarks) 分六步：**选择任务**（SOH 估计或 RUL 预测）→ **选择数据**（筛选数据集）→ **划分数据**（按电芯划分训练/验证/测试，手动或按比例）→ **选择模型** → **本地运行** → **查看结果**。\n\n它会生成可复现的训练包（`bt_benchmark_<task>_<model>.zip`）：把处理后的数据集拷到 `data/`，`pip install -r requirements.txt`，`bash run_benchmark.sh`，再把 `outputs/` 文件夹上传回同一页面，即可查看指标、逐电芯预测轨迹和模型对比。'
    },
    {
      id: 'models',
      keys: ['model library', 'models page', 'which models', 'what models', 'available models', 'pytorch', 'xgboost', 'scikit', 'lstm', 'cnn', 'transformer', 'gru', 'physics-informed', 'pinn', 'download model', 'reference implementation', '模型库', '有哪些模型', '什么模型', '模型下载', '参考实现'],
      en: 'The [Model library](#models) offers reference implementations for **SOH** and **RUL** tasks in PyTorch, scikit-learn and XGBoost: recurrent networks (LSTM/GRU), CNNs, attention models, gradient boosting, ensembles, physics-informed networks and statistical baselines. Each entry lists inputs, assumptions, status (available / experimental / recommended / requires GPU) and a downloadable package. Models can also be selected in step 4 of the [Benchmarks](#benchmarks) flow.',
      zh: '[模型库](#models) 提供 **SOH** 与 **RUL** 任务的参考实现，覆盖 PyTorch、scikit-learn 和 XGBoost：循环网络（LSTM/GRU）、CNN、注意力模型、梯度提升、集成模型、物理信息神经网络（PINN）和统计基线。每个条目列出输入要求、假设、状态（available / experimental / recommended / requires GPU）和可下载的代码包。也可以在 [Benchmarks](#benchmarks) 第 4 步直接选择模型。'
    },
    {
      id: 'quality',
      keys: ['quality', 'quality assessment', 'quality report', 'quality score', 'completeness', 'consistency', 'accuracy', 'validity', 'physical plausibility', 'plausibility', 'assess', 'assessment', '质量', '质量评估', '质量报告', '质量分数', '完整性', '一致性', '准确性', '有效性', '物理合理性'],
      en: 'Every dataset is scored on four dimensions on the [Quality page](#quality): **Completeness** (missing channels), **Consistency** (sequence issues), **Accuracy** (physical-plausibility checks such as voltage/current/temperature ranges) and **Validity** (schema errors), combined into an overall score with a Ready / warning status.\n\nYou can upload your own processed dataset or a quality JSON there; the assessment runs in the browser (`js/quality-engine.js`) or on the local backend, and produces a machine-readable diagnostic report.',
      zh: '[Quality 页面](#quality) 对每个数据集从四个维度打分：**完整性**（缺失通道）、**一致性**（序列问题）、**准确性**（电压/电流/温度范围等物理合理性检查）和 **有效性**（schema 错误），汇总成总分和 Ready / warning 状态。\n\n你可以在那里上传自己的处理后数据集或质量 JSON；评估在浏览器里运行（`js/quality-engine.js`）或由本地后端执行，并输出机器可读的诊断报告。'
    },
    {
      id: 'apis',
      keys: ['api', 'apis', 'endpoint', 'endpoints', 'rest', 'programmatic', 'developer console', '/v1/datasets', 'token', 'sdk', '接口', '开发者', '编程访问', '程序化'],
      en: 'The [APIs & Applications page](#apis) is a developer console for the platform routes: `GET /v1/datasets` (catalog with chemistry / format / quality filters), `GET` cell time-series streaming, `POST` benchmark run, and `POST` feature recipe. Pick a route, inspect its parameters, preview the request and run a simulated call to see the exact response shape. The routes are shown as the platform surface; live hosted access uses token authentication.',
      zh: '[APIs & Applications 页面](#apis) 是平台路由的开发者控制台：`GET /v1/datasets`（按化学体系 / 格式 / 质量筛选目录）、`GET` 电芯时序流、`POST` 创建 benchmark 运行、`POST` 提交特征配方。选择路由、查看参数、预览请求并运行模拟调用即可看到返回结构。线上访问使用 token 认证。'
    },
    {
      id: 'contribute',
      keys: ['contribute', 'contribution', 'submit a dataset', 'submit my dataset', 'share my data', 'upload my dataset', 'add a dataset', 'intake', 'required files', 'submission', '贡献', '提交数据集', '上传我的数据', '分享数据', '添加数据集', '需要哪些文件', '投稿'],
      en: 'Use the [Contribute page](#contribute); three steps, all in your browser:\n- **Describe** — the catalog metadata (name, lab, year, chemistry, form factor, cells, capacity, C-rates, temperature, DOI, license) plus what the processing skill needs: the test protocol, the file layout and cell identifiers, known issues. The reference name and `metadata.json` are generated live.\n- **Raw data** — host the original cycler exports on Zenodo, Figshare or an institutional share link and paste the link. Optionally drop a small CSV excerpt for a local quick check of the channels, or a status.json if you already ran the skill.\n- **Submit** — a GitHub issue opens prefilled with the summary, checklist and link; press "Submit new issue".\n\nThe team then runs the batterylake-processing skill (five gates) on your files and publishes the dataset with your DOI and license. In Agent mode you can say, for example, "I want to contribute 24 NMC 21700 cells from NTU, 2025, 1C/1C at 25 °C, data at https://…" and the form is filled for you.',
      zh: '请使用 [Contribute 页面](#contribute)，三步都在浏览器里完成：\n- **Describe 描述** — 目录元数据（名称、机构、年份、化学体系、形态、电芯数、容量、倍率、温度、DOI、许可）加上处理 skill 需要的说明：测试协议、文件布局与电芯命名、已知问题。标准名和 `metadata.json` 实时生成。\n- **Raw data 原始数据** — 把原始测试仪导出文件放到 Zenodo、Figshare 或机构共享链接，粘贴链接。可选：拖一小段 CSV 做本地通道快检，或提供已跑过 skill 的 status.json。\n- **Submit 提交** — 自动打开预填好摘要、清单和链接的 GitHub issue，点 "Submit new issue" 即可。\n\n之后团队用 batterylake-processing skill（五个 gate）处理你的文件，并以你的 DOI 和许可发布。在 Agent 模式下可以直接说“我想贡献一个数据集：24 颗 NMC 21700 电芯，来自 NTU，2025 年，1C/1C，25 度，数据在 https://…”，表单会自动填好。'
    },
    {
      id: 'cite',
      keys: ['cite', 'citation', 'bibtex', 'reference the paper', 'paper', 'arxiv', 'publication', 'license', 'licence', 'terms', 'terms of use', 'can i use', 'commercial use', '引用', '怎么引用', '如何引用', '论文', '许可', '许可证', '使用条款', '能否商用', '可以用吗'],
      en: 'Please cite the BatteryLake paper when you use the platform, its curated datasets, standardized outputs or tools:\n\n**BatteryLake: Agentic, Physics-Grounded Curation of Heterogeneous Battery Aging Data and Benchmarking** — Tianwen Zhu, Hao Wang, Yonggang Wen, 2026. [arXiv:2607.09762](' + ARXIV + ')\n\nLicensing: every dataset keeps the license and citation requirements of its original authors; BatteryLake grants no additional rights. Check each dataset\'s source page before redistributing or modifying it, and cite the underlying datasets too. The BibTeX entry is on the [Terms & Citation page](#terms).',
      zh: '使用平台、其精选数据集、标准化产物或工具时，请引用 BatteryLake 论文：\n\n**BatteryLake: Agentic, Physics-Grounded Curation of Heterogeneous Battery Aging Data and Benchmarking** — Tianwen Zhu, Hao Wang, Yonggang Wen, 2026. [arXiv:2607.09762](' + ARXIV + ')\n\n许可：每个数据集保留原作者的许可与引用要求，BatteryLake 不额外授予权利；再分发或修改前请查看该数据集的来源页面，并同时引用原始数据集。BibTeX 见 [Terms & Citation 页面](#terms)。'
    },
    {
      id: 'team',
      keys: ['who made', 'who built', 'who maintains', 'team', 'authors', 'contact', 'affiliation', 'ntu', 'nanyang', 'university', 'yonggang wen', 'wang hao', 'hao wang', 'tianwen', 'zhu tianwen', 'cai yezi', '谁做的', '谁开发', '团队', '作者', '联系', '联系方式', '南洋理工', '哪个学校', '哪个机构'],
      en: 'BatteryLake is developed at **Nanyang Technological University, Singapore**:\n- Prof. **Yonggang Wen** — Principal Investigator\n- Dr **Hao Wang** — Research Fellow\n- **Tianwen Zhu** — PhD candidate, core researcher\n- **Yezi Cai** — frontend engineer\n\nCode: [website repository](' + REPO_SITE + ') and [BatteryLake-Benchmark-DataPrep](' + REPO_PREP + '). More on the [About page](#about).',
      zh: 'BatteryLake 由 **新加坡南洋理工大学（NTU）** 团队开发：\n- **Yonggang Wen 教授** — 项目负责人\n- **Wang Hao 博士** — Research Fellow\n- **Zhu Tianwen** — 博士生，核心研究者\n- **Cai Yezi** — 前端工程师\n\n代码：[网站仓库](' + REPO_SITE + ') 与 [BatteryLake-Benchmark-DataPrep](' + REPO_PREP + ')。更多见 [About 页面](#about)。'
    },
    {
      id: 'github',
      keys: ['github', 'repository', 'repo', 'source code', 'open source', 'clone', '仓库', '源码', '开源', '代码在哪'],
      en: 'Code lives on GitHub:\n- [tianwen1209/batterylake](' + REPO_SITE + ') — this website (static site, `js/main.js` holds the dataset catalog).\n- [tianwen1209/BatteryLake-Benchmark-DataPrep](' + REPO_PREP + ') — data preparation and evaluation framework (`evaluate.py`, `dataset_interface.py`, `dataset_registry.csv`).\n\nSee [Documentation](#docs) for the getting-started commands.',
      zh: '代码在 GitHub：\n- [tianwen1209/batterylake](' + REPO_SITE + ') — 本网站（静态站点，`js/main.js` 保存数据集目录）。\n- [tianwen1209/BatteryLake-Benchmark-DataPrep](' + REPO_PREP + ') — 数据准备与评估框架（`evaluate.py`、`dataset_interface.py`、`dataset_registry.csv`）。\n\n入门命令见 [Documentation](#docs)。'
    },
    {
      id: 'soh_rul',
      keys: ['what is soh', 'what is rul', 'soh vs rul', 'difference between soh', 'state of health', 'remaining useful life', 'define soh', 'define rul', 'soh是什么', 'rul是什么', '什么是soh', '什么是rul', '健康状态', '剩余寿命', '区别'],
      en: '- **SOH (state of health)** — the present condition of a cell relative to its fresh state, usually the ratio of current discharge capacity (or resistance) to the nominal/initial value. SOH estimation asks "how degraded is this cell now?".\n- **RUL (remaining useful life)** — how many cycles (or how much time) remain before the cell reaches its end-of-life threshold (commonly 80 % of nominal capacity, though BatteryLake keeps each author\'s own EOL definition). RUL prediction asks "how long until retirement?".\n\nBatteryLake keeps author labels and derived labels separate and warns that filtered row differences are not a real life axis, so both tasks are defined per dataset in `views/<profile>/profile.json`.',
      zh: '- **SOH（健康状态）** — 电芯当前状态相对于全新状态的比例，通常是当前放电容量（或内阻）与标称/初始值之比。SOH 估计回答“这颗电芯现在衰退了多少”。\n- **RUL（剩余使用寿命）** — 电芯到达寿命终止阈值前还剩多少循环（或时间）。常用 80 % 标称容量作为 EOL，但 BatteryLake 会保留各作者自己的定义。RUL 预测回答“还能用多久”。\n\nBatteryLake 把作者标签与派生标签分开，并强调过滤后的行号差不是真实寿命轴，因此两个任务在每个数据集的 `views/<profile>/profile.json` 里单独定义。'
    },
    {
      id: 'tasks',
      keys: ['tasks page', 'curation progress', 'progress tracker', 'etl status', 'which datasets are done', 'processing status', 'how many are processed', 'pending datasets', '进度', '处理进度', '哪些处理完了', '处理状态', '完成了多少'],
      en: function () {
        var items = catalog(); var c = { done: 0, wip: 0, pending: 0 };
        items.forEach(function (d) { c[d.status] = (c[d.status] || 0) + 1; });
        return 'Processing status across the ' + items.length + ' catalog datasets: **' + c.done + ' processed**, **' + c.wip + ' in progress**, **' + c.pending + ' pending**. The [Tasks page](#tasks) tracks the ETL stages (metadata, time series, cycle summary, QC) per dataset, and each card in the [Datasets catalog](#datasets) shows its status badge.';
      },
      zh: function () {
        var items = catalog(); var c = { done: 0, wip: 0, pending: 0 };
        items.forEach(function (d) { c[d.status] = (c[d.status] || 0) + 1; });
        return '目录中 ' + items.length + ' 个数据集的处理状态：**已处理 ' + c.done + ' 个**、**处理中 ' + c.wip + ' 个**、**待处理 ' + c.pending + ' 个**。[Tasks 页面](#tasks) 按数据集跟踪 ETL 各阶段（元数据、时序、循环汇总、QC），[数据集目录](#datasets) 的每张卡片也带状态标签。';
      }
    },
    {
      id: 'assistant',
      keys: ['are you an ai', 'which model', 'what model', 'are you chatgpt', 'are you gpt', 'who are you', 'what are you', 'how do you work', 'you are a bot', '你是谁', '你是什么', '你是ai吗', '什么模型', '你用的什么模型', '你怎么工作'],
      en: 'I am the BatteryLake assistant. I answer from a built-in knowledge base that reads the live dataset catalog on this page, and when a free language model is configured (see `js/ai-config.js`) I pass your question plus that context to it for more open-ended answers. Nothing you type is stored on a server by this site; the chat history stays in your browser.',
      zh: '我是 BatteryLake 助手。我的回答来自内置知识库（它会实时读取本页面的数据集目录）；如果配置了免费的语言模型（见 `js/ai-config.js`），我会把你的问题和这些站内信息一起交给模型来回答更开放的问题。本站不会把你输入的内容存到服务器，聊天记录只保存在你的浏览器里。'
    },
    {
      id: 'help',
      keys: ['help', 'what can you do', 'what can i ask', 'capabilities', 'menu', 'options', '你能做什么', '你会什么', '能问什么', '帮助', '功能'],
      en: 'I can help with:\n- **Catalog numbers** — "how many datasets / cells / cycles?"\n- **A specific dataset** — "tell me about the Oxford dataset" or "dataset_35"\n- **Look-ups** — "which datasets are LFP?", "pouch cell datasets", "calendar aging datasets"\n- **Processing** — the skill, install steps, the five gates, status.json fields, output layout\n- **Platform** — benchmarks, models, quality, APIs, naming standard, contributing, citation, team\n\nAsk in English or Chinese.',
      zh: '我可以回答：\n- **目录数字** — “有多少个数据集 / 电芯 / 循环？”\n- **具体数据集** — “介绍一下 Oxford 数据集”或“dataset_35”\n- **查找** — “有哪些 LFP 数据集”“软包电芯数据集”“日历老化数据集”\n- **处理流程** — skill、安装步骤、五个 gate、status.json 字段、输出结构\n- **平台功能** — benchmarks、模型库、质量评估、API、命名规范、贡献数据、引用、团队\n\n中英文都可以。'
    },
    {
      id: 'greeting',
      keys: ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening', '你好', '您好', '嗨', '哈喽', '早上好', '下午好', '晚上好', '在吗'],
      exact: true,
      en: 'Hello! Ask me about BatteryLake datasets, the processing skill, status.json, benchmarks or citation. Try "how many datasets are there?" or "which datasets are LFP?".',
      zh: '你好！可以问我 BatteryLake 的数据集、处理 skill、status.json、benchmarks 或引用方式。例如“有多少个数据集？”或“有哪些 LFP 数据集？”。'
    },
    {
      id: 'thanks',
      keys: ['thanks', 'thank you', 'thx', 'great', 'awesome', 'nice', '谢谢', '感谢', '多谢', '好的', '不错', '很好'],
      exact: true,
      en: 'You are welcome! Anything else about BatteryLake?',
      zh: '不客气！还有关于 BatteryLake 的其他问题吗？'
    }
  ];

  function scoreFaq(entry, q, qTokens) {
    var score = 0;
    var qClean = q.replace(/[^\w㐀-鿿 ]/g, '').trim();
    for (var i = 0; i < entry.keys.length; i++) {
      var key = norm(entry.keys[i]);
      if (entry.exact) {
        if (qClean === key || qClean === key + ' there') score += 10;
        continue;
      }
      if (q.indexOf(key) >= 0) {
        var words = key.split(' ').length;
        score += CJK.test(key) ? 2 + key.length * 0.6 : 2 + words * 1.5;
      }
    }
    if (!entry.exact) {
      var keyTokens = {};
      entry.keys.forEach(function (k) { latinTokens(k).forEach(function (t) { if (!STOP[t]) keyTokens[t] = 1; }); });
      qTokens.forEach(function (t) { if (!STOP[t] && keyTokens[t]) score += 0.75; });
    }
    return score;
  }

  function bestFaq(query) {
    var q = norm(query);
    var qTokens = latinTokens(q);
    var best = null;
    FAQ.forEach(function (entry) {
      var s = scoreFaq(entry, q, qTokens);
      if (s > 0 && (!best || s > best.score)) best = { entry: entry, score: s };
    });
    return best;
  }
  function faqText(entry, zh) {
    var v = zh ? entry.zh : entry.en;
    return typeof v === 'function' ? v() : v;
  }
  function faqById(id) { return FAQ.filter(function (e) { return e.id === id; })[0]; }

  /* ── main entry ──────────────────────────────────────────────────── */
  function answer(query) {
    var zh = isZh(query);
    var q = norm(query);
    var faq = bestFaq(query);
    var found = findDatasets(query);
    var filtered = filterDatasets(query);
    var wantsList = /which|list|show|all|有哪些|哪些|列出|所有|有什么|多少个|how many/.test(q);
    // Generic topics ("introduce", "download", "help") must not outrank a named dataset.
    var genericFaq = faq && /^(intro|help|download|chemistries|assistant)$/.test(faq.entry.id);

    if (found && found.mode === 'card' && (found.score >= 6 || genericFaq) && !(faq && faq.entry.exact)) {
      return { text: datasetCard(found.items[0], zh), source: 'dataset' };
    }
    if (found && found.mode === 'list' && genericFaq && !filtered) {
      return { text: datasetList(found.items, zh ? '匹配的数据集：' : 'Matching datasets:', zh), source: 'dataset' };
    }
    if (filtered && filtered.items.length && (wantsList || !faq || faq.score < 4)) {
      var parts = [];
      if (filtered.chem) parts.push(filtered.chem);
      if (filtered.form) parts.push(filtered.form);
      if (filtered.cat) parts.push((zh ? CATEGORY_LABELS_ZH : CATEGORY_LABELS)[filtered.cat]);
      var title = zh
        ? '目录中有 **' + filtered.items.length + '** 个 ' + parts.join(' · ') + ' 数据集：'
        : '**' + filtered.items.length + '** ' + parts.join(' · ') + ' dataset' + (filtered.items.length === 1 ? '' : 's') + ' in the catalog:';
      return { text: datasetList(filtered.items, title, zh), source: 'dataset' };
    }
    if (filtered && !filtered.items.length && (!faq || faq.score < 4)) {
      return { text: zh ? '目录里目前没有匹配这个条件的数据集。可以在 [数据集目录](#datasets) 里放宽筛选。' : 'No catalog dataset matches that filter right now. Try relaxing the filter in the [Datasets catalog](#datasets).', source: 'dataset' };
    }
    if (found && (!faq || faq.score < found.score)) {
      if (found.mode === 'card') return { text: datasetCard(found.items[0], zh), source: 'dataset' };
      return { text: datasetList(found.items, zh ? '匹配的数据集：' : 'Matching datasets:', zh), source: 'dataset' };
    }
    if (faq && faq.score >= 2) {
      return { text: faqText(faq.entry, zh), source: 'kb', topic: faq.entry.id };
    }
    if (found) {
      if (found.mode === 'card') return { text: datasetCard(found.items[0], zh), source: 'dataset' };
      return { text: datasetList(found.items, zh ? '匹配的数据集：' : 'Matching datasets:', zh), source: 'dataset' };
    }
    return { text: faqText(faqById('help'), zh), source: 'fallback' };
  }

  /* Grounding context for the optional remote model. */
  function context(query, previousQuery) {
    var m = metrics();
    var lines = [
      'BatteryLake (' + SITE + ') — open data foundation for battery prognostics; curated lithium-ion aging datasets standardized to the BatteryLake v2.0.0 schema for SOH/RUL benchmarking. Built at Nanyang Technological University (PI Prof. Yonggang Wen; Dr Hao Wang; Tianwen Zhu; Yezi Cai).',
      'Catalog now: ' + m.datasets + ' datasets, ' + m.labs + ' institutions, ' + m.yearMin + '-' + m.yearMax + ', ' + fmtInt(m.cells) + ' cells, ' + fmtCycles(m.cycles) + ' cycles, ' + Math.round(m.volumeGB) + ' GB source data. Chemistries: ' + chemList().join(', ') + '. Form factors: ' + formList().join(', ') + '.',
      'Pages: #datasets (catalog, source + processed downloads), #preprocessing (batterylake-processing agent skill, five gates I/S/C/V/E, status.json verify), #quality, #benchmarks (6-step SOH/RUL flow), #models, #apis, #naming, #docs, #contribute, #terms (citation arXiv:2607.09762), #about.'
    ];
    var faq = bestFaq(query);
    if (faq && faq.score >= 2 && !faq.entry.exact) lines.push('Relevant note: ' + faqText(faq.entry, false).replace(/\s+/g, ' '));
    var found = findDatasets(query);
    var filtered = filterDatasets(query);
    var picks = (found && found.items) || (filtered && filtered.items) || [];
    if (!picks.length && previousQuery) {
      // Follow-up questions ("how many cells does it have?") inherit the datasets of the previous turn.
      var prevFound = findDatasets(previousQuery);
      var prevFiltered = filterDatasets(previousQuery);
      picks = (prevFound && prevFound.items) || (prevFiltered && prevFiltered.items) || [];
      if (picks.length) lines.push('The previous user question referred to these datasets:');
    }
    picks.slice(0, 5).forEach(function (d) {
      lines.push('Dataset ' + d.id + ' "' + d.name + '": ref_name=' + d.ref_name + '; chemistry=' + d.chemistry + '; form=' + d.form + '; cells=' + (String(d.cells || '').trim() || 'n/a') + '; cycles=' + (Number(d.cycles) ? fmtInt(d.cycles) : 'n/a') + '; source_volume=' + fmtGB(d.size_mb) + '; category=' + (CATEGORY_LABELS[d.category] || d.category) + '; status=' + (STATUS_LABELS[d.status] || d.status) + (d.notes ? '; notes=' + d.notes : ''));
    });
    if (filtered && filtered.items.length > 5) lines.push('(' + filtered.items.length + ' datasets match the filter in total.)');
    return lines.join('\n');
  }

  window.BatteryLakeKnowledge = { answer: answer, context: context, isChinese: isZh, metrics: metrics, find: findDatasets, filter: filterDatasets, catalog: catalog, categoryLabel: function (key, zh) { return (zh ? CATEGORY_LABELS_ZH : CATEGORY_LABELS)[key] || key; } };
})();
