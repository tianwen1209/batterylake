/* Legacy preprocessing JavaScript extracted from js/main.js on 2026-09-08 (git tag preprocessing-20260908). */

/* AI-assisted preprocessing prototype */
function prepToast(message) {
  const toast = document.getElementById('prepToast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(prepToast.timer);
  prepToast.timer = window.setTimeout(() => toast.classList.remove('show'), 2600);
}

let currentInspectionManifest = null;
let prepStage = 1;
let prepDroppedFiles = null;
let currentMetadataExtraction = null;
let metadataSourceExtraction = null;
let metadataPaperExtraction = null;
let metadataFinalConfirmed = false;
const METADATA_MISSING_VALUE = 'Source page not stated';
const prepAIFields = [
  { key: 'data_format', label: 'Data format', aliases: ['Data format', 'Format', 'Source format'] },
  { key: 'year', label: 'Year', aliases: ['Year'] },
  { key: 'source_lab', label: 'Source / lab', aliases: ['Source / lab', 'Source', 'Lab'] },
  { key: 'chemistry', label: 'Chemistry', aliases: ['Chemistry'] },
  { key: 'form_factor', label: 'Form factor', aliases: ['Form factor', 'Cell format'] },
  { key: 'c_rate', label: 'C-rate', aliases: ['C-rate', 'Charge C-rate', 'Discharge C-rate'] },
  { key: 'temperature', label: 'Temperature', aliases: ['Temperature'] },
  { key: 'cell_count', label: 'Cell count', aliases: ['Cell count', 'Cells'] },
  { key: 'license', label: 'License', aliases: ['License'] }
];
const BATTERYLAKE_METADATA_FIELDS = [
  'chemistry',
  'cathode_material',
  'anode_material',
  'nominal_capacity_Ah',
  'nominal_voltage_V',
  'temperature_C',
  'charge_protocol',
  'discharge_protocol',
  'C_rate',
  'cutoff_voltage_upper',
  'cutoff_voltage_lower',
  'brand_or_manufacturer',
  'form_factor',
  'source_url',
  'paper_url',
  'license'
];
let prepAIState = prepAIFields.map(field => ({
  ...field,
  value: '',
  evidence: 'No inspection yet',
  confidence: 0,
  confirmed: false,
  pending: true
}));

function showPrepStage(stage) {
  prepStage = Math.max(1, Math.min(4, Number(stage) || 1));
  document.querySelectorAll('[data-prep-stage]').forEach(panel => {
    panel.classList.toggle('active', Number(panel.dataset.prepStage) === prepStage);
  });
  document.querySelectorAll('[data-stage-nav]').forEach(item => {
    const itemStage = Number(item.dataset.stageNav);
    item.classList.toggle('active', itemStage === prepStage);
    item.classList.toggle('done', itemStage < prepStage);
    const number = item.querySelector('.prep-step-num');
    if (number) number.textContent = itemStage < prepStage ? '✓' : String(itemStage);
  });
  const previous = document.getElementById('prepPrevious');
  const next = document.getElementById('prepNext');
  if (previous) previous.disabled = prepStage === 1;
  if (next) {
    next.disabled = prepStage === 4;
    next.textContent = prepStage === 4 ? 'Complete' : 'Next';
  }
}

function setPrepBusy(busy) {
  const progress = document.getElementById('inspectProgress');
  const bar = progress && progress.querySelector('span');
  if (!progress || !bar) return;
  progress.classList.toggle('show', busy);
  bar.style.width = busy ? '72%' : '100%';
  if (!busy) window.setTimeout(() => { progress.classList.remove('show'); bar.style.width = '0'; }, 450);
}

function isMetadataMissing(row) {
  const value = String(row?.value || '').trim();
  return row?.status === 'missing' || !value || value === METADATA_MISSING_VALUE;
}

function metadataConfidence(row) {
  const n = Number(row?.confidence || 0);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0;
}

async function fetchMetadataExtraction(url, sourceType) {
  try {
    const response = await fetch('http://127.0.0.1:8000/api/metadata-extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, source_type: sourceType })
    });
    const text = await response.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch (_) { data = {}; }
    if (!response.ok) throw new Error(data.error || `Metadata backend unavailable (${response.status})`);
    data.source_type = sourceType;
    data.fields = (data.fields || []).map(row => ({ ...row, source_type: sourceType, confirmed: false }));
    return data;
  } catch (error) {
    const fallback = buildMetadataFallback(url, sourceType, error);
    return fallback;
  }
}

function buildMetadataFallback(url, sourceType, error) {
  const rows = BATTERYLAKE_METADATA_FIELDS.map(field => {
    let value = METADATA_MISSING_VALUE;
    let evidence = `${sourceType === 'paper' ? 'Paper' : 'Source page'} could not be fetched automatically. Leave blank or fill manually from the page or supplementary files.`;
    let confidence = 0;
    let status = 'missing';
    if (field === 'source_url' && sourceType === 'source') {
      value = url;
      evidence = 'User-provided dataset source URL.';
      confidence = 1;
      status = 'found';
    }
    if (field === 'paper_url' && sourceType === 'paper') {
      value = url;
      evidence = 'User-provided paper URL / DOI.';
      confidence = 1;
      status = 'found';
    }
    return { field, value, evidence, confidence, status, source_type: sourceType, confirmed: false };
  });
  return {
    source_url: url,
    source_type: sourceType,
    status: 'frontend_fallback',
    message: 'Manual metadata review',
    fields: rows
  };
}

function resetMetadataConfirmation() {
  metadataFinalConfirmed = false;
  const checkbox = document.getElementById('metadataConfirmAll');
  if (checkbox) checkbox.checked = false;
  updateMetadataDownloadState();
}

async function runMetadataSourceCheck() {
  const url = document.getElementById('metadataSourceUrl')?.value.trim();
  if (!url) {
    prepToast('Paste a dataset source URL first.');
    return;
  }
  setPrepBusy(true);
  try {
    metadataSourceExtraction = await fetchMetadataExtraction(url, 'source');
    metadataPaperExtraction = null;
    currentMetadataExtraction = metadataSourceExtraction;
    resetMetadataConfirmation();
    renderMetadataResult(currentMetadataExtraction);
    const missing = summarizeMetadataMissing(currentMetadataExtraction);
    prepToast(missing.length ? `${missing.length} fields still need paper evidence.` : 'Source URL filled all tracked metadata fields.');
  } catch (error) {
    prepToast(error.message || 'Could not extract metadata.');
  } finally {
    setPrepBusy(false);
  }
}

function mergeMetadataExtractions(sourceData, paperData) {
  if (!sourceData) return paperData;
  if (!paperData) return sourceData;
  const paperByField = Object.fromEntries((paperData.fields || []).map(row => [row.field, row]));
  const fields = (sourceData.fields || []).map(sourceRow => {
    const paperRow = paperByField[sourceRow.field];
    if (!paperRow) return sourceRow;
    const sourceMissing = isMetadataMissing(sourceRow);
    const paperMissing = isMetadataMissing(paperRow);
    const paperBetter = !paperMissing && (sourceMissing || metadataConfidence(paperRow) > metadataConfidence(sourceRow));
    return paperBetter ? { ...paperRow, source_type: 'paper', confirmed: false } : sourceRow;
  });
  return {
    ...sourceData,
    paper_url: paperData.source_url,
    fields,
    status: 'source_plus_paper',
    message: 'Metadata merged from dataset source URL and paper URL.'
  };
}

async function runMetadataPaperCheck() {
  if (!metadataSourceExtraction?.fields?.length) {
    prepToast('Check the dataset source URL before adding a paper URL.');
    return;
  }
  const url = document.getElementById('metadataPaperUrl')?.value.trim();
  if (!url) {
    prepToast('Paste a paper URL or DOI first.');
    return;
  }
  setPrepBusy(true);
  try {
    metadataPaperExtraction = await fetchMetadataExtraction(url, 'paper');
    currentMetadataExtraction = mergeMetadataExtractions(metadataSourceExtraction, metadataPaperExtraction);
    resetMetadataConfirmation();
    renderMetadataResult(currentMetadataExtraction);
    const missing = summarizeMetadataMissing(currentMetadataExtraction);
    prepToast(missing.length ? `${missing.length} fields still need manual missing status.` : 'Paper evidence filled the tracked metadata fields.');
  } catch (error) {
    prepToast(error.message || 'Could not extract paper metadata.');
  } finally {
    setPrepBusy(false);
  }
}

async function runMetadataExtractionDraft() {
  await runMetadataSourceCheck();
}

function summarizeMetadataMissing(data) {
  const fields = (data?.fields || []).filter(isMetadataMissing).map(row => row.field);
  const box = document.getElementById('metadataMissingSummary');
  if (box) {
    if (!data?.fields?.length) {
      box.textContent = 'No metadata check has been run yet.';
      box.classList.remove('show');
    } else if (fields.length) {
      box.innerHTML = `<strong>${fields.length} fields need paper evidence or manual missing confirmation:</strong> ${esc(fields.join(', '))}`;
      box.classList.add('show');
    } else {
      box.innerHTML = '<strong>No missing tracked fields.</strong> Review the evidence and confirm the metadata before downloading.';
      box.classList.add('show');
    }
  }
  return fields;
}

function updateMetadataDownloadState() {
  const button = document.getElementById('metadataDownloadBtn');
  const fields = currentMetadataExtraction?.fields || [];
  const confirmedRows = fields.filter(row => row.confirmed);
  if (button) button.disabled = !(metadataFinalConfirmed && confirmedRows.length);
}

function toggleMetadataFinalConfirmation() {
  metadataFinalConfirmed = Boolean(document.getElementById('metadataConfirmAll')?.checked);
  updateMetadataDownloadState();
}

function toggleMetadataRow(fieldName, checked) {
  const row = (currentMetadataExtraction?.fields || []).find(item => item.field === fieldName);
  if (row) row.confirmed = Boolean(checked);
  updateMetadataDownloadState();
}

function updateMetadataValue(fieldName, value) {
  const row = (currentMetadataExtraction?.fields || []).find(item => item.field === fieldName);
  if (!row) return;
  row.value = value;
  row.status = value && value !== METADATA_MISSING_VALUE ? 'found' : 'missing';
  resetMetadataConfirmation();
  renderMetadataResult(currentMetadataExtraction);
}

function renderMetadataResult(data) {
  const panel = document.getElementById('metadataResultPanel');
  const body = document.getElementById('metadataResultBody');
  const confirmBox = document.getElementById('metadataConfirmBox');
  const subtitle = document.getElementById('metadataResultSubtitle');
  if (!panel || !body) return;
  const rows = data.fields || [];
  body.innerHTML = rows.map(row => {
    const missing = isMetadataMissing(row);
    const confidence = metadataConfidence(row);
    const sourceType = row.source_type || data.source_type || 'source';
    const field = esc(row.field || '');
    return `<tr>
      <td><input type="checkbox" ${row.confirmed ? 'checked' : ''} onchange="toggleMetadataRow('${field}', this.checked)" aria-label="Confirm ${field}"></td>
      <td>${field}</td>
      <td class="${missing ? 'missing' : ''}"><input class="metadata-value-input" value="${esc(row.value || '')}" onchange="updateMetadataValue('${field}', this.value)"></td>
      <td>${esc(row.evidence || '')}</td>
      <td><span class="metadata-source-badge">${esc(sourceType)}</span></td>
      <td>${Math.round(confidence * 100)}%</td>
    </tr>`;
  }).join('');
  panel.classList.add('show');
  confirmBox?.classList.add('show');
  const missing = summarizeMetadataMissing(data);
  if (subtitle) {
    subtitle.textContent = missing.length
      ? 'Use a paper URL for missing fields, or confirm that they are not stated.'
      : 'Review each value and confirm the rows before downloading.';
  }
  updateMetadataDownloadState();
}

function downloadMetadataCsv() {
  if (!currentMetadataExtraction?.fields?.length) {
    prepToast('Generate a metadata draft first.');
    return;
  }
  const rows = currentMetadataExtraction.fields.filter(row => row.confirmed);
  if (!rows.length || !metadataFinalConfirmed) {
    prepToast('Confirm metadata rows and check the final review box before downloading.');
    return;
  }
  const header = ['field', 'value', 'evidence', 'confidence', 'status', 'source_type'];
  const lines = [header.join(',')].concat(rows.map(row =>
    header.map(key => `"${String(row[key] ?? '').replace(/"/g, '""')}"`).join(',')
  ));
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'dataset_metadata.csv';
  link.click();
  URL.revokeObjectURL(link.href);
  prepToast('Confirmed metadata CSV downloaded.');
}

function normalizePrepFieldName(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function findPrepAIField(sourceField) {
  const normalized = normalizePrepFieldName(sourceField.name || sourceField.label);
  return prepAIFields.find(field =>
    field.aliases.some(alias => normalizePrepFieldName(alias) === normalized) ||
    normalized.includes(normalizePrepFieldName(field.label))
  );
}

function updatePrepAIStateFromInspection(data) {
  const sourceFields = Array.isArray(data?.fields) ? data.fields : [];
  prepAIState = prepAIFields.map(field => {
    const matched = sourceFields.find(item => findPrepAIField(item)?.key === field.key);
    if (!matched) {
      return {
        ...field,
        value: '',
        evidence: 'The AI did not find reliable source evidence for this field.',
        confidence: 0,
        confirmed: false,
        pending: true
      };
    }
    return {
      ...field,
      value: matched.pending ? '' : String(matched.value || ''),
      evidence: String(matched.evidence || 'Detected by AI inspection.'),
      confidence: Number(matched.confidence || 0),
      confirmed: false,
      pending: Boolean(matched.pending) || !matched.value
    };
  });
  renderAIFieldTable();
}

function prepConfirmedRefName() {
  const parts = prepAIState
    .filter(field => field.confirmed && ['year', 'source_lab', 'chemistry', 'form_factor', 'c_rate', 'temperature'].includes(field.key))
    .map(field => String(field.value || '').replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, ''))
    .filter(Boolean);
  return parts.length ? parts.join('_') : 'UNKNOWN_UNKNOWN_UNKNOWN_UNKNOWN';
}

function renderAIFieldTable() {
  const root = document.getElementById('aiFieldTable');
  if (!root) return;
  root.innerHTML = prepAIState.map(field => {
    const score = Math.max(0, Math.min(100, Math.round(Number(field.confidence || 0) * 100)));
    const confClass = score >= 85 ? 'high' : score >= 60 ? 'med' : score > 0 ? 'low' : 'none';
    const displayValue = field.value || 'Unknown';
    return `
      <div class="ai-field-row ${field.confirmed ? 'is-confirmed' : 'is-pending'}">
        <div class="ai-field-meta">
          <div class="ai-field-label">${esc(field.label)}</div>
          <span class="ai-status ${field.confirmed ? 'ok' : 'warn'}">${field.confirmed ? 'Confirmed' : 'Needs confirmation'}</span>
        </div>
        <div>
          <div class="ai-field-mini">Detected value</div>
          <div class="ai-field-value">${field.value ? esc(displayValue) : '<em>Unknown</em>'}</div>
        </div>
        <div>
          <div class="ai-field-mini">Source evidence</div>
          <div class="ai-field-ev">${esc(field.evidence || 'No inspection yet')}</div>
        </div>
        <div>
          <div class="ai-field-mini">Confidence</div>
          <div class="ai-conf ${confClass}"><span class="ai-conf-bar"><span style="width:${score}%"></span></span><span class="ai-conf-num">${score ? score + '%' : '-'}</span></div>
        </div>
        <div class="ai-field-actions">
          <input class="ai-field-override" data-ai-field="${esc(field.key)}" value="${esc(field.value || '')}" placeholder="Override or type value" oninput="overridePrepAIField(this)">
          <button type="button" class="prep-btn ${field.confirmed ? 'ai-btn-unconfirm' : 'ai-btn-confirm'}" onclick="togglePrepAIConfirm('${field.key}', ${field.confirmed ? 'false' : 'true'})">${field.confirmed ? 'Mark Unknown' : 'Confirm'}</button>
        </div>
      </div>`;
  }).join('');
  updatePrepAIDerivedUI();
}

function updatePrepAIDerivedUI() {
  const confirmed = prepAIState.filter(field => field.confirmed).length;
  const summary = document.getElementById('aiInspectSummary');
  if (summary) summary.textContent = `${confirmed} / ${prepAIState.length} fields confirmed`;
  const refName = prepConfirmedRefName();
  const refPreview = document.getElementById('aiRefNamePreview');
  if (refPreview) refPreview.textContent = refName;
  const refTarget = document.getElementById('skillRefName');
  const packageTarget = document.getElementById('skillPackageName');
  if (refTarget) refTarget.textContent = refName;
  if (packageTarget) packageTarget.textContent = `bt_skill_${refName}`;
}

function resetPrepSummary() {
  const summary = document.querySelector('#analysisPanel .analysis-summary');
  if (!summary) return;
  summary.innerHTML = `
    <div class="summary-main"><span class="summary-icon">AI</span><span><span class="summary-title">Waiting for inspection</span><span class="summary-sub">Choose files or enter a local path, then run AI inspection.</span></span></div>
    <div class="summary-stat"><strong>0 / ${prepAIState.length}</strong><span>fields inferred</span></div>
    <div class="summary-stat"><strong>${prepAIState.length}</strong><span>need confirmation</span></div>
    <div class="summary-stat"><strong>-</strong><span>overall confidence</span></div>`;
}

function overridePrepAIField(input) {
  const key = input.getAttribute('data-ai-field');
  const value = input.value;
  const wasConfirmed = prepAIState.some(field => field.key === key && field.confirmed);
  prepAIState = prepAIState.map(field => field.key === key
    ? { ...field, value, confirmed: false, pending: !value.trim() }
    : field);

  // Update adjacent UI in place — do not re-render the table (that remounts
  // inputs and steals focus after every keystroke).
  const row = input.closest('.ai-field-row');
  if (row) {
    const valueEl = row.querySelector('.ai-field-value');
    if (valueEl) {
      if (value.trim()) valueEl.textContent = value;
      else valueEl.innerHTML = '<em>Unknown</em>';
    }
    if (wasConfirmed) {
      row.classList.remove('is-confirmed');
      row.classList.add('is-pending');
      const status = row.querySelector('.ai-status');
      if (status) {
        status.className = 'ai-status warn';
        status.textContent = 'Needs confirmation';
      }
      const btn = row.querySelector('button.prep-btn');
      if (btn) {
        btn.className = 'prep-btn ai-btn-confirm';
        btn.textContent = 'Confirm';
        btn.setAttribute('onclick', `togglePrepAIConfirm('${key}', true)`);
      }
    }
  }
  updatePrepAIDerivedUI();
}

function togglePrepAIConfirm(key, confirmed) {
  prepAIState = prepAIState.map(field => {
    if (field.key !== key) return field;
    const input = document.querySelector(`.ai-field-override[data-ai-field="${key}"]`);
    const nextValue = input ? input.value.trim() : field.value;
    return { ...field, value: nextValue, confirmed: Boolean(confirmed && nextValue), pending: !nextValue };
  });
  renderAIFieldTable();
}

async function requestInspection(url, options) {
  setPrepBusy(true);
  try {
    const response = await fetch(url, options);
    const text = await response.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch (_) { data = {}; }
    if (!response.ok) throw new Error(data.error || `Inspection backend unavailable (${response.status})`);
    currentInspectionManifest = data;
    renderInspectionResult(data);
    updatePrepAIStateFromInspection(data);
    const aiNote = data.ai_status?.used
      ? ` App AI added ${data.ai_status.accepted_fields || 0} evidence-backed field(s).`
      : '';
    prepToast(`Inspection complete.${aiNote}`);
    showPrepStage(2);
  } catch (error) {
    const data = buildInspectionFallback(url, options, error);
    currentInspectionManifest = data;
    renderInspectionResult(data);
    updatePrepAIStateFromInspection(data);
    prepToast('Reviewing filenames in the browser. Fill or confirm fields below, then continue.');
    showPrepStage(2);
  } finally {
    setPrepBusy(false);
  }
}

function inferBrowserPrepHints(fileNames) {
  const names = (fileNames || []).map(name => String(name || '').trim()).filter(Boolean);
  const corpus = names.join(' ').toLowerCase();
  const yearMatch = corpus.match(/(?:^|[^0-9])((?:19|20)\d{2})(?:[^0-9]|$)/);
  const chemistry = ([
    ['nmc811', 'NMC811'], ['nmc', 'NMC'], ['lfp', 'LFP'], ['nca', 'NCA'],
    ['lco', 'LCO'], ['lmno', 'LMNO'], ['graphite', 'Graphite']
  ].find(([token]) => corpus.includes(token)) || [])[1] || '';
  const form = (['21700', '18650', '26650', '4680', 'pouch', 'prismatic'].find(token => corpus.includes(token)) || '');
  const rates = Array.from(new Set((corpus.match(/(?:^|[^a-z0-9.])(\d+(?:\.\d+)?)\s*c(?:rate)?\b/gi) || [])
    .map(token => token.replace(/^[^0-9]*/, '').replace(/\s+/g, '').replace(/crate/i, 'C').replace(/c$/i, 'C'))));
  const temperatures = Array.from(new Set((corpus.match(/(?:^|[^0-9])(-?\d{1,3})\s*°?\s*c\b/gi) || [])
    .map(token => token.replace(/^[^0-9-]*/, '').replace(/\s+/g, '').replace(/°/g, '').replace(/c$/i, ' °C'))));
  const cellIds = new Set();
  names.forEach(name => {
    const stem = String(name).replace(/\.[^.]+$/, '');
    const match = stem.match(/(?:cell|bat|battery|sample|c)[_-]?(\d{1,4})/i);
    if (match) cellIds.add(match[0]);
  });
  const extensions = Array.from(new Set(names.map(name => {
    const ext = (name.toLowerCase().match(/\.([a-z0-9]+)$/) || [,''])[1];
    return ext ? ext.toUpperCase() : '';
  }).filter(Boolean)));
  return {
    data_format: extensions.length ? extensions.join(' + ') : '',
    year: yearMatch ? yearMatch[1] : '',
    chemistry,
    form_factor: form ? (form === 'pouch' || form === 'prismatic' ? form[0].toUpperCase() + form.slice(1) : form) : '',
    c_rate: rates.length ? rates.join(', ') : '',
    temperature: temperatures.length ? temperatures.join(', ') : '',
    cell_count: cellIds.size ? String(cellIds.size) : ''
  };
}

function buildInspectionFallback(url, options, error) {
  const input = document.getElementById('prepFileInput');
  const files = getQueuedPrepFiles(input);
  const path = cleanPrepPath(document.getElementById('prepPath')?.value);
  const listedFiles = files.length
    ? files.map(file => classifyPrepFile(file._batteryTwinPath || file.webkitRelativePath || file.name))
    : [classifyPrepFile(path || 'local path')];
  const fileNames = listedFiles.map(file => file.filename);
  const hints = inferBrowserPrepHints(fileNames);
  const measurementCount = listedFiles.filter(file => file.file_role === 'measurement_data' || file.file_role === 'archive').length;
  const field = (name, value, evidence, confidence = 0) => ({
    name,
    value: value || '',
    evidence,
    confidence: value ? confidence : 0,
    pending: !value
  });
  const fields = [
    field('Data format', hints.data_format || (files.length ? summarizePrepExtensions(files) : inferPrepPathFormat(path)), files.length || path ? 'Derived from queued filenames or extensions.' : 'Enter a value manually if known.', 0.75),
    field('Year', hints.year, hints.year ? 'Four-digit year token found in a filename.' : 'Leave blank or type the year if you know it.', 0.7),
    field('Source / lab', '', 'Not available from filenames alone. Fill manually or use Task 2 metadata URLs.', 0),
    field('Chemistry', hints.chemistry, hints.chemistry ? 'Chemistry token found in a filename.' : 'Leave blank or type the chemistry if you know it.', 0.7),
    field('Form factor', hints.form_factor, hints.form_factor ? 'Form-factor token found in a filename.' : 'Leave blank or type the form factor if you know it.', 0.75),
    field('C-rate', hints.c_rate, hints.c_rate ? 'C-rate token found in a filename.' : 'Leave blank or type the C-rate if you know it.', 0.65),
    field('Temperature', hints.temperature, hints.temperature ? 'Temperature token found in a filename.' : 'Leave blank or type the temperature if you know it.', 0.7),
    field('Cell count', hints.cell_count || (measurementCount ? String(measurementCount) : ''), hints.cell_count ? 'Cell-like identifiers counted from filenames.' : (measurementCount ? 'Tentative count from queued measurement or archive files.' : 'Leave blank or type the cell count if you know it.'), hints.cell_count ? 0.7 : 0.4),
    field('License', '', 'Fill manually or confirm via Task 2 source/paper metadata.', 0)
  ];
  return {
    status: 'frontend_fallback',
    message: 'Browser filename review',
    file_count: listedFiles.length,
    sampled_count: 0,
    inferred_count: fields.filter(item => !item.pending).length,
    pending_count: fields.filter(item => item.pending).length,
    overall_confidence: fields.filter(item => !item.pending).length ? 0.45 : 0.15,
    files: listedFiles,
    fields,
    ai_status: { used: false, reason: 'Filename review in the browser.' },
    audit: {
      missing_percent: 0,
      anomalies: 0,
      unit_conversions: 0,
      unmapped_fields: 0
    },
    mappings: {}
  };
}

function classifyPrepFile(name) {
  const filename = String(name || '').trim() || 'local path';
  const lower = filename.toLowerCase();
  const ext = (lower.match(/\.([a-z0-9]+)$/) || [,''])[1];
  const metadataOnly = ['pdf', 'html', 'htm', 'md', 'ris', 'bib'];
  const archives = ['zip', 'tar', 'gz', 'tgz', '7z', 'rar'];
  const measurement = ['csv', 'xlsx', 'xls', 'mat', 'json', 'parquet', 'txt', 'tsv', 'h5', 'hdf5'];
  if (archives.includes(ext)) {
    return {
      filename,
      file_role: 'archive',
      role_reason: 'Archive queued. The local preprocessing agent will inspect its contents after you download the skill.'
    };
  }
  if (metadataOnly.includes(ext) || /readme|datacite|citation|paper|license|metadata/.test(lower)) {
    return {
      filename,
      file_role: 'metadata_only',
      role_reason: 'Treated as metadata or documentation evidence from the filename.'
    };
  }
  if (measurement.includes(ext)) {
    return {
      filename,
      file_role: 'measurement_data',
      role_reason: 'Filename extension looks compatible with raw battery measurements.'
    };
  }
  return {
    filename,
    file_role: 'queued',
    role_reason: 'Queued for preprocessing. Fill dataset context manually if automatic clues are incomplete.'
  };
}

function summarizePrepExtensions(files) {
  const extensions = Array.from(new Set(files.map(file => {
    const name = file._batteryTwinPath || file.webkitRelativePath || file.name || '';
    return (name.toLowerCase().match(/\.([a-z0-9]+)$/) || [,'unknown'])[1].toUpperCase();
  }))).filter(Boolean);
  return extensions.join(' + ') || 'Unknown';
}

function inferPrepPathFormat(path) {
  const ext = (String(path || '').toLowerCase().match(/\.([a-z0-9]+)$/) || [,'folder/path'])[1];
  return ext === 'folder/path' ? 'Folder or local path' : ext.toUpperCase();
}

function runPrepInspection() {
  const pathInput = document.getElementById('prepPath');
  const path = cleanPrepPath(pathInput?.value);
  if (pathInput && pathInput.value !== path) pathInput.value = path;
  if (!path) {
    prepToast('Enter a real local file or folder path.');
    return;
  }
  requestInspection('http://127.0.0.1:8000/api/inspect-path', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path })
  });
}

function cleanPrepPath(value) {
  return String(value || '').trim().replace(/^["']+|["']+$/g, '');
}

function runPrepFileInspection() {
  const input = document.getElementById('prepFileInput');
  const files = getQueuedPrepFiles(input);
  if (!files.length) {
    const path = cleanPrepPath(document.getElementById('prepPath')?.value);
    if (path) {
      runPrepInspection();
      return;
    }
    input?.click();
    prepToast('Choose raw files, drop a folder, or paste a real local path first.');
    return;
  }
  const form = new FormData();
  files.forEach(file => form.append('files', file, file._batteryTwinPath || file.webkitRelativePath || file.name));
  requestInspection('http://127.0.0.1:8000/api/inspect', { method: 'POST', body: form });
}

function getQueuedPrepFiles(input = document.getElementById('prepFileInput')) {
  return Array.from(prepDroppedFiles || input?.files || []);
}

function updatePrepFileNote(files) {
  const dropZone = document.getElementById('prepDropZone');
  const selected = document.getElementById('prepSelectedFiles');
  if (!files.length) {
    dropZone?.classList.remove('has-files');
    if (selected) {
      selected.classList.remove('has-files');
      selected.innerHTML = '<span>No files queued.</span>';
    }
    return;
  }
  dropZone?.classList.add('has-files');
  if (selected) {
    const names = files.slice(0, 3).map(file => file._batteryTwinPath || file.webkitRelativePath || file.name).join(', ');
    const more = files.length > 3 ? `, +${files.length - 3} more` : '';
    selected.classList.add('has-files');
    selected.innerHTML = `<span>Queued: ${esc(names + more)}</span><button class="prep-clear-files" type="button" onclick="clearPrepQueuedFiles(event)">Clear</button>`;
  }
}

function handlePrepFileInput(event) {
  const files = Array.from(event?.target?.files || []);
  prepDroppedFiles = files.length ? files : null;
  updatePrepFileNote(files);
  if (files.length) prepToast(`${files.length} file(s) queued for AI inspection.`);
}

function clearPrepQueuedFiles(event) {
  event?.preventDefault();
  event?.stopPropagation();
  prepDroppedFiles = null;
  const input = document.getElementById('prepFileInput');
  if (input) input.value = '';
  const folderInput = document.getElementById('prepFolderInput');
  if (folderInput) folderInput.value = '';
  updatePrepFileNote([]);
  prepToast('Queued files cleared.');
}

function renderInspectionResult(data) {
  const summary = document.querySelector('#analysisPanel .analysis-summary');
  const isFallback = data.status === 'frontend_fallback';
  if (summary) {
    const title = isFallback ? 'Ready for manual review' : 'Inspection complete';
    const sub = isFallback
      ? `${data.file_count} file(s) queued · fill empty fields below before downloading the skill`
      : `${data.file_count} files · ${data.sampled_count} sampled · ${data.ai_status?.used ? 'local + app AI' : 'local inspection'}`;
    summary.innerHTML = `
      <div class="summary-main"><span class="summary-icon">✓</span><span><span class="summary-title">${title}</span><span class="summary-sub">${sub}</span></span></div>
      <div class="summary-stat"><strong>${data.inferred_count} / ${data.fields.length}</strong><span>fields inferred</span></div>
      <div class="summary-stat"><strong>${data.pending_count}</strong><span>need confirmation</span></div>
      <div class="summary-stat"><strong>${Number(data.overall_confidence).toFixed(2)}</strong><span>overall confidence</span></div>`;
  }
  renderFileRolePanel(data.files || []);
  const tbody = document.querySelector('#analysisPanel .evidence-table tbody');
  if (tbody) tbody.innerHTML = data.fields.map(field => {
    const score = Math.round(Number(field.confidence || 0) * 100);
    const pending = field.pending ? ' pending' : '';
    return `<tr><td class="evidence-field">${esc(field.name)}</td>
      <td class="evidence-value${pending}">${esc(field.value)}</td>
      <td class="evidence-source">${esc(field.evidence)}</td>
      <td><span class="confidence${score < 60 ? ' medium' : ''}${pending}" style="--score:${score}%">${score}%</span></td>
      <td><button class="field-edit" onclick="editPrepField(this)">${field.pending ? 'Confirm' : 'Edit'}</button></td></tr>`;
  }).join('');
  const audit = document.querySelector('.audit-strip');
  if (audit && data.audit && !isFallback) {
    audit.innerHTML = `<div class="audit-item"><strong>${data.audit.missing_percent}%</strong><span>missing values in sample</span></div>
      <div class="audit-item"><strong>${data.audit.anomalies}</strong><span>sample anomalies flagged</span></div>
      <div class="audit-item"><strong>${data.audit.unit_conversions}</strong><span>unit conversions suggested</span></div>
      <div class="audit-item"><strong>${data.audit.unmapped_fields}</strong><span>unmapped source fields</span></div>`;
  }
  const safeParts = data.fields
    .filter(field => !field.pending && ['Year', 'Source / lab', 'Chemistry', 'Form factor'].includes(field.name))
    .map(field => String(field.value).replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, ''))
    .filter(Boolean);
  const refName = safeParts.join('_') || 'pending_confirmed_context';
  const refTarget = document.getElementById('skillRefName');
  const packageTarget = document.getElementById('skillPackageName');
  if (refTarget) refTarget.textContent = refName;
  if (packageTarget) packageTarget.textContent = `bt_skill_${refName}`;
}

function renderFileRolePanel(files) {
  const panel = document.getElementById('fileRolePanel');
  if (!panel) return;
  if (!files.length) {
    panel.innerHTML = '<div class="file-role-card queued"><strong>No files queued yet</strong><span>Upload raw data for Task 1 or provide a source URL for Task 2.</span></div>';
    return;
  }
  const labels = {
    measurement_data: ['measurement', 'Raw measurement data', 'Filename suggests measurement content for Task 1.'],
    metadata_only: ['metadata', 'Metadata evidence', 'Useful for Task 2 context; not a timeseries source by itself.'],
    archive: ['archive', 'Dataset archive', 'ZIP/archive queued. The local agent inspects contents after skill download.'],
    queued: ['queued', 'Queued source file', 'Included in this preprocessing package context.'],
    unknown: ['queued', 'Queued source file', 'Included in this preprocessing package context.']
  };
  panel.innerHTML = files.slice(0, 6).map(file => {
    const role = file.file_role || 'queued';
    const [klass, title, fallback] = labels[role] || labels.queued;
    const reason = file.role_reason || fallback;
    return `<div class="file-role-card ${klass}"><strong>${esc(title)}</strong><span>${esc(file.filename || 'file')} — ${esc(reason)}</span></div>`;
  }).join('');
}

function editPrepField(button) {
  const row = button.closest('tr');
  const valueCell = row && row.querySelector('.evidence-value');
  if (!valueCell) return;
  const current = valueCell.classList.contains('pending') ? '' : valueCell.textContent.trim();
  const updated = window.prompt('Confirm or edit this value. Leave blank to keep it pending.', current);
  if (updated === null) return;
  if (updated.trim()) {
    valueCell.textContent = updated.trim();
    valueCell.classList.remove('pending');
    button.textContent = 'Edit';
    prepToast('Value confirmed and marked as user-reviewed.');
  } else {
    valueCell.textContent = 'Needs confirmation';
    valueCell.classList.add('pending');
    button.textContent = 'Confirm';
  }
}

function downloadPrepManifest() {
  const manifest = currentInspectionManifest || {
    workflow: 'evidence-first',
    dataset_type: { value: 'calendar aging', confidence: 0.96, evidence: ['storage_25C folders', 'periodic RPT blocks'] },
    inferred_fields: 9,
    pending_fields: ['c_rate', 'license'],
    schema_compliant: true,
    soh_rul_benchmark_eligible: false,
    extended_channels: ['dT_dt_C_per_s', 'storage_time_h'],
    validation: {
      schema: 'readable',
      context: 'generate_draft_from_source_evidence',
      validator: 'fallback_to_builtin_and_log_reason',
      existing_outputs: 'archive_before_write'
    }
  };
  const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'batterytwin_inspection_manifest.json';
  link.click();
  URL.revokeObjectURL(link.href);
  prepToast('Inspection manifest exported.');
}

function prepAIFieldValue(key, { confirmedOnly = false } = {}) {
  const field = prepAIState.find(item => item.key === key);
  if (!field) return '';
  if (confirmedOnly && !field.confirmed) return '';
  return String(field.value || '').trim();
}

function normalizePrepSourceFormat(raw) {
  const text = String(raw || '').toLowerCase();
  if (!text) return 'mixed_unknown';
  if (text.includes('mat') || text.includes('matlab')) return 'matlab_mat';
  if (text.includes('hdf') || text.includes('h5')) return 'hdf5';
  if (text.includes('xls') || text.includes('excel')) return 'excel_workbook';
  if (text.includes('txt') || text.includes('log')) return 'text_logs';
  if (text.includes('batteryarchive') || text.includes('processed')) return 'processed_csv';
  if (text.includes('csv')) return 'csv_folder';
  if (text.includes('mixed') || text.includes('unknown')) return 'mixed_unknown';
  return text.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 64) || 'mixed_unknown';
}

function buildPrepSkillConfig() {
  const year = ppNameToken(prepAIFieldValue('year', { confirmedOnly: true }) || prepAIFieldValue('year'), 'YYYY');
  const source = ppNameToken(prepAIFieldValue('source_lab', { confirmedOnly: true }) || prepAIFieldValue('source_lab'), 'SOURCE');
  const chemistry = ppNameToken(prepAIFieldValue('chemistry', { confirmedOnly: true }) || prepAIFieldValue('chemistry'), 'CHEMISTRY');
  const formFactor = ppNameToken(prepAIFieldValue('form_factor', { confirmedOnly: true }) || prepAIFieldValue('form_factor'), 'FORMFACTOR');
  const rateRaw = prepAIFieldValue('c_rate', { confirmedOnly: true }) || prepAIFieldValue('c_rate');
  const chargeRate = ppRateToken(rateRaw, 'CHRG');
  const dischargeRate = ppRateToken(rateRaw, 'DCHRG');
  const temperature = ppTempToken(prepAIFieldValue('temperature', { confirmedOnly: true }) || prepAIFieldValue('temperature'), 'TEMP');
  const naming = {
    year,
    source,
    chemistry,
    form_factor: formFactor,
    charge_c_rate: chargeRate,
    discharge_c_rate: dischargeRate,
    temperature
  };
  const datasetId = prepConfirmedRefName();
  const sourceFormat = normalizePrepSourceFormat(
    prepAIFieldValue('data_format', { confirmedOnly: true }) || prepAIFieldValue('data_format')
  );
  const cellCountParsed = parseInt(prepAIFieldValue('cell_count', { confirmedOnly: true }) || prepAIFieldValue('cell_count'), 10);
  const cellCount = Number.isFinite(cellCountParsed) && cellCountParsed > 0 ? cellCountParsed : 1;
  const cellIdRule = 'from_source_file_names';
  return {
    adapter: ppAdapterForFormat(sourceFormat),
    source_format: sourceFormat,
    dataset_id: datasetId,
    cell_count: cellCount,
    cell_id_rule: cellIdRule,
    cell_id_rule_label: ppCellIdRuleLabel(cellIdRule),
    cell_id_mode: cellIdRule,
    naming,
    output_root: 'outputs/processed_dataset',
    raw_schema: null,
    source_files: [],
    source_file: '',
    column_mapping: {},
    current_sign_standard: 'charge_positive_discharge_negative',
    time_series_columns: PP_TS_COLUMNS,
    cycle_summary_columns: PP_CYCLE_COLUMNS,
    metadata_columns: PP_METADATA_COLUMNS
  };
}

function generatePrepSkill() {
  const config = buildPrepSkillConfig();
  if (!config.dataset_id || config.dataset_id === 'UNKNOWN_UNKNOWN_UNKNOWN_UNKNOWN') {
    prepToast('Confirm dataset naming fields in Step 2 before downloading the skill.');
    return;
  }
  if (!config.cell_count || config.cell_count < 1) {
    prepToast('Cell count must be at least 1.');
    return;
  }
  const root = ppSkillRootName();
  const packageName = ppSkillPackageName(config.dataset_id);
  const blob = bwZipBlob(ppBuildSkillFiles(root, config));
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = packageName + '.zip';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  if (window.BatteryLakeAnalytics && typeof window.BatteryLakeAnalytics.trackSkillDownload === 'function') {
    window.BatteryLakeAnalytics.trackSkillDownload({ skill_source: 'preprocessing_skill' });
  }
  prepToast('BatteryLake skill generated: ' + a.download);
}

async function readPrepDropEntry(entry, prefix = '') {
  if (!entry) return [];
  if (entry.isFile) {
    return new Promise(resolve => {
      entry.file(file => {
        file._batteryTwinPath = prefix + file.name;
        resolve([file]);
      }, () => resolve([]));
    });
  }
  if (!entry.isDirectory) return [];
  const reader = entry.createReader();
  const batches = [];
  let batch = [];
  do {
    batch = await new Promise(resolve => reader.readEntries(resolve, () => resolve([])));
    batches.push(...batch);
  } while (batch.length);
  const nested = await Promise.all(batches.map(item => readPrepDropEntry(item, `${prefix}${entry.name}/`)));
  return nested.flat();
}

async function collectPrepDroppedFiles(dataTransfer) {
  const items = Array.from(dataTransfer?.items || []);
  const entries = items.map(item => item.webkitGetAsEntry?.()).filter(Boolean);
  if (entries.length) {
    const nested = await Promise.all(entries.map(entry => readPrepDropEntry(entry)));
    return nested.flat();
  }
  return Array.from(dataTransfer?.files || []);
}

const prepDropZone = document.getElementById('prepDropZone');
if (prepDropZone) {
  ['dragenter', 'dragover'].forEach(type => {
    prepDropZone.addEventListener(type, event => {
      event.preventDefault();
      event.stopPropagation();
      prepDropZone.classList.add('dragging');
    });
  });
  ['dragleave', 'drop'].forEach(type => {
    prepDropZone.addEventListener(type, event => {
      event.preventDefault();
      event.stopPropagation();
      if (type === 'dragleave' && prepDropZone.contains(event.relatedTarget)) return;
      prepDropZone.classList.remove('dragging');
    });
  });
  prepDropZone.addEventListener('drop', async event => {
    const files = await collectPrepDroppedFiles(event.dataTransfer);
    prepDroppedFiles = files;
    updatePrepFileNote(files);
    if (!files.length) prepToast('No files were dropped.');
  });
}

/* ── PREPROCESSING WIZARD ── */
var PP = { step: 0 };
function ppPanels() { return Array.from(document.querySelectorAll('#page-preprocessing .pp-step-panel')); }
function ppSteps() { return Array.from(document.querySelectorAll('#page-preprocessing .pp-step')); }
function ppChecks(panel) { return Array.from(panel.querySelectorAll('.pp-check')); }
function ppStepDone(index) {
  const panel = ppPanels()[index];
  if (!panel) return false;
  const checks = ppChecks(panel);
  return checks.length > 0 && checks.every(c => c.classList.contains('done'));
}
function ppMaxUnlocked() {
  let max = 0;
  const panels = ppPanels();
  for (let i = 0; i < panels.length; i++) {
    if (ppStepDone(i)) max = Math.min(i + 1, panels.length - 1);
    else break;
  }
  return max;
}
function ppRender() {
  const panels = ppPanels();
  const steps = ppSteps();
  if (!panels.length || !steps.length) return;
  const maxUnlocked = ppMaxUnlocked();
  if (PP.step > maxUnlocked) PP.step = maxUnlocked;
  panels.forEach((panel, i) => panel.classList.toggle('active', i === PP.step));
  steps.forEach((step, i) => {
    const done = ppStepDone(i);
    const locked = i > maxUnlocked;
    step.classList.toggle('active', i === PP.step);
    step.classList.toggle('done', done);
    step.classList.toggle('locked', locked);
    step.disabled = locked;
    const num = step.querySelector('.pp-step-num');
    if (num) num.textContent = done ? '✓' : String(i + 1);
  });
  const active = panels[PP.step];
  const activeDone = ppStepDone(PP.step);
  const doneCount = document.querySelectorAll('#page-preprocessing .pp-check.done').length;
  const totalCount = document.querySelectorAll('#page-preprocessing .pp-check').length;
  const render = document.getElementById('pp-render');
  const doneEl = document.getElementById('pp-done-count');
  const gate = document.getElementById('pp-gate');
  if (render) render.textContent = 'Step ' + (PP.step + 1) + ' of ' + panels.length;
  if (doneEl) doneEl.textContent = doneCount + '/' + totalCount;
  if (gate) gate.textContent = doneCount === totalCount ? 'Ready' : (activeDone ? 'Open' : 'Locked');
  ppUpdatePackagePreview();
  if (active) {
    const prev = active.querySelector('.pp-actions .pp-btn:not(.pp-next)');
    const next = active.querySelector('.pp-next');
    if (prev) prev.disabled = PP.step === 0;
    if (next) {
      next.disabled = !activeDone;
      next.textContent = PP.step === panels.length - 1 ? 'Finish' : 'Next';
    }
  }
}
function ppGoStep(index) {
  if (index > ppMaxUnlocked()) {
    showToast('Complete the current preprocessing checks before moving on.', 'info');
    return;
  }
  PP.step = Math.max(0, Math.min(index, ppPanels().length - 1));
  ppRender();
}
function ppToggleCheck(el) {
  el.classList.toggle('done');
  el.setAttribute('aria-pressed', el.classList.contains('done') ? 'true' : 'false');
  ppRender();
}
function ppNext() {
  if (!ppStepDone(PP.step)) {
    showToast('Mark every check in this step before continuing.', 'info');
    return;
  }
  if (PP.step < ppPanels().length - 1) {
    PP.step++;
    ppRender();
  } else {
    showToast('Preprocessing package is ready for Benchmark.', 'success');
  }
}
function ppPrev() {
  PP.step = Math.max(0, PP.step - 1);
  ppRender();
}

/* ── PREPROCESSING INSPECT-FIRST GUIDE ── */
var PP_STAGE = { step: 0 };
function ppStagePanels() { return Array.from(document.querySelectorAll('#page-preprocessing .pp-two-stage .pp-stage')); }
function ppStageButtons() { return Array.from(document.querySelectorAll('#page-preprocessing .pp-guide-step')); }
function ppUpdateInspectCommand() {
  const formatEl = document.getElementById('pp2-source-format');
  const command = document.getElementById('pp2-inspect-command');
  const format = formatEl ? formatEl.value : 'csv_folder';
  if (!command) return;
  command.textContent = [
    'cd /path/to/cell_files_folder',
    'python3 inspect_batterylake_titles.py \\',
    '  --format ' + format + ' \\',
    '  --schema-out raw_schema.json \\',
    '  --columns-out raw_columns.csv'
  ].join('\n');
}
function ppStageRender() {
  const panels = ppStagePanels();
  const buttons = ppStageButtons();
  if (!panels.length) return;
  PP_STAGE.step = Math.max(0, Math.min(PP_STAGE.step, panels.length - 1));
  panels.forEach((panel, i) => panel.classList.toggle('active', i === PP_STAGE.step));
  buttons.forEach((button, i) => {
    button.classList.toggle('active', i === PP_STAGE.step);
    button.classList.toggle('done', i < PP_STAGE.step);
    const num = button.querySelector('.pp-guide-step-num');
    if (num) num.textContent = i < PP_STAGE.step ? '✓' : String(i + 1);
  });
  const prev = document.getElementById('pp2-prev-step');
  const next = document.getElementById('pp2-next-step');
  const position = document.getElementById('pp2-stage-position');
  if (prev) prev.disabled = PP_STAGE.step === 0;
  if (next) next.textContent = PP_STAGE.step === panels.length - 1 ? 'Finish' : 'Next';
  if (position) position.textContent = 'Step ' + (PP_STAGE.step + 1) + ' of ' + panels.length;
  ppUpdateInspectCommand();
}
function ppStageGo(index) {
  PP_STAGE.step = Number(index) || 0;
  ppStageRender();
}
function ppStageNext() {
  const panels = ppStagePanels();
  if (PP_STAGE.step < panels.length - 1) {
    PP_STAGE.step++;
    ppStageRender();
  }
}
function ppStagePrev() {
  PP_STAGE.step = Math.max(0, PP_STAGE.step - 1);
  ppStageRender();
}
async function ppCopyText(text, successMessage) {
  if (!text) return;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.left = '-9999px';
      document.body.appendChild(area);
      area.select();
      document.execCommand('copy');
      area.remove();
    }
    showToast(successMessage || 'Copied.', 'success');
  } catch (_) {
    showToast('Copy failed. Select the command block manually.', 'error');
  }
}
function ppCopyInspectCommand() {
  const cmd = (document.getElementById('pp2-inspect-command') || {}).textContent || '';
  ppCopyText(cmd.trim(), 'Inspect command copied.');
}


const PP_TS_COLUMNS = ['cell_id','cycle_id','time_s','voltage_V','current_A','temperature_C','charge_capacity_Ah','discharge_capacity_Ah','step_type'];
const PP_CYCLE_COLUMNS = ['cell_id','cycle_id','step_type','capacity_Ah','SOH','RUL','charge_capacity_Ah','discharge_capacity_Ah','temperature_max_C','temperature_avg_C','charge_duration_s','discharge_duration_s','internal_resistance_Ohm','cycle_end_flag'];
const PP_METADATA_COLUMNS = ['dataset_id','cell_id','source_type','split_tag','chemistry','cathode_material','anode_material','brand_or_manufacturer','model_or_size','form_factor','nominal_capacity_Ah','nominal_voltage_V','temperature_C','charge_protocol','discharge_protocol','C_rate','cutoff_voltage_upper','cutoff_voltage_lower'];
const PP_ADAPTERS = [
  { key: 'batteryarchive_csv', name: 'BatteryArchive CSV', requiresMat: false },
  { key: 'generic_csv_ranges', name: 'Generic CSV + cycle ranges', requiresMat: false },
  { key: 'matlab_mat', name: 'MATLAB MAT', requiresMat: true }
];

function ppPackageName(adapterKey, datasetId) {
  const base = String(datasetId || 'battery_dataset').replace(/[^A-Za-z0-9_.-]+/g, '_').replace(/^_+|_+$/g, '');
  return 'bt_preprocess_' + adapterKey + '_' + (base || 'battery_dataset');
}

function ppInspectPackageName(sourceFormat, datasetId) {
  const base = String(datasetId || 'battery_dataset').replace(/[^A-Za-z0-9_.-]+/g, '_').replace(/^_+|_+$/g, '');
  return 'bt_inspect_' + (sourceFormat || 'raw') + '_' + (base || 'battery_dataset');
}

function ppSkillPackageName(datasetId) {
  const base = String(datasetId || 'battery_dataset').replace(/[^A-Za-z0-9_.-]+/g, '_').replace(/^_+|_+$/g, '');
  return 'bt_skill_' + (base || 'battery_dataset');
}

function ppSkillRootName() {
  return 'batterylake-preprocessing';
}

function ppAdapterForFormat(sourceFormat) {
  if (sourceFormat === 'matlab_mat') return 'matlab_mat';
  if (sourceFormat === 'processed_csv') return 'batteryarchive_csv';
  return 'generic_csv_ranges';
}

function ppRawSchemaFiles() {
  const schema = PP.rawSchema || {};
  return Array.isArray(schema.files) ? schema.files : [];
}

function ppRawSchemaSourceEntries() {
  const schema = PP.rawSchema || {};
  return Array.isArray(schema.source_entries) ? schema.source_entries : [];
}

function ppRawFileNames() {
  const entries = ppRawSchemaSourceEntries();
  if (entries.length) return entries.map(entry => entry.path || entry.file || '').filter(Boolean);
  return ppRawSchemaFiles().map(file => file.path || file.file || '').filter(Boolean);
}

function ppSelectedSourceFiles() {
  const select = document.getElementById('pp-source-file-select');
  if (!select) return [];
  return Array.from(select.selectedOptions || []).map(option => option.value).filter(Boolean);
}

function ppFirstRawFile() {
  const selected = ppSelectedSourceFiles();
  if (selected.length) return selected[0];
  const files = ppRawFileNames();
  return files[0] || '';
}

function ppCellIdFromSourceFile(file, index) {
  const parts = String(file || '').replace(/\\/g, '/').split('/');
  const base = parts.pop() || ('cell_' + String(index + 1).padStart(3, '0'));
  const stem = base.replace(/\.[^.]+$/, '');
  return ppNameToken(stem, 'cell_' + String(index + 1).padStart(3, '0'));
}

function ppSelectedSourceFilesLabel(files) {
  if (!files || !files.length) return 'Upload raw_schema first';
  if (files.length === 1) return files[0];
  return files.length + ' files selected';
}

function ppSchemaColumns() {
  const seen = new Set();
  const cols = [];
  ppRawSchemaFiles().forEach(file => {
    (file.columns || file.keys || []).forEach(col => {
      const name = String(col || '').trim();
      if (name && !seen.has(name)) {
        seen.add(name);
        cols.push(name);
      }
    });
  });
  return cols;
}

function ppGuessColumn(columns, patterns) {
  const normalized = columns.map(col => ({ raw: col, key: String(col).toLowerCase().replace(/[^a-z0-9]+/g, '') }));
  for (const pattern of patterns) {
    const found = normalized.find(item => pattern.length === 1 ? item.key === pattern : item.key.includes(pattern));
    if (found) return found.raw;
  }
  return '';
}

function ppSetSelectOptions(select, columns, guess) {
  if (!select) return;
  const opts = [''].concat(columns);
  select.innerHTML = opts.map(col => `<option value="${esc(col)}">${col ? esc(col) : 'Select source variable'}</option>`).join('');
  if (guess && columns.includes(guess)) select.value = guess;
}

function ppSelectedMapping() {
  const val = id => (document.getElementById(id) && document.getElementById(id).value) || '';
  return {
    time_s: val('pp-map-time'),
    voltage_V: val('pp-map-voltage'),
    current_A: val('pp-map-current'),
    temperature_C: val('pp-map-temperature'),
    cycle_id: val('pp-map-cycle'),
    cell_id: val('pp-map-cell')
  };
}

function ppInputVal(id) {
  const el = document.getElementById(id);
  return el ? String(el.value || '').trim() : '';
}

function ppCellCount() {
  const parsed = parseInt(ppInputVal('pp2-cell-count'), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function ppCellIdRule() {
  return ppInputVal('pp2-cell-id') || 'from_source_file_names';
}

function ppCellIdRuleLabel(rule) {
  const labels = {
    from_source_file_names: 'From source file names',
    from_folder_names: 'From folder names',
    inside_source_columns: 'Inside source columns',
    manual_list: 'Manual list'
  };
  return labels[rule] || labels.from_source_file_names;
}

function ppNameToken(value, fallback) {
  const clean = String(value || '').trim().replace(/[^A-Za-z0-9.-]+/g, '_').replace(/^_+|_+$/g, '');
  return clean || fallback;
}

function ppRateToken(value, fallback) {
  const clean = ppNameToken(value, fallback);
  if (/^multiC$/i.test(clean)) return 'MultiC';
  if (/C$/i.test(clean)) return clean.replace(/c$/i, 'C');
  return clean + 'C';
}

function ppTempToken(value, fallback) {
  const clean = ppNameToken(value, fallback);
  if (/^multiT$/i.test(clean)) return 'MultiT';
  if (/T$/i.test(clean)) return clean.replace(/t$/i, 'T');
  return clean + 'T';
}

function ppNamingFields() {
  return {
    year: ppNameToken(ppInputVal('pp-name-year'), 'YYYY'),
    source: ppNameToken(ppInputVal('pp-name-source'), 'SOURCE'),
    chemistry: ppNameToken(ppInputVal('pp-name-chem'), 'CHEMISTRY'),
    form_factor: ppNameToken(ppInputVal('pp-name-form'), 'FORMFACTOR'),
    charge_c_rate: ppRateToken(ppInputVal('pp-name-charge'), 'CHRG'),
    discharge_c_rate: ppRateToken(ppInputVal('pp-name-discharge'), 'DCHRG'),
    temperature: ppTempToken(ppInputVal('pp-name-temp'), 'TEMP')
  };
}

function ppGeneratedRefName() {
  const f = ppNamingFields();
  return [f.year, f.source, f.chemistry, f.form_factor, f.charge_c_rate, f.discharge_c_rate, f.temperature].join('_');
}

function ppUpdateGeneratedRefName() {
  const ref = document.getElementById('pp2-dataset-id');
  if (ref) ref.value = ppGeneratedRefName();
}

function ppCurrentConfig() {
  const sourceFormatEl = document.getElementById('pp2-source-format');
  const adapterEl = document.getElementById('pp-adapter');
  const datasetEl = document.getElementById('pp2-dataset-id') || document.getElementById('pp-dataset-id');
  const sourceFormat = sourceFormatEl ? sourceFormatEl.value : '';
  const adapter = sourceFormat ? ppAdapterForFormat(sourceFormat) : (adapterEl ? adapterEl.value : 'batteryarchive_csv');
  ppUpdateGeneratedRefName();
  const datasetId = datasetEl ? datasetEl.value.trim() : ppGeneratedRefName();
  const naming = ppNamingFields();
  const sourceFiles = ppSelectedSourceFiles();
  return {
    adapter: adapter,
    source_format: sourceFormat || adapter,
    dataset_id: datasetId || 'battery_dataset',
    cell_count: ppCellCount(),
    cell_id_rule: ppCellIdRule(),
    cell_id_rule_label: ppCellIdRuleLabel(ppCellIdRule()),
    cell_id_mode: ppCellIdRule(),
    naming: naming,
    output_root: 'outputs/processed_dataset',
    raw_schema: PP.rawSchema || null,
    source_files: sourceFiles,
    source_file: ppFirstRawFile(),
    column_mapping: ppSelectedMapping(),
    current_sign_standard: 'charge_positive_discharge_negative',
    time_series_columns: PP_TS_COLUMNS,
    cycle_summary_columns: PP_CYCLE_COLUMNS,
    metadata_columns: PP_METADATA_COLUMNS
  };
}

function ppInferDatasetIdFromRawSchema(schema) {
  const rawRoot = String((schema && schema.raw_root) || '').replace(/\\/g, '/').replace(/\/+$/g, '');
  const base = rawRoot.split('/').filter(Boolean).pop() || '';
  if (!base || base === '.' || base === '..') return '';
  return base.replace(/[^A-Za-z0-9_.-]+/g, '_').replace(/^_+|_+$/g, '');
}

function ppMaybeSetDatasetIdFromSchema(schema) {
  const input = document.getElementById('pp2-dataset-id');
  if (!input) return;
  const current = input.value.trim();
  const inferred = ppInferDatasetIdFromRawSchema(schema);
  const canAutoFill = !current || current === 'my_raw_battery_dataset' || current === 'battery_dataset';
  if (canAutoFill && inferred) input.value = inferred;
}

function ppUpdatePackagePreview() {
  const preview = document.getElementById('pp-package-preview');
  const cfg = ppCurrentConfig();
  const name = ppPackageName(cfg.adapter, cfg.dataset_id);
  if (preview) preview.value = name;
  const preview2 = document.getElementById('pp2-convert-package-preview');
  if (preview2) preview2.value = ppSkillPackageName(cfg.dataset_id);
  const sourceFile = document.getElementById('pp2-source-file-preview');
  if (sourceFile) sourceFile.value = cfg.dataset_id;
  const scope = document.getElementById('pp-source-file-scope');
  if (scope) scope.value = cfg.source_files.length ? (cfg.source_files.length + ' selected files; one file per cell') : 'Upload raw_schema first';
}

document.addEventListener('input', e => {
  if (e.target && ['pp-adapter','pp-dataset-id','pp2-source-format','pp2-dataset-id','pp-name-year','pp-name-source','pp-name-chem','pp-name-form','pp-name-charge','pp-name-discharge','pp-name-temp','pp2-cell-id','pp2-cell-count'].includes(e.target.id)) {
    ppUpdateGeneratedRefName();
    ppUpdatePackagePreview();
    ppUpdateInspectCommand();
  }
});
document.addEventListener('change', e => {
  if (e.target && ['pp-adapter','pp-dataset-id','pp2-source-format','pp2-dataset-id','pp-name-year','pp-name-source','pp-name-chem','pp-name-form','pp-name-charge','pp-name-discharge','pp-name-temp','pp2-cell-id','pp2-cell-count','pp-source-file-select','pp-map-time','pp-map-voltage','pp-map-current','pp-map-temperature','pp-map-cycle','pp-map-cell'].includes(e.target.id)) {
    ppUpdateGeneratedRefName();
    ppUpdatePackagePreview();
    ppUpdateInspectCommand();
  }
});

function ppSchemaJson(config) {
  return JSON.stringify({
    version: 'batterylake-preprocessing-v1',
    dataset_id: config.dataset_id,
    files: {
      time_series: '*_timeseries.csv',
      cycle_summary: '*_cycle_summary.csv',
      metadata: 'dataset_metadata.csv'
    },
    columns: {
      time_series: PP_TS_COLUMNS,
      cycle_summary: PP_CYCLE_COLUMNS,
      metadata: PP_METADATA_COLUMNS
    }
  }, null, 2) + '\n';
}

function ppDatasetContextJson(config) {
  const context = {
    version: 'batterylake-agentic-preprocessing-v1',
    dataset_id: config.dataset_id,
    source_format: config.source_format,
    cell_count: config.cell_count,
    cell_id_rule: config.cell_id_rule,
    cell_id_rule_label: config.cell_id_rule_label,
    naming: config.naming,
    current_sign_standard: 'charge_positive_discharge_negative',
    expected_output_root: 'outputs/processed_dataset',
    expected_report: 'outputs/preprocessing_report.json',
    required_outputs: {
      time_series: '*_timeseries.csv',
      cycle_summary: '*_cycle_summary.csv',
      metadata: 'dataset_metadata.csv'
    },
    columns: {
      time_series: PP_TS_COLUMNS,
      cycle_summary: PP_CYCLE_COLUMNS,
      metadata: PP_METADATA_COLUMNS
    }
  };
  return JSON.stringify(context, null, 2) + '\n';
}

function ppSkillMd(config) {
  return [
    '---',
    'name: batterylake-preprocessing',
    'description: Use when converting raw battery cycling datasets in CSV, TXT, Excel, MAT, HDF5, or mixed formats into the fixed BatteryLake processed dataset schema for SOH/RUL benchmark training. The skill guides an AI agent to inspect source files, identify time, voltage, current, temperature, cycle, capacity, and cell fields, process each cell, validate outputs, and write preprocessing_report.json.',
    '---',
    '',
    '# BatteryLake Preprocessing',
    '',
    'Use this skill to turn raw battery cycling data into the fixed BatteryLake processed dataset format.',
    '',
    '## Required context',
    '',
    '- Read `references/dataset_context.json` first. It contains the dataset ref_name, source format hint, cell count, cell ID rule, chemistry, form factor, C-rates, and temperature.',
    '- Read `references/batterylake_schema.md` before writing code. The output schema is fixed.',
    '- Raw source files stay on the user machine. Do not assume they match any known public dataset until you inspect them.',
    '',
    '## Workflow',
    '',
    '1. Ask the user for the raw source folder path if it is not already provided.',
    '2. Inventory the source folder recursively. Record file extensions, folder structure, file sizes, sheet names, MAT/HDF5 keys, column headers, and a small row sample.',
    '3. Decide the cell boundary using `cell_count` and `cell_id_rule`: file name, folder name, source column, or manual list.',
    '4. Identify BatteryLake channels from evidence in the source files: time_s, voltage_V, current_A, temperature_C, cycle_id, capacity, charge/discharge state, and cell_id.',
    '5. If any mapping is ambiguous, stop and ask the user. Do not silently guess important labels.',
    '6. Write the smallest local converter needed for this dataset. Keep dataset-specific parsing in the working folder, not in this skill.',
    '7. Standardize current_A so charge is positive and discharge is negative.',
    '8. Export `outputs/processed_dataset/` with one `*_timeseries.csv` and one `*_cycle_summary.csv` per cell, plus one `dataset_metadata.csv`.',
    '9. Run `python scripts/validate_batterylake_outputs.py --data outputs/processed_dataset --context references/dataset_context.json --out outputs/preprocessing_report.json`.',
    '10. Show the user the report path, status, cell count, row counts, warnings, and whether `benchmark_ready` is true.',
    '',
    '## Hard rules',
    '',
    '- Never fabricate I / V / T / time / cycle mappings. Use source evidence.',
    '- Never upload raw source data to a remote service unless the user explicitly asks.',
    '- Preserve units in output column names: seconds, volts, amps, Celsius, amp-hours.',
    '- If the dataset is not an aging dataset, mark that clearly in warnings before it is used for SOH/RUL Benchmark.',
    '- The final output must pass the bundled validator.'
  ].join('\n') + '\n';
}

function ppSkillSchemaMd() {
  return [
    '# BatteryLake Processed Dataset Schema',
    '',
    'The AI agent must export the same three file types for every dataset.',
    '',
    '## Time-series files',
    '',
    'File pattern: `*_timeseries.csv`.',
    '',
    'Required columns:',
    PP_TS_COLUMNS.map(col => '- `' + col + '`').join('\n'),
    '',
    'Rules:',
    '- `cell_id` must identify one physical cell.',
    '- `cycle_id` must be numeric or consistently sortable.',
    '- `time_s` is elapsed time in seconds within the cycle or record segment.',
    '- `voltage_V` is cell voltage in volts.',
    '- `current_A` uses charge > 0 and discharge < 0.',
    '- `temperature_C` is Celsius. Use empty values only when temperature is genuinely unavailable.',
    '- `step_type` should be charge, discharge, rest, or unknown.',
    '',
    '## Cycle-summary files',
    '',
    'File pattern: `*_cycle_summary.csv`.',
    '',
    'Required columns:',
    PP_CYCLE_COLUMNS.map(col => '- `' + col + '`').join('\n'),
    '',
    'Rules:',
    '- `capacity_Ah` should be the main discharge capacity when available.',
    '- `SOH` is capacity normalized to a clear baseline when available.',
    '- `RUL` is remaining useful life in cycles when the task definition supports it.',
    '- If SOH/RUL cannot be scientifically defined from the source data, leave them empty and add a warning.',
    '',
    '## Metadata file',
    '',
    'File name: `dataset_metadata.csv`.',
    '',
    'Required columns:',
    PP_METADATA_COLUMNS.map(col => '- `' + col + '`').join('\n'),
    '',
    '## Report',
    '',
    'The final report must be written to `outputs/preprocessing_report.json` and should include:',
    '- `dataset_id`',
    '- `status`: pass or fail',
    '- `benchmark_ready`: true or false',
    '- `counts` for time-series files, cycle-summary files, metadata rows, cells, and rows',
    '- `warnings` for assumptions, missing fields, non-aging data, or ambiguous mappings',
    '- `errors` for schema failures'
  ].join('\n') + '\n';
}

function ppSkillValidatorPy() {
  return String.raw`#!/usr/bin/env python3
import argparse
import csv
import json
from pathlib import Path

TS_COLUMNS = ${JSON.stringify(PP_TS_COLUMNS, null, 2)}
CYCLE_COLUMNS = ${JSON.stringify(PP_CYCLE_COLUMNS, null, 2)}
METADATA_COLUMNS = ${JSON.stringify(PP_METADATA_COLUMNS, null, 2)}


def read_header(path):
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        try:
            return next(csv.reader(handle))
        except StopIteration:
            return []


def count_rows(path):
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.reader(handle)
        next(reader, None)
        return sum(1 for _ in reader)


def read_metadata_cells(path):
    if not path.exists():
        return set(), 0
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))
    return {str(row.get("cell_id", "")).strip() for row in rows if row.get("cell_id")}, len(rows)


def missing_columns(path, required):
    header = read_header(path)
    return [col for col in required if col not in header]


def validate(data_root, context):
    data_root = Path(data_root)
    errors = []
    warnings = []
    ts_files = sorted(data_root.glob("*_timeseries.csv"))
    cs_files = sorted(data_root.glob("*_cycle_summary.csv"))
    metadata_path = data_root / "dataset_metadata.csv"

    if not data_root.exists():
        errors.append("processed dataset folder does not exist: %s" % data_root)
    if not ts_files:
        errors.append("no *_timeseries.csv files found")
    if not cs_files:
        errors.append("no *_cycle_summary.csv files found")
    if not metadata_path.exists():
        errors.append("dataset_metadata.csv is missing")

    for path in ts_files:
        missing = missing_columns(path, TS_COLUMNS)
        if missing:
            errors.append("%s missing columns: %s" % (path.name, ", ".join(missing)))
    for path in cs_files:
        missing = missing_columns(path, CYCLE_COLUMNS)
        if missing:
            errors.append("%s missing columns: %s" % (path.name, ", ".join(missing)))
    if metadata_path.exists():
        missing = missing_columns(metadata_path, METADATA_COLUMNS)
        if missing:
            errors.append("dataset_metadata.csv missing columns: %s" % ", ".join(missing))

    ts_cells = {path.name.replace("_timeseries.csv", "") for path in ts_files}
    cs_cells = {path.name.replace("_cycle_summary.csv", "") for path in cs_files}
    meta_cells, metadata_rows = read_metadata_cells(metadata_path)
    if ts_cells != cs_cells:
        errors.append("time-series cells and cycle-summary cells do not match")
    if meta_cells and ts_cells and not ts_cells.issubset(meta_cells):
        warnings.append("metadata does not list every exported cell")

    expected_cells = int(context.get("cell_count") or 0)
    if expected_cells and ts_cells and expected_cells != len(ts_cells):
        warnings.append("expected %d cells from page context, exported %d cells" % (expected_cells, len(ts_cells)))

    ts_rows = sum(count_rows(path) for path in ts_files)
    cs_rows = sum(count_rows(path) for path in cs_files)
    if ts_rows == 0:
        errors.append("time-series files contain 0 data rows")
    if cs_rows == 0:
        errors.append("cycle-summary files contain 0 data rows")

    status = "pass" if not errors else "fail"
    return {
        "dataset_id": context.get("dataset_id", data_root.name),
        "status": status,
        "benchmark_ready": status == "pass" and bool(ts_files) and bool(cs_files) and metadata_path.exists(),
        "counts": {
            "time_series_files": len(ts_files),
            "cycle_summary_files": len(cs_files),
            "metadata_rows": metadata_rows,
            "cells": len(ts_cells),
            "time_series_rows": ts_rows,
            "cycle_summary_rows": cs_rows
        },
        "warnings": warnings,
        "errors": errors
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", default="outputs/processed_dataset")
    parser.add_argument("--context", default="references/dataset_context.json")
    parser.add_argument("--out", default="outputs/preprocessing_report.json")
    args = parser.parse_args()

    context_path = Path(args.context)
    context = json.loads(context_path.read_text(encoding="utf-8")) if context_path.exists() else {}
    report = validate(args.data, context)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    if report["status"] != "pass":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
`;
}

function ppBuildSkillFiles(root, config) {
  return [
    { name: root + '/SKILL.md', data: ppSkillMd(config) },
    { name: root + '/references/batterylake_schema.md', data: ppSkillSchemaMd() },
    { name: root + '/references/dataset_context.json', data: ppDatasetContextJson(config) },
    { name: root + '/scripts/validate_batterylake_outputs.py', data: ppSkillValidatorPy() }
  ];
}

function ppCsvCell(value) {
  const text = String(value == null ? '' : value);
  return /[",\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

function ppColumnMapCsv(config) {
  const mapping = (config && config.column_mapping) || {};
  const raw = key => ppCsvCell(mapping[key] || ('replace_with_' + key + '_label'));
  return [
    'canonical_column,source_column,unit,sign,required,meaning',
    'cell_id,' + raw('cell_id') + ',,keep,no,cell identifier; use constant cell_id from cell_ranges.csv if absent',
    'cycle_id,' + raw('cycle_id') + ',,keep,yes,cycle index in the raw file',
    'time_s,' + raw('time_s') + ',s,keep,yes,time channel',
    'voltage_V,' + raw('voltage_V') + ',V,keep,yes,V(t) voltage channel',
    'current_A,' + raw('current_A') + ',A,charge_positive_discharge_negative,yes,I(t) current channel; output standard is charge > 0 and discharge < 0',
    'temperature_C,' + raw('temperature_C') + ',C,keep,yes,T(t) temperature channel',
    'charge_capacity_Ah,replace_with_charge_capacity_label,Ah,keep,no,charge capacity if present',
    'discharge_capacity_Ah,replace_with_discharge_capacity_label,Ah,keep,no,discharge capacity if present',
    'step_type,replace_with_step_label,,keep,no,charge/discharge/rest label if present'
  ].join('\n') + '\n';
}

function ppCellRangesCsv(config) {
  const files = ((config && Array.isArray(config.source_files) && config.source_files.length) ? config.source_files : [(config && config.source_file) || 'replace_with_raw_file.csv']).filter(Boolean);
  const naming = (config && config.naming) || {};
  const chemistry = ppCsvCell(naming.chemistry || 'unknown');
  const formFactor = ppCsvCell(naming.form_factor || 'unknown');
  const temp = ppCsvCell(naming.temperature || '');
  const cRate = ppCsvCell([naming.charge_c_rate, naming.discharge_c_rate].filter(Boolean).join('/') || 'unknown');
  const used = new Set();
  const rows = files.map((file, index) => {
    let cellId = ppCellIdFromSourceFile(file, index);
    if (used.has(cellId)) cellId = cellId + '_' + String(index + 1).padStart(3, '0');
    used.add(cellId);
    return ppCsvCell(cellId) + ',' + ppCsvCell(file) + ',1,999,unassigned,' + chemistry + ',' + formFactor + ',,,' + temp + ',unknown,unknown,' + cRate + ',,';
  });
  return [
    'cell_id,source_file,start_cycle,end_cycle,split_tag,chemistry,form_factor,nominal_capacity_Ah,nominal_voltage_V,temperature_C,charge_protocol,discharge_protocol,C_rate,cutoff_voltage_upper,cutoff_voltage_lower'
  ].concat(rows).join('\n') + '\n';
}

function ppReadmeMd(config) {
  const root = ppPackageName(config.adapter, config.dataset_id);
  return `# BatteryLake preprocessing package

This package converts original battery cycling source data into the fixed BatteryLake processed-dataset format used by the Benchmark page.

If you select \`BatteryArchive processed CSV\`, the package only validates and repackages files that are already in BatteryLake-like schema. That adapter is a passthrough check, not a raw-source conversion.

This preprocessing package can process multiple cells in one run. Each selected source file is treated as exactly one cell, and the output cell_id is generated from that file name.

## Put data here

Copy the selected cell source files into:

\`\`\`
${root}/raw/
\`\`\`

Keep the same file names that were selected in the browser. Do not put multiple cells inside one source file.

## Run locally

\`\`\`bash
cd ${root}
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Step A: inspect original source labels first
python scripts/inspect_raw.py --raw raw --out outputs/raw_inventory.json --columns-out outputs/raw_columns.csv --schema-out outputs/raw_schema.json
open outputs/raw_columns.csv

# Step B: edit schema/column_map.csv
# Map source labels to:
#   voltage_V      = V(t)
#   current_A      = I(t)
#   temperature_C  = T(t)
#   time_s         = time
#   cycle_id       = cycle index

# Step C: convert and validate
bash run_preprocessing.sh
\`\`\`

## Output

The run writes:

\`\`\`
outputs/processed_dataset/
outputs/preprocessing_report.json
\`\`\`

Upload \`outputs/preprocessing_report.json\` back to the Preprocessing page. If the report says \`benchmark_ready: true\`, copy the whole \`outputs/processed_dataset/\` folder into the Benchmark training package under \`data/<dataset_name>/\`.
`;
}

function ppRequirementsTxt(config) {
  return ['numpy>=1.24', 'pandas>=2.0', 'scipy>=1.10', 'h5py>=3.8', 'openpyxl>=3.1'].join('\n') + '\n';
}

function ppRunPreprocessingSh() {
  return `#!/usr/bin/env bash
set -euo pipefail

mkdir -p outputs
python scripts/inspect_raw.py --raw raw --out outputs/raw_inventory.json --columns-out outputs/raw_columns.csv --schema-out outputs/raw_schema.json
python scripts/convert.py --config config.json
python scripts/validate_outputs.py --config config.json --data outputs/processed_dataset --out outputs/preprocessing_report.json
python scripts/export_report.py --report outputs/preprocessing_report.json
`;
}

function ppInspectRawPy() {
  return `#!/usr/bin/env python3
import argparse
import csv
import json
from collections import Counter
from pathlib import Path


def delimited_header(path):
    sample = ""
    try:
        with Path(path).open("r", encoding="utf-8-sig", newline="") as f:
            sample = f.read(4096)
    except UnicodeDecodeError:
        with Path(path).open("r", encoding="latin-1", newline="") as f:
            sample = f.read(4096)
    if Path(path).suffix.lower() in (".txt", ".tsv", ".001"):
        dialect = csv.excel_tab
    else:
        try:
            dialect = csv.Sniffer().sniff(sample, delimiters=",\\t;|")
        except csv.Error:
            dialect = csv.excel
    lines = sample.splitlines()
    for line in lines[:80]:
        cells = [cell.strip() for cell in next(csv.reader([line], dialect), [])]
        if {"Rec", "Cycle", "Step"}.issubset(set(cells)) or {"Test Time", "Current", "Voltage"}.issubset(set(cells)):
            return cells
    return next(csv.reader(lines, dialect), [])


def xlsx_headers(path):
    try:
        import pandas as pd
        workbook = pd.ExcelFile(path)
        rows = []
        for sheet in workbook.sheet_names:
            frame = pd.read_excel(path, sheet_name=sheet, nrows=0)
            rows.append({"sheet": sheet, "columns": list(frame.columns)})
        return rows
    except Exception as exc:
        return [{"sheet": "", "columns": ["ERROR: " + str(exc)]}]


def unique_preserve(items, limit=400):
    seen = set()
    out = []
    for item in items:
        text = str(item)
        if text and text not in seen:
            seen.add(text)
            out.append(text)
        if len(out) >= limit:
            break
    return out


def mat_field_paths(obj, prefix="", depth=0):
    if depth > 6:
        return [prefix] if prefix else []
    if isinstance(obj, dict):
        paths = []
        for key, value in obj.items():
            key = str(key)
            if key.startswith("__"):
                continue
            child = prefix + "." + key if prefix else key
            paths.extend(mat_field_paths(value, child, depth + 1))
        return unique_preserve(paths)
    if isinstance(obj, (list, tuple)):
        paths = []
        child = prefix + "[]" if prefix else "[]"
        for value in list(obj)[:3]:
            paths.extend(mat_field_paths(value, child, depth + 1))
        return unique_preserve(paths) or ([child] if prefix else [])
    dtype = getattr(obj, "dtype", None)
    if dtype is not None and getattr(dtype, "names", None):
        paths = []
        for name in dtype.names:
            child = prefix + "." + str(name) if prefix else str(name)
            try:
                value = obj[name]
            except Exception:
                value = None
            paths.extend(mat_field_paths(value, child, depth + 1))
        return unique_preserve(paths)
    if dtype is not None and str(dtype) == "object" and getattr(obj, "size", 0):
        paths = []
        for value in list(obj.flat)[:3]:
            paths.extend(mat_field_paths(value, prefix, depth + 1))
        return unique_preserve(paths) or ([prefix] if prefix else [])
    return [prefix] if prefix else []


def mat_keys(path):
    try:
        from scipy.io import loadmat
        mat = loadmat(path, simplify_cells=True)
        paths = []
        for key, value in mat.items():
            if not str(key).startswith("__"):
                paths.extend(mat_field_paths(value, str(key)))
        return unique_preserve(paths)
    except Exception as exc:
        return ["ERROR: " + str(exc)]


def inspect_columns(raw, files):
    rows = []
    for path in files:
        suffix = path.suffix.lower()
        rel = str(path.relative_to(raw))
        if suffix in (".csv", ".txt", ".tsv", ".001"):
            rows.append({"file": rel, "type": suffix.lstrip("."), "sheet": "", "columns": delimited_header(path)})
        elif suffix in (".xlsx", ".xls"):
            for sheet in xlsx_headers(path):
                rows.append({"file": rel, "type": suffix.lstrip("."), "sheet": sheet["sheet"], "columns": sheet["columns"]})
        elif suffix == ".mat":
            rows.append({"file": rel, "type": "mat", "sheet": "", "columns": mat_keys(path)})
    return rows


def source_entries(raw, rows):
    data_rows = [row for row in rows if row.get("type") in ("csv", "txt", "tsv", "001", "mat")]
    folders = {}
    for row in data_rows:
        parent = str(Path(row["file"]).parent)
        if parent in ("", "."):
            continue
        folders.setdefault(parent, []).append(row)
    grouped = []
    for folder, members in sorted(folders.items()):
        if len(members) < 2:
            continue
        cols = []
        for member in members:
            cols.extend(member.get("columns") or [])
        grouped.append({
            "path": folder,
            "type": "folder",
            "file_count": len(members),
            "columns": unique_preserve(cols)
        })
    if grouped:
        return grouped
    return [
        {
            "path": row["file"],
            "type": row["type"],
            "file_count": 1,
            "columns": row.get("columns") or []
        }
        for row in data_rows
    ]


def write_raw_columns(path, rows):
    out = Path(path)
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["file", "type", "sheet", "columns"])
        writer.writeheader()
        for row in rows:
            writer.writerow({
                "file": row["file"],
                "type": row["type"],
                "sheet": row["sheet"],
                "columns": " | ".join(map(str, row["columns"]))
            })


def write_raw_schema(path, raw, rows, files, ext, source_format):
    payload = {
        "schema_version": "raw-schema-v1",
        "raw_root": str(raw.resolve()),
        "source_format": source_format,
        "file_count": len(files),
        "extensions": dict(sorted(ext.items())),
        "source_entries": source_entries(raw, rows),
        "files": [
            {
                "path": row["file"],
                "type": row["type"],
                "sheet": row["sheet"],
                "columns": list(map(str, row["columns"]))
            }
            for row in rows
        ]
    }
    out = Path(path)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--raw", default=".")
    parser.add_argument("--format", default="auto", choices=["auto", "csv_folder", "excel_workbook", "matlab_mat", "processed_csv"])
    parser.add_argument("--out", default="outputs/raw_inventory.json")
    parser.add_argument("--columns-out", default="outputs/raw_columns.csv")
    parser.add_argument("--schema-out", default="outputs/raw_schema.json")
    args = parser.parse_args()
    raw = Path(args.raw).expanduser()
    if not raw.exists() or not raw.is_dir():
        parser.error("The selected folder does not exist: " + str(raw))
    all_files = [p for p in raw.rglob("*") if p.is_file() and not p.name.startswith(".") and "README" not in p.name.upper()]
    if not all_files:
        parser.error("No source files found in the selected folder: " + str(raw))
    allowed = {
        "csv_folder": {".csv", ".txt", ".tsv", ".001"},
        "processed_csv": {".csv", ".txt", ".tsv", ".001"},
        "excel_workbook": {".xlsx", ".xls"},
        "matlab_mat": {".mat"}
    }.get(args.format)
    files = all_files
    if allowed:
        files = [p for p in all_files if p.suffix.lower() in allowed]
        if not files:
            found = sorted(set(p.suffix.lower() or "<none>" for p in all_files))
            parser.error(
                "No files matching --format " + args.format
                + ". Expected extensions: " + ", ".join(sorted(allowed))
                + ". Found extensions: " + ", ".join(found)
            )
    ext = Counter(p.suffix.lower() or "<none>" for p in files)
    column_rows = inspect_columns(raw, files)
    report = {
        "raw_root": str(raw.resolve()),
        "file_count": len(files),
        "extensions": dict(sorted(ext.items())),
        "sample_files": [str(p.relative_to(raw)) for p in files[:30]],
        "column_preview_file": args.columns_out,
        "source_format": args.format
    }
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")
    write_raw_columns(args.columns_out, column_rows)
    write_raw_schema(args.schema_out, raw, column_rows, files, ext, args.format)
    print("Raw inventory:", len(files), "files")
    print("Raw column preview:", args.columns_out)
    print("Raw schema:", args.schema_out)


if __name__ == "__main__":
    main()
`;
}

function ppConvertPy() {
  return `#!/usr/bin/env python3
import argparse
import importlib
import json
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default="config.json")
    args = parser.parse_args()
    config_path = Path(args.config)
    config = json.loads(config_path.read_text(encoding="utf-8"))
    adapter = config["adapter"]
    module = importlib.import_module("adapters." + adapter)
    raw_root = ROOT / config.get("raw_root", "raw")
    schema_root = ROOT / config.get("schema_root", "schema")
    out_root = ROOT / config.get("output_root", "outputs/processed_dataset")
    out_root.mkdir(parents=True, exist_ok=True)
    manifest = module.convert(raw_root, schema_root, out_root, config)
    manifest_path = ROOT / "outputs" / "conversion_manifest.json"
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print("Converted dataset:", manifest.get("dataset_id"), "->", out_root)


if __name__ == "__main__":
    main()
`;
}

function ppValidateOutputsPy() {
  return `#!/usr/bin/env python3
import argparse
import csv
import json
from pathlib import Path


def read_header(path):
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        return next(csv.reader(f), [])


def count_rows(path):
    with path.open("r", encoding="utf-8", errors="ignore") as f:
        return max(0, sum(1 for _ in f) - 1)


def validate_group(files, required, label, errors):
    rows = 0
    for path in files:
        header = read_header(path)
        if header != required:
            missing = [c for c in required if c not in header]
            extra = [c for c in header if c not in required]
            errors.append({"file": str(path), "type": label, "missing": missing, "extra": extra})
        rows += count_rows(path)
    return rows


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", default="config.json")
    parser.add_argument("--data", default="outputs/processed_dataset")
    parser.add_argument("--out", default="outputs/preprocessing_report.json")
    args = parser.parse_args()
    config = json.loads(Path(args.config).read_text(encoding="utf-8"))
    data = Path(args.data)
    ts_cols = config["time_series_columns"]
    cs_cols = config["cycle_summary_columns"]
    md_cols = config["metadata_columns"]
    ts_files = sorted(data.rglob("*_timeseries.csv"))
    cs_files = sorted(data.rglob("*_cycle_summary.csv"))
    md_files = sorted([p for p in data.rglob("*.csv") if "metadata" in p.name.lower()])
    errors = []
    if not ts_files:
        errors.append({"type": "time_series", "message": "No *_timeseries.csv files found."})
    if not cs_files:
        errors.append({"type": "cycle_summary", "message": "No *_cycle_summary.csv files found."})
    if not md_files:
        errors.append({"type": "metadata", "message": "No metadata CSV file found."})
    ts_rows = validate_group(ts_files, ts_cols, "time_series", errors)
    cs_rows = validate_group(cs_files, cs_cols, "cycle_summary", errors)
    md_rows = validate_group(md_files, md_cols, "metadata", errors)
    cells = set()
    for path in md_files:
        try:
            with path.open("r", encoding="utf-8-sig", newline="") as f:
                for row in csv.DictReader(f):
                    if row.get("cell_id"):
                        cells.add(row["cell_id"])
        except Exception:
            pass
    report = {
        "dataset_id": config["dataset_id"],
        "adapter": config["adapter"],
        "status": "pass" if not errors else "fail",
        "benchmark_ready": not errors,
        "data_root": str(data),
        "counts": {
            "time_series_files": len(ts_files),
            "cycle_summary_files": len(cs_files),
            "metadata_files": len(md_files),
            "time_series_rows": ts_rows,
            "cycle_summary_rows": cs_rows,
            "metadata_rows": md_rows,
            "cells": len(cells)
        },
        "errors": errors
    }
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print("Validation status:", report["status"])
    if errors:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
`;
}

function ppExportReportPy() {
  return `#!/usr/bin/env python3
import argparse
import json
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--report", default="outputs/preprocessing_report.json")
    args = parser.parse_args()
    report = json.loads(Path(args.report).read_text(encoding="utf-8"))
    counts = report.get("counts", {})
    print("")
    print("BatteryLake preprocessing report")
    print("Dataset:", report.get("dataset_id"))
    print("Adapter:", report.get("adapter"))
    print("Status:", report.get("status"))
    print("Benchmark ready:", report.get("benchmark_ready"))
    print("Time-series files:", counts.get("time_series_files", 0))
    print("Cycle-summary files:", counts.get("cycle_summary_files", 0))
    print("Metadata rows:", counts.get("metadata_rows", 0))
    print("")
    print("Upload this file in the Preprocessing page:", args.report)


if __name__ == "__main__":
    main()
`;
}

function ppBatteryarchiveAdapterPy() {
  return `import csv
import json
import shutil
from pathlib import Path

import pandas as pd


TS_COLUMNS = ${JSON.stringify(PP_TS_COLUMNS)}
CYCLE_COLUMNS = ${JSON.stringify(PP_CYCLE_COLUMNS)}
METADATA_COLUMNS = ${JSON.stringify(PP_METADATA_COLUMNS)}


def read_header(path):
    with Path(path).open("r", encoding="utf-8-sig", newline="") as f:
        return next(csv.reader(f), [])


def unique_dest(out_root, source):
    name = source.name
    dest = out_root / name
    if not dest.exists():
        return dest
    stem = source.stem
    suffix = source.suffix
    parent = source.parent.name.replace(" ", "_")
    return out_root / ("%s__%s%s" % (parent, stem, suffix))


def copy_csv(source, dest):
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, dest)


def write_metadata(source, out_root, config, used_name):
    df = pd.read_csv(source)
    for col in METADATA_COLUMNS:
        if col not in df.columns:
            df[col] = ""
    df = df[METADATA_COLUMNS]
    df["dataset_id"] = config["dataset_id"]
    dest = out_root / ("dataset_metadata.csv" if not used_name else source.name)
    df.to_csv(dest, index=False)
    return dest


def convert(raw_root, schema_root, out_root, config):
    csv_files = sorted([p for p in Path(raw_root).rglob("*.csv") if not p.name.startswith(".")])
    copied = {"time_series": [], "cycle_summary": [], "metadata": []}
    metadata_written = False
    for path in csv_files:
        header = read_header(path)
        if header == TS_COLUMNS:
            dest = unique_dest(out_root, path)
            copy_csv(path, dest)
            copied["time_series"].append(str(dest.relative_to(out_root)))
        elif header == CYCLE_COLUMNS:
            dest = unique_dest(out_root, path)
            copy_csv(path, dest)
            copied["cycle_summary"].append(str(dest.relative_to(out_root)))
        elif header == METADATA_COLUMNS or "metadata" in path.name.lower():
            dest = write_metadata(path, out_root, config, metadata_written)
            metadata_written = True
            copied["metadata"].append(str(dest.relative_to(out_root)))
    if not metadata_written and copied["time_series"]:
        cells = []
        for rel in copied["time_series"]:
            cell = Path(rel).name.replace("_timeseries.csv", "")
            cells.append(cell)
        rows = []
        for cell in sorted(cells):
            rows.append({
                "dataset_id": config["dataset_id"], "cell_id": cell, "source_type": "local",
                "split_tag": "unassigned", "chemistry": "unknown", "cathode_material": "unknown",
                "anode_material": "unknown", "brand_or_manufacturer": "unknown",
                "model_or_size": "unknown", "form_factor": "unknown",
                "nominal_capacity_Ah": "", "nominal_voltage_V": "", "temperature_C": "",
                "charge_protocol": "unknown", "discharge_protocol": "unknown", "C_rate": "unknown",
                "cutoff_voltage_upper": "", "cutoff_voltage_lower": ""
            })
        pd.DataFrame(rows, columns=METADATA_COLUMNS).to_csv(out_root / "dataset_metadata.csv", index=False)
        copied["metadata"].append("dataset_metadata.csv")
    return {"dataset_id": config["dataset_id"], "adapter": "batteryarchive_csv", "copied": copied}
`;
}

function ppGenericCsvAdapterPy() {
  return `from pathlib import Path
import re

import numpy as np
import pandas as pd


TS_COLUMNS = ${JSON.stringify(PP_TS_COLUMNS)}
CYCLE_COLUMNS = ${JSON.stringify(PP_CYCLE_COLUMNS)}
METADATA_COLUMNS = ${JSON.stringify(PP_METADATA_COLUMNS)}


def find_source_path(raw_root, name):
    target = Path(name)
    if target.is_absolute() and target.exists():
        return target
    direct = Path(raw_root) / name
    if direct.exists():
        return direct
    matches = [p for p in Path(raw_root).rglob(target.name)]
    if not matches:
        raise FileNotFoundError("Cannot find source_file listed in cell_ranges.csv: %s" % name)
    return matches[0]


def supported_raw_file(path):
    return path.is_file() and (not path.name.startswith(".")) and path.suffix.lower() in (".csv", ".txt", ".tsv", ".001")


def source_files(source):
    source = Path(source)
    if source.is_dir():
        return sorted([p for p in source.rglob("*") if supported_raw_file(p) and "README" not in p.name.upper()])
    return [source]


def header_info(path):
    try:
        lines = Path(path).read_text(encoding="utf-8-sig", errors="replace").splitlines()
    except Exception:
        lines = Path(path).read_text(encoding="latin-1", errors="replace").splitlines()
    sep = "\\t" if Path(path).suffix.lower() in (".txt", ".tsv", ".001") else ","
    for idx, line in enumerate(lines[:120]):
        cells = [cell.strip() for cell in line.split(sep)]
        if {"Rec", "Cycle", "Step"}.issubset(set(cells)) or {"Test Time", "Current", "Voltage"}.issubset(set(cells)):
            return idx, sep, "\\n".join(lines[:idx])
    return 0, sep, "\\n".join(lines[:8])


def read_raw_table(path):
    skiprows, sep, _ = header_info(path)
    if sep == "\\t":
        lines = Path(path).read_text(encoding="latin-1", errors="replace").splitlines()
        header = [col.strip() for col in lines[skiprows].split("\\t")]
        width = len(header)
        rows = []
        for line in lines[skiprows + 1:]:
            parts = line.split("\\t")
            if len(parts) < width:
                parts = parts + [""] * (width - len(parts))
            elif len(parts) > width:
                parts = parts[:width]
            rows.append(parts)
        raw = pd.DataFrame(rows, columns=header)
    else:
        raw = pd.read_csv(path, sep=sep, skiprows=skiprows, encoding="latin-1", engine="python")
    raw = raw.loc[:, ~raw.columns.astype(str).str.match(r"^Unnamed")]
    raw.columns = [str(col).strip() for col in raw.columns]
    return raw


def infer_temperature(path, fallback=""):
    _, _, meta = header_info(path)
    text = meta + "\\n" + str(path)
    matches = re.findall(r"(-?\\d+(?:\\.\\d+)?)\\s*(?:deg|°C)", text, flags=re.I)
    if matches:
        try:
            return float(matches[-1])
        except Exception:
            pass
    fallback_text = str(fallback or "")
    token = re.search(r"(-?\\d+(?:\\.\\d+)?)\\s*T$", fallback_text, flags=re.I)
    if token:
        try:
            return float(token.group(1))
        except Exception:
            pass
    return np.nan


def time_to_seconds(values, unit=""):
    if pd.api.types.is_numeric_dtype(values):
        return pd.to_numeric(values, errors="coerce") * unit_factor(unit)
    text = values.astype(str).str.strip()
    parsed = text.str.extract(r"(?:(\\d+)\\s*d)?\\s*(\\d+):([0-5]?\\d):([0-9]+(?:\\.\\d+)?)")
    if parsed.notna().any(axis=None):
        days = pd.to_numeric(parsed[0], errors="coerce").fillna(0)
        hours = pd.to_numeric(parsed[1], errors="coerce").fillna(0)
        minutes = pd.to_numeric(parsed[2], errors="coerce").fillna(0)
        seconds = pd.to_numeric(parsed[3], errors="coerce").fillna(0)
        return days * 86400.0 + hours * 3600.0 + minutes * 60.0 + seconds
    return pd.to_numeric(values, errors="coerce") * unit_factor(unit)


def unit_factor(unit):
    unit = str(unit or "").strip().lower()
    return {
        "ms": 0.001, "millisecond": 0.001,
        "min": 60.0, "minute": 60.0,
        "h": 3600.0, "hr": 3600.0, "hour": 3600.0,
        "mv": 0.001,
        "ma": 0.001,
        "k": 1.0
    }.get(unit, 1.0)


def normalize_temperature(values, unit):
    unit = str(unit or "").strip().lower()
    if unit == "k":
        return values - 273.15
    return values


def load_column_map(schema_root):
    path = Path(schema_root) / "column_map.csv"
    df = pd.read_csv(path).fillna("")
    return {row["canonical_column"]: row for _, row in df.iterrows() if row.get("source_column")}


def is_placeholder(value):
    value = str(value or "").strip()
    return (not value) or value.startswith("replace_with_")


def require_source_mappings(raw, mapping, source):
    required = ["cycle_id", "time_s", "voltage_V", "current_A"]
    missing = []
    for canonical in required:
        row = mapping.get(canonical)
        source_column = str(row.get("source_column", "")).strip() if row is not None else ""
        if is_placeholder(source_column):
            missing.append("%s -> <not mapped>" % canonical)
        elif source_column not in raw.columns:
            missing.append("%s -> %s (not found)" % (canonical, source_column))
    if missing:
        raise ValueError(
            "column_map.csv must map raw labels to I/V/T and cycle fields before conversion. "
            "Run scripts/inspect_raw.py and use outputs/raw_columns.csv to fill mappings for %s. Missing: %s"
            % (source, "; ".join(missing))
        )


def build_timeseries(raw, mapping, cell_id, start_cycle, end_cycle, source_path="", file_index=0, cycle_offset=0, temperature_value=np.nan):
    out = pd.DataFrame()
    for canonical in TS_COLUMNS:
        row = mapping.get(canonical)
        if row is not None and row["source_column"] in raw.columns:
            series = raw[row["source_column"]]
            if canonical not in ("cell_id", "step_type"):
                if canonical == "time_s":
                    series = time_to_seconds(series, row.get("unit"))
                else:
                    series = pd.to_numeric(series, errors="coerce")
                    series = series * unit_factor(row.get("unit"))
                if canonical == "temperature_C":
                    series = normalize_temperature(series, row.get("unit"))
            out[canonical] = series
        else:
            out[canonical] = np.nan
    out["cell_id"] = cell_id
    if out["cycle_id"].isna().all():
        out["cycle_id"] = file_index + 1
    out["cycle_id"] = pd.to_numeric(out["cycle_id"], errors="coerce")
    if out["cycle_id"].nunique(dropna=True) <= 1:
        # Prefer inferring cycle boundaries over collapsing the whole file to one cycle.
        inferred = pd.Series(np.ones(len(out), dtype=int), index=out.index)
        t = pd.to_numeric(out["time_s"], errors="coerce")
        if t.notna().any():
            resets = t.diff() < -1.0
            if int(resets.fillna(False).sum()) > 0:
                inferred = resets.fillna(False).cumsum() + 1
        if int(inferred.nunique()) <= 1:
            for col in ("discharge_capacity_Ah", "charge_capacity_Ah"):
                if col not in out.columns:
                    continue
                cap = pd.to_numeric(out[col], errors="coerce")
                drops = cap.diff() < -0.5
                if int(drops.fillna(False).sum()) > 0:
                    inferred = drops.fillna(False).cumsum() + 1
                    break
        if int(inferred.nunique()) <= 1 and "step_type" in out.columns:
            st = out["step_type"].astype(str).str.lower()
            is_d = st.eq("discharge")
            starts = is_d & ~is_d.shift(fill_value=False)
            if int(starts.sum()) > 1:
                inferred = starts.cumsum().replace(0, 1)
        if int(inferred.nunique()) > 1:
            out["cycle_id"] = inferred.astype(int) + int(cycle_offset)
        else:
            out["cycle_id"] = (int(cycle_offset) + 1) if cycle_offset else (file_index + 1)
    else:
        out["cycle_id"] = out["cycle_id"].fillna(1).astype(int) + cycle_offset
    out["cycle_id"] = pd.to_numeric(out["cycle_id"], errors="coerce").fillna(1).astype(int)
    if start_cycle:
        out = out[out["cycle_id"] >= int(start_cycle)]
    if end_cycle:
        out = out[out["cycle_id"] <= int(end_cycle)]
    if "MD" in raw.columns and out["step_type"].isna().all():
        mode = raw["MD"].astype(str).str.strip().str.upper()
        out["step_type"] = np.where(mode.eq("C"), "charge", np.where(mode.eq("D"), "discharge", np.where(mode.eq("R"), "rest", "unknown")))
        current = pd.to_numeric(out["current_A"], errors="coerce")
        out.loc[mode.eq("D"), "current_A"] = -current[mode.eq("D")].abs()
        out.loc[mode.eq("C"), "current_A"] = current[mode.eq("C")].abs()
        out.loc[mode.eq("R"), "current_A"] = 0.0
    else:
        out["step_type"] = out["step_type"].fillna("unknown").astype(str)
        current = pd.to_numeric(out["current_A"], errors="coerce")
        out.loc[current > 0, "step_type"] = out.loc[current > 0, "step_type"].replace("unknown", "charge")
        out.loc[current < 0, "step_type"] = out.loc[current < 0, "step_type"].replace("unknown", "discharge")
    if out["temperature_C"].isna().all() and temperature_value == temperature_value:
        out["temperature_C"] = float(temperature_value)
    if "Capacity" in raw.columns:
        cap = pd.to_numeric(raw["Capacity"], errors="coerce")
        out.loc[out["step_type"].eq("charge"), "charge_capacity_Ah"] = cap[out["step_type"].eq("charge")]
        out.loc[out["step_type"].eq("discharge"), "discharge_capacity_Ah"] = cap[out["step_type"].eq("discharge")]
    for col in ["charge_capacity_Ah", "discharge_capacity_Ah"]:
        out[col] = pd.to_numeric(out[col], errors="coerce")
    return out[TS_COLUMNS]


def cycle_summary(ts):
    rows = []
    for cycle_id, g in ts.groupby("cycle_id", sort=True):
        g = g.sort_values("time_s")
        t = pd.to_numeric(g["time_s"], errors="coerce").to_numpy(float)
        i = pd.to_numeric(g["current_A"], errors="coerce").to_numpy(float)
        if len(t) > 1:
            dt = np.diff(t)
            cur = 0.5 * (i[:-1] + i[1:])
            discharge = float(np.nansum(np.maximum(-cur, 0) * dt) / 3600.0)
            charge = float(np.nansum(np.maximum(cur, 0) * dt) / 3600.0)
        else:
            discharge = np.nan
            charge = np.nan
        capacity = float(np.nanmax(g["discharge_capacity_Ah"])) if g["discharge_capacity_Ah"].notna().any() else discharge
        rows.append({
            "cell_id": g["cell_id"].iloc[0], "cycle_id": int(cycle_id), "step_type": "cycle",
            "capacity_Ah": capacity, "SOH": np.nan, "RUL": np.nan,
            "charge_capacity_Ah": charge, "discharge_capacity_Ah": discharge,
            "temperature_max_C": float(pd.to_numeric(g["temperature_C"], errors="coerce").max()),
            "temperature_avg_C": float(pd.to_numeric(g["temperature_C"], errors="coerce").mean()),
            "charge_duration_s": np.nan, "discharge_duration_s": np.nan,
            "internal_resistance_Ohm": np.nan, "cycle_end_flag": 1
        })
    out = pd.DataFrame(rows, columns=CYCLE_COLUMNS)
    if len(out):
        first = out["capacity_Ah"].replace(0, np.nan).dropna()
        ref = float(first.iloc[0]) if len(first) else np.nan
        out["SOH"] = out["capacity_Ah"] / ref if ref == ref else np.nan
        out["RUL"] = len(out) - out["cycle_id"].rank(method="dense").astype(int)
    return out


def metadata_row(config, range_row):
    row = {col: "" for col in METADATA_COLUMNS}
    row.update({
        "dataset_id": config["dataset_id"],
        "cell_id": range_row["cell_id"],
        "source_type": "local",
        "split_tag": range_row.get("split_tag", "unassigned"),
        "chemistry": range_row.get("chemistry", "unknown"),
        "form_factor": range_row.get("form_factor", "unknown"),
        "nominal_capacity_Ah": range_row.get("nominal_capacity_Ah", ""),
        "nominal_voltage_V": range_row.get("nominal_voltage_V", ""),
        "temperature_C": range_row.get("temperature_C", ""),
        "charge_protocol": range_row.get("charge_protocol", "unknown"),
        "discharge_protocol": range_row.get("discharge_protocol", "unknown"),
        "C_rate": range_row.get("C_rate", "unknown"),
        "cutoff_voltage_upper": range_row.get("cutoff_voltage_upper", ""),
        "cutoff_voltage_lower": range_row.get("cutoff_voltage_lower", "")
    })
    return row


def convert(raw_root, schema_root, out_root, config):
    mapping = load_column_map(schema_root)
    ranges = pd.read_csv(Path(schema_root) / "cell_ranges.csv").fillna("")
    metadata = []
    created = []
    for _, row in ranges.iterrows():
        source = find_source_path(raw_root, row["source_file"])
        frames = []
        cycle_offset = 0
        for file_index, source_file in enumerate(source_files(source)):
            raw = read_raw_table(source_file)
            require_source_mappings(raw, mapping, source_file)
            temp = infer_temperature(source_file, row.get("temperature_C", ""))
            ts_part = build_timeseries(
                raw, mapping, row["cell_id"], row.get("start_cycle"), row.get("end_cycle"),
                source_path=source_file, file_index=file_index, cycle_offset=cycle_offset, temperature_value=temp
            )
            if len(ts_part):
                cycle_offset = int(pd.to_numeric(ts_part["cycle_id"], errors="coerce").max())
                frames.append(ts_part)
        if not frames:
            raise ValueError("No supported raw files found under source_file: %s" % source)
        ts = pd.concat(frames, ignore_index=True)
        ts_name = "%s_timeseries.csv" % row["cell_id"]
        cs_name = "%s_cycle_summary.csv" % row["cell_id"]
        ts.to_csv(Path(out_root) / ts_name, index=False)
        cycle_summary(ts).to_csv(Path(out_root) / cs_name, index=False)
        metadata.append(metadata_row(config, row))
        created.extend([ts_name, cs_name])
    pd.DataFrame(metadata, columns=METADATA_COLUMNS).to_csv(Path(out_root) / "dataset_metadata.csv", index=False)
    return {"dataset_id": config["dataset_id"], "adapter": "generic_csv_ranges", "created": created}
`;
}

function ppMatlabAdapterPy() {
  return `from pathlib import Path
import re

import numpy as np
import pandas as pd
from scipy.io import loadmat


TS_COLUMNS = ${JSON.stringify(PP_TS_COLUMNS)}
CYCLE_COLUMNS = ${JSON.stringify(PP_CYCLE_COLUMNS)}
METADATA_COLUMNS = ${JSON.stringify(PP_METADATA_COLUMNS)}


def as_list(value):
    if value is None:
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, np.ndarray):
        return list(value.ravel())
    return [value]


def arr(data, *names):
    for name in names:
        if isinstance(data, dict) and name in data:
            value = data[name]
            return np.asarray(value).ravel()
    return np.array([])


def scalar(data, *names):
    values = arr(data, *names)
    if len(values):
        try:
            return float(values[0])
        except Exception:
            return np.nan
    return np.nan


def find_file(raw_root, name):
    target = Path(str(name or ""))
    if target.is_absolute() and target.exists():
        return target
    direct = Path(raw_root) / target
    if direct.exists():
        return direct
    matches = [p for p in Path(raw_root).rglob(target.name) if p.is_file()]
    if not matches:
        raise FileNotFoundError("Cannot find selected source_file: %s" % name)
    return matches[0]


def find_cycle_container(mat):
    for value in mat.values():
        if isinstance(value, dict) and "cycle" in value:
            return value
    return None


def numeric_arr(data, *names):
    values = arr(data, *names)
    if not len(values):
        return np.array([])
    return pd.to_numeric(pd.Series(values), errors="coerce").to_numpy(float)


def monotonic_seconds_from_minutes(values):
    raw = np.asarray(values, dtype=float).ravel()
    if not len(raw):
        return np.array([])
    out = np.zeros(len(raw), dtype=float)
    offset = 0.0
    prev = raw[0]
    out[0] = raw[0]
    for idx in range(1, len(raw)):
        value = raw[idx]
        if value + 1e-9 < prev:
            offset += prev
        out[idx] = value + offset
        prev = value
    return out * 60.0


def summary_value(summary, key, index):
    if not isinstance(summary, dict) or key not in summary:
        return np.nan
    values = np.asarray(summary.get(key)).ravel()
    if index >= len(values):
        return np.nan
    try:
        return float(values[index])
    except Exception:
        return np.nan


def safe_nan_stat(values, fn):
    arr_values = np.asarray(values, dtype=float)
    if not len(arr_values) or np.isnan(arr_values).all():
        return np.nan
    return float(fn(arr_values))


def duration_by_sign(time_s, current, sign):
    if len(time_s) < 2:
        return np.nan
    if sign == "charge":
        mask = current[:-1] > 0.01
    else:
        mask = current[:-1] < -0.01
    dt = np.diff(time_s)
    return float(np.nansum(dt[mask])) if len(dt) else np.nan


def convert_data_list_cell(path, out_root, config, cell_id, mat):
    data_items = [item for item in as_list(mat.get("data")) if isinstance(item, dict)]
    if not data_items:
        raise ValueError("No Batch-style data[] cycles found in %s" % path.name)
    summary = mat.get("summary", {})
    ts_path = Path(out_root) / ("%s_timeseries.csv" % cell_id)
    cs_path = Path(out_root) / ("%s_cycle_summary.csv" % cell_id)
    if ts_path.exists():
        ts_path.unlink()
    cs_rows = []
    wrote_header = False
    for index, item in enumerate(data_items):
        cycle_id = index + 1
        time_min = numeric_arr(item, "relative_time_min", "time_min", "Time", "time")
        voltage = numeric_arr(item, "voltage_V", "Voltage_measured", "Voltage")
        current = numeric_arr(item, "current_A", "Current_measured", "Current")
        temp = numeric_arr(item, "temperature_C", "Temperature_measured", "Temperature")
        capacity = numeric_arr(item, "capacity_Ah", "Capacity")
        if not len(time_min) or not len(voltage) or not len(current):
            continue
        n = min(len(time_min), len(voltage), len(current), len(temp) if len(temp) else len(time_min), len(capacity) if len(capacity) else len(time_min))
        time_s = monotonic_seconds_from_minutes(time_min[:n])
        voltage = voltage[:n]
        current = current[:n]
        temp = temp[:n] if len(temp) else np.full(n, np.nan)
        capacity = capacity[:n] if len(capacity) else np.full(n, np.nan)
        step_type = np.where(current > 0.01, "charge", np.where(current < -0.01, "discharge", "rest"))
        charge_capacity = np.where(current > 0.01, capacity, np.nan)
        discharge_capacity = np.where(current < -0.01, capacity, np.nan)
        ts = pd.DataFrame({
            "cell_id": cell_id,
            "cycle_id": cycle_id,
            "time_s": time_s,
            "voltage_V": voltage,
            "current_A": current,
            "temperature_C": temp,
            "charge_capacity_Ah": charge_capacity,
            "discharge_capacity_Ah": discharge_capacity,
            "step_type": step_type
        }, columns=TS_COLUMNS)
        ts.to_csv(ts_path, mode="a", header=not wrote_header, index=False)
        wrote_header = True
        charge_cap = summary_value(summary, "charge_capacity_Ah", index)
        discharge_cap = summary_value(summary, "discharge_capacity_Ah", index)
        if discharge_cap != discharge_cap and len(time_s) > 1:
            dt = np.diff(time_s)
            cur = 0.5 * (current[:-1] + current[1:])
            discharge_cap = float(np.nansum(np.maximum(-cur, 0) * dt) / 3600.0)
        if charge_cap != charge_cap and len(time_s) > 1:
            dt = np.diff(time_s)
            cur = 0.5 * (current[:-1] + current[1:])
            charge_cap = float(np.nansum(np.maximum(cur, 0) * dt) / 3600.0)
        cs_rows.append({
            "cell_id": cell_id, "cycle_id": cycle_id, "step_type": "cycle",
            "capacity_Ah": discharge_cap, "SOH": np.nan, "RUL": np.nan,
            "charge_capacity_Ah": charge_cap, "discharge_capacity_Ah": discharge_cap,
            "temperature_max_C": safe_nan_stat(temp, np.nanmax),
            "temperature_avg_C": safe_nan_stat(temp, np.nanmean),
            "charge_duration_s": duration_by_sign(time_s, current, "charge"),
            "discharge_duration_s": duration_by_sign(time_s, current, "discharge"),
            "internal_resistance_Ohm": np.nan, "cycle_end_flag": 1
        })
    if not wrote_header:
        raise ValueError("No usable Batch-style voltage/current/time arrays found in %s" % path.name)
    cs = pd.DataFrame(cs_rows, columns=CYCLE_COLUMNS)
    ref = cs["capacity_Ah"].replace(0, np.nan).dropna()
    if len(ref):
        cs["SOH"] = cs["capacity_Ah"] / float(ref.iloc[0])
    cs["RUL"] = len(cs) - cs["cycle_id"].rank(method="dense").astype(int)
    cs.to_csv(cs_path, index=False)
    return cell_id


def cell_id_from_path(path, index):
    stem = Path(path).stem
    clean = re.sub(r"[^A-Za-z0-9_.-]+", "_", stem).strip("_")
    return clean or ("cell_%03d" % (index + 1))


def convert_one(path, out_root, config, cell_id):
    mat = loadmat(path, simplify_cells=True)
    root = find_cycle_container(mat)
    if not root:
        if mat.get("data") is not None:
            return convert_data_list_cell(path, out_root, config, cell_id, mat)
        raise ValueError("No NASA-like cycle structure found in %s" % path.name)
    ts_rows = []
    cs_rows = []
    discharge_caps = []
    cycle_number = 0
    for cycle in as_list(root.get("cycle")):
        if not isinstance(cycle, dict):
            continue
        cycle_number += 1
        step_type = str(cycle.get("type", "unknown"))
        data = cycle.get("data", {})
        time_s = arr(data, "Time", "time")
        voltage = arr(data, "Voltage_measured", "voltage_V", "Voltage")
        current = arr(data, "Current_measured", "current_A", "Current")
        temp = arr(data, "Temperature_measured", "temperature_C", "Temperature")
        if not len(time_s) or not len(voltage) or not len(current):
            continue
        n = min(len(time_s), len(voltage), len(current), len(temp) if len(temp) else len(time_s))
        if not len(temp):
            temp = np.full(n, np.nan)
        for idx in range(n):
            ts_rows.append({
                "cell_id": cell_id, "cycle_id": cycle_number, "time_s": float(time_s[idx]),
                "voltage_V": float(voltage[idx]), "current_A": float(current[idx]),
                "temperature_C": float(temp[idx]), "charge_capacity_Ah": np.nan,
                "discharge_capacity_Ah": np.nan, "step_type": step_type
            })
        cap = scalar(data, "Capacity", "capacity_Ah")
        if cap != cap and n > 1:
            dt = np.diff(time_s[:n])
            cur = 0.5 * (current[:n-1] + current[1:n])
            cap = float(np.nansum(np.maximum(-cur, 0) * dt) / 3600.0)
        if step_type.lower() == "discharge" and cap == cap:
            discharge_caps.append(cap)
        cs_rows.append({
            "cell_id": cell_id, "cycle_id": cycle_number, "step_type": step_type,
            "capacity_Ah": cap, "SOH": np.nan, "RUL": np.nan,
            "charge_capacity_Ah": np.nan, "discharge_capacity_Ah": cap,
            "temperature_max_C": float(np.nanmax(temp[:n])) if n else np.nan,
            "temperature_avg_C": float(np.nanmean(temp[:n])) if n else np.nan,
            "charge_duration_s": np.nan, "discharge_duration_s": float(time_s[n-1] - time_s[0]) if n > 1 else np.nan,
            "internal_resistance_Ohm": np.nan, "cycle_end_flag": 1
        })
    if not ts_rows:
        raise ValueError("No usable voltage/current/time arrays found in %s" % path.name)
    ts = pd.DataFrame(ts_rows, columns=TS_COLUMNS)
    cs = pd.DataFrame(cs_rows, columns=CYCLE_COLUMNS)
    ref = discharge_caps[0] if discharge_caps else np.nan
    if ref == ref and ref != 0:
        cs["SOH"] = cs["capacity_Ah"] / ref
    cs["RUL"] = len(cs) - cs["cycle_id"].rank(method="dense").astype(int)
    ts.to_csv(Path(out_root) / ("%s_timeseries.csv" % cell_id), index=False)
    cs.to_csv(Path(out_root) / ("%s_cycle_summary.csv" % cell_id), index=False)
    return cell_id


def convert(raw_root, schema_root, out_root, config):
    selected = config.get("source_files") or []
    if not selected and config.get("source_file"):
        selected = [config.get("source_file")]
    if selected:
        mat_files = [find_file(raw_root, name) for name in selected]
    else:
        mat_files = sorted([p for p in Path(raw_root).rglob("*.mat") if p.is_file()])
    if not mat_files:
        raise FileNotFoundError("No .mat files found under raw/.")
    cells = []
    used = set()
    for index, path in enumerate(mat_files):
        cell_id = cell_id_from_path(path, index)
        if cell_id in used:
            cell_id = "%s_%03d" % (cell_id, index + 1)
        used.add(cell_id)
        cells.append(convert_one(path, out_root, config, cell_id))
    rows = []
    naming = config.get("naming", {})
    for cell_id in cells:
        rows.append({
            "dataset_id": config["dataset_id"], "cell_id": cell_id, "source_type": "local",
            "split_tag": "unassigned", "chemistry": naming.get("chemistry", "unknown"), "cathode_material": "unknown",
            "anode_material": "unknown", "brand_or_manufacturer": "unknown", "model_or_size": "unknown",
            "form_factor": naming.get("form_factor", "unknown"), "nominal_capacity_Ah": "", "nominal_voltage_V": "",
            "temperature_C": naming.get("temperature", ""), "charge_protocol": "unknown", "discharge_protocol": "unknown",
            "C_rate": (str(naming.get("charge_c_rate", "")) + "/" + str(naming.get("discharge_c_rate", ""))).strip("/"), "cutoff_voltage_upper": "", "cutoff_voltage_lower": ""
        })
    pd.DataFrame(rows, columns=METADATA_COLUMNS).to_csv(Path(out_root) / "dataset_metadata.csv", index=False)
    return {"dataset_id": config["dataset_id"], "adapter": "matlab_mat", "cells": cells}
`;
}

function ppInspectReadmeMd(config) {
  const root = ppInspectPackageName(config.source_format, config.dataset_id);
  return `# BatteryLake raw title inspector

This package only reads source file titles, CSV/Excel headers, and MATLAB keys.
It does not convert, clean, train, or upload raw data.

## Put data here

\`\`\`
${root}/raw/<original_dataset_folder>/
\`\`\`

## Run

\`\`\`bash
cd ${root}
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
bash run_inspect.sh
\`\`\`

## Upload back to the web page

\`\`\`
outputs/raw_schema.json
\`\`\`

The web page uses this small JSON file to build the I/V/T mapping dropdowns.
`;
}

function ppRunInspectSh() {
  return `#!/usr/bin/env bash
set -euo pipefail

mkdir -p outputs
python scripts/inspect_raw.py --raw raw --out outputs/raw_inventory.json --columns-out outputs/raw_columns.csv --schema-out outputs/raw_schema.json
`;
}

function ppBuildInspectPackageFiles(root, config) {
  return [
    { name: root + '/README.md', data: ppInspectReadmeMd(config) },
    { name: root + '/config.json', data: JSON.stringify(config, null, 2) + '\n' },
    { name: root + '/requirements.txt', data: ppRequirementsTxt(config) },
    { name: root + '/run_inspect.sh', data: ppRunInspectSh() },
    { name: root + '/raw/', data: '' },
    { name: root + '/outputs/', data: '' },
    { name: root + '/scripts/inspect_raw.py', data: ppInspectRawPy() }
  ];
}

function ppDownloadInspectPackage() {
  const config = ppCurrentConfig();
  const blob = new Blob([ppInspectRawPy()], { type: 'text/x-python;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'inspect_batterylake_titles.py';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast('Inspect script downloaded: ' + a.download, 'success');
}

function ppPopulateSourceFileSelect() {
  const select = document.getElementById('pp-source-file-select');
  if (!select) return;
  const files = ppRawFileNames();
  select.innerHTML = files.length
    ? files.map(file => `<option value="${esc(file)}" selected>${esc(file)}</option>`).join('')
    : '<option value="">Upload raw_schema first</option>';
  ppUpdatePackagePreview();
}

function ppRenderRawSchema(schema) {
  const files = ppRawSchemaFiles();
  const columns = ppSchemaColumns();
  const summary = document.getElementById('pp-raw-schema-summary');
  if (summary) {
    if (!files.length) {
      summary.textContent = [
        'No source files detected in raw_schema.json.',
        'Check that Terminal is opened in the original dataset folder.',
        'Check that --format matches the file type: csv_folder, excel_workbook, or matlab_mat.'
      ].join('\n');
    } else {
      summary.textContent = [
        'files: ' + files.length,
        'variables: ' + columns.length,
        'first_file: ' + (ppFirstRawFile() || '-'),
        'selected_files: ' + ppSelectedSourceFiles().length,
        'sample_variables: ' + columns.slice(0, 12).join(', ')
      ].join('\n');
    }
  }
  const sourceFile = document.getElementById('pp2-source-file-preview');
  if (sourceFile) sourceFile.value = ppSelectedSourceFilesLabel(ppSelectedSourceFiles());
}

function ppPopulateMappingSelectors() {
  const cols = ppSchemaColumns();
  ppSetSelectOptions(document.getElementById('pp-map-time'), cols, ppGuessColumn(cols, ['times', 'testtime', 'time', 'timestamp', 'seconds']));
  ppSetSelectOptions(document.getElementById('pp-map-voltage'), cols, ppGuessColumn(cols, ['voltagev', 'voltagemeasured', 'voltage', 'volt', 'v']));
  ppSetSelectOptions(document.getElementById('pp-map-current'), cols, ppGuessColumn(cols, ['currenta', 'currentmeasured', 'current', 'curr', 'i']));
  ppSetSelectOptions(document.getElementById('pp-map-temperature'), cols, ppGuessColumn(cols, ['temperaturec', 'temperaturemeasured', 'temperature', 'temp', 't']));
  ppSetSelectOptions(document.getElementById('pp-map-cycle'), cols, ppGuessColumn(cols, ['cycleindex', 'cycleid', 'cycle']));
  ppSetSelectOptions(document.getElementById('pp-map-cell'), cols, ppGuessColumn(cols, ['cellid', 'barcode', 'cell']));
  ppPopulateSourceFileSelect();
  ppUpdatePackagePreview();
}

async function ppHandleRawSchemaUpload(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  try {
    const schema = JSON.parse(await file.text());
    PP.rawSchema = schema;
    ppPopulateMappingSelectors();
    ppRenderRawSchema(schema);
    ppUpdatePackagePreview();
    if (!ppRawSchemaFiles().length) {
      showToast('raw_schema.json has 0 files. Re-run inspect inside the dataset folder with the correct --format.', 'error');
    } else {
      showToast('Raw schema loaded. Choose I/V/T mappings next.', 'success');
    }
  } catch (err) {
    showToast('Cannot read this raw_schema.json.', 'error');
  }
}

function ppBuildPackageFiles(root, config) {
  const manifest = Object.assign({
    raw_root: 'raw',
    schema_root: 'schema',
    output_root: 'outputs/processed_dataset',
    time_series_columns: PP_TS_COLUMNS,
    cycle_summary_columns: PP_CYCLE_COLUMNS,
    metadata_columns: PP_METADATA_COLUMNS
  }, config || ppCurrentConfig());
  return [
    { name: root + '/README.md', data: ppReadmeMd(manifest) },
    { name: root + '/config.json', data: JSON.stringify(manifest, null, 2) + '\n' },
    { name: root + '/requirements.txt', data: ppRequirementsTxt(manifest) },
    { name: root + '/run_preprocessing.sh', data: ppRunPreprocessingSh() },
    { name: root + '/raw/', data: '' },
    { name: root + '/outputs/', data: '' },
    { name: root + '/schema/batterylake_schema.json', data: ppSchemaJson(manifest) },
    { name: root + '/schema/column_map.csv', data: ppColumnMapCsv(manifest) },
    { name: root + '/schema/cell_ranges.csv', data: ppCellRangesCsv(manifest) },
    { name: root + '/scripts/inspect_raw.py', data: ppInspectRawPy() },
    { name: root + '/scripts/convert.py', data: ppConvertPy() },
    { name: root + '/scripts/validate_outputs.py', data: ppValidateOutputsPy() },
    { name: root + '/scripts/export_report.py', data: ppExportReportPy() },
    { name: root + '/adapters/__init__.py', data: '' },
    { name: root + '/adapters/batteryarchive_csv.py', data: ppBatteryarchiveAdapterPy() },
    { name: root + '/adapters/generic_csv_ranges.py', data: ppGenericCsvAdapterPy() },
    { name: root + '/adapters/matlab_mat.py', data: ppMatlabAdapterPy() }
  ];
}

function ppDownloadPackage() {
  const config = ppCurrentConfig();
  if (!config.dataset_id || config.dataset_id === 'YYYY_SOURCE_CHEMISTRY_FORMFACTOR_CHRGC_DCHRG_TEMPT') {
    showToast('Fill the dataset naming fields before downloading the skill.', 'error');
    return;
  }
  if (!config.cell_count || config.cell_count < 1) {
    showToast('Cell count must be at least 1.', 'error');
    return;
  }
  const root = ppSkillRootName();
  const packageName = ppSkillPackageName(config.dataset_id);
  const blob = bwZipBlob(ppBuildSkillFiles(root, config));
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = packageName + '.zip';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  if (window.BatteryLakeAnalytics && typeof window.BatteryLakeAnalytics.trackSkillDownload === 'function') {
    window.BatteryLakeAnalytics.trackSkillDownload({ skill_source: 'preprocessing_skill' });
  }
  showToast('BatteryLake skill generated: ' + a.download, 'success');
}

function ppRenderReport(report) {
  const counts = report && report.counts ? report.counts : {};
  const reportSummaryLines = [
    'dataset_id: ' + (report.dataset_id || '-'),
    'adapter: ' + (report.adapter || '-'),
    'status: ' + (report.status || '-'),
    'benchmark_ready: ' + String(!!report.benchmark_ready),
    'time_series_files: ' + (counts.time_series_files || 0),
    'cycle_summary_files: ' + (counts.cycle_summary_files || 0),
    'metadata_rows: ' + (counts.metadata_rows || 0),
    'errors: ' + ((report.errors || []).length)
  ].join('\n');
  const verifySummaryLines = [
    'dataset_id: ' + (report.dataset_id || '-'),
    'status: ' + (report.status || '-'),
    'benchmark_ready: ' + String(!!report.benchmark_ready),
    'cells: ' + (counts.cells || 0),
    'time_series_files: ' + (counts.time_series_files || 0),
    'cycle_summary_files: ' + (counts.cycle_summary_files || 0),
    'metadata_rows: ' + (counts.metadata_rows || 0),
    'warnings: ' + ((report.warnings || []).length),
    'errors: ' + ((report.errors || []).length)
  ].join('\n');

  const gate = document.getElementById('pp-report-gate');
  const ready = document.getElementById('pp-report-ready');
  const status = document.getElementById('pp-report-status');
  const summary = document.getElementById('pp-report-summary');
  if (gate) gate.value = report.status || 'unknown';
  if (ready) ready.value = report.benchmark_ready ? 'Yes' : 'No';
  if (status) status.textContent = report.status || 'loaded';
  if (summary) summary.textContent = reportSummaryLines;

  const summary2 = document.getElementById('pp2-report-summary');
  if (summary2) summary2.textContent = reportSummaryLines;

  const prepReportSummary = document.getElementById('prepReportSummary');
  if (prepReportSummary) prepReportSummary.textContent = reportSummaryLines;

  const verifyStatus = document.getElementById('pp2-verify-status') || document.getElementById('prepVerifyStatus');
  const verifyReady = document.getElementById('pp2-verify-ready') || document.getElementById('prepVerifyReady');
  const verifySummary = document.getElementById('pp2-verification-summary') || document.getElementById('prepVerificationSummary');
  if (verifyStatus) verifyStatus.value = report.status || 'unknown';
  if (verifyReady) verifyReady.value = report.benchmark_ready ? 'Yes' : 'No';
  if (verifySummary) verifySummary.textContent = verifySummaryLines;
}

async function ppHandleReportUpload(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  try {
    const report = JSON.parse(await file.text());
    PP.report = report;
    ppRenderReport(report);
    const panel = document.querySelector('#page-preprocessing [data-pp-panel="4"]');
    const uploadCheck = panel && panel.querySelector('.pp-check');
    if (uploadCheck && !uploadCheck.classList.contains('done')) ppToggleCheck(uploadCheck);
    const message = 'Preprocessing report loaded.';
    if (typeof prepToast === 'function') prepToast(message);
    showToast(message, report.benchmark_ready ? 'success' : 'info');
  } catch (err) {
    if (typeof prepToast === 'function') prepToast('Cannot read this report JSON.');
    showToast('Cannot read this report JSON.', 'error');
  }
}

