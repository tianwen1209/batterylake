/* ═══════════════════════════════════════════════════════════════
   BatteryLake quality engine (browser port of quality/quality_assessment.py)

   Computes a real data-quality report for a battery cycling dataset from
   parsed rows, in the exact schema the Quality Assessment page renders:
     four dimensions  completeness · consistency · accuracy · validity
     six checks       voltage_range · energy_balance · capacity_mono ·
                      temperature_consistency · timestamp_integrity ·
                      current_direction
   Keep the rules here in step with the Python engine so browser results and
   precomputed quality_reports/*.json agree.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var COLUMN_ALIASES = {
    voltage: ['voltage_v', 'voltage', 'volt', 'v', 'ecell_v', 'u', 'cell_voltage'],
    current: ['current_a', 'current', 'curr', 'i', 'amp', 'cell_current'],
    temperature: ['temperature_c', 'temperature', 'temp', 'temp_c', 't', 'cell_temp', 'surface_temp'],
    capacity: ['capacity_ah', 'capacity', 'cap', 'q', 'qd', 'discharge_capacity_ah', 'discharge_capacity', 'q_discharge'],
    charge_capacity: ['charge_capacity_ah', 'charge_capacity', 'q_charge', 'qc'],
    coulombic_efficiency: ['coulombic_efficiency', 'ce', 'efficiency', 'coulombic_eff'],
    // BatteryLake v2 canonical time series carry elapsed_test_s (seconds) and,
    // for some sources, an ISO `timestamp` string; either works here.
    timestamp: ['timestamp', 'elapsed_test_s', 'time_s', 'test_time_s', 'time', 'test_time', 't_s', 'elapsed_time', 'datetime', 'date_time'],
    cycle: ['cycle_number', 'cycle', 'cycle_index', 'source_cycle_id', 'cycle_id', 'cyc', 'cycle_no', 'cycle_count', 'n'],
    // Grouping column: monotonicity / timestamp checks run per cell, not across concatenated cells.
    cell: ['cell_id', 'physical_cell_id', 'entity_id', 'cell', 'battery_id', 'cell_name', 'source_id']
  };

  var VOLTAGE_WINDOWS = {
    LFP: [2.0, 3.8],
    LCO: [2.5, 4.3],
    NMC: [2.5, 4.35],
    NMC811: [2.5, 4.35],
    NCA: [2.5, 4.3],
    _default: [2.0, 4.5]
  };

  var CHECK_DEFS = [
    ['voltage_range', 'Voltage Range Validation', 'All cell voltages within nominal operating range for the stated chemistry.'],
    ['energy_balance', 'Energy Balance Check', 'Charge/discharge energy integral consistency; coulombic efficiency within 95-105% per cycle.'],
    ['capacity_mono', 'Capacity Monotonicity', 'Degradation trajectory follows expected non-increasing trend with allowable recovery windows.'],
    ['temperature_consistency', 'Temperature Consistency', 'Cell surface temperature stays within 5°C of the stated test condition.'],
    ['timestamp_integrity', 'Timestamp Integrity', 'Monotonically increasing timestamps with no negative intervals or gaps above 24h.'],
    ['current_direction', 'Current Direction Consistency', 'Charge and discharge current signs follow one convention throughout the dataset.']
  ];

  var EXPECTED_CHANNELS = ['voltage', 'current', 'temperature', 'capacity', 'timestamp'];
  var WARN_THRESHOLD = 0.995;
  /* Per-check pass floors: physical channels are noisy by nature (cells heat up
     under load, coulombic efficiency scatters around 1). Keep in step with Python. */
  var CHECK_PASS_MIN = {
    voltage_range: 0.995,
    energy_balance: 0.95,
    capacity_mono: 0.98,
    temperature_consistency: 0.90,
    timestamp_integrity: 0.995,
    current_direction: 0.995
  };

  /* ── helpers ─────────────────────────────────────────────────── */
  function isMissing(v) {
    return v === null || v === undefined || v === '' || (typeof v === 'number' && Number.isNaN(v));
  }
  function toNumber(v) {
    if (typeof v === 'number') return v;
    if (typeof v === 'boolean' || isMissing(v)) return NaN;
    var n = Number(String(v).trim());
    return Number.isFinite(n) ? n : NaN;
  }
  /** Finite numeric values of a column (pandas to_numeric(...).dropna()). */
  function numeric(rows, col) {
    var out = [];
    for (var i = 0; i < rows.length; i++) {
      var n = toNumber(rows[i][col]);
      if (Number.isFinite(n)) out.push(n);
    }
    return out;
  }
  function mean(arr) {
    if (!arr.length) return NaN;
    var s = 0;
    for (var i = 0; i < arr.length; i++) s += arr[i];
    return s / arr.length;
  }
  function median(arr) {
    if (!arr.length) return NaN;
    var a = arr.slice().sort(function (x, y) { return x - y; });
    var mid = a.length >> 1;
    return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
  }
  function fraction(arr, pred) {
    if (!arr.length) return NaN;
    var c = 0;
    for (var i = 0; i < arr.length; i++) if (pred(arr[i])) c++;
    return c / arr.length;
  }
  function clamp01(x) {
    if (x === null || x === undefined || Number.isNaN(x)) return 0;
    return Math.max(0, Math.min(1, x));
  }
  function round2(x) { return Math.round(x * 100) / 100; }
  function round4(x) { return Math.round(x * 10000) / 10000; }
  function pct(x) { return (x * 100).toFixed(1) + '%'; }

  /* The first alias that exists *and holds at least one non-null value* wins, so an
     all-empty `timestamp` column does not shadow a populated `elapsed_test_s`. */
  function resolveColumns(columns, rows) {
    var lookup = {};
    columns.forEach(function (c) {
      var key = String(c).toLowerCase().trim();
      if (!(key in lookup)) lookup[key] = c;
    });
    function hasValue(col) {
      if (!rows || !rows.length) return true;
      var n = Math.min(rows.length, 5000);
      for (var i = 0; i < n; i++) if (!isMissing(rows[i][col])) return true;
      for (var j = n; j < rows.length; j += 97) if (!isMissing(rows[j][col])) return true;
      return false;
    }
    var resolved = {};
    Object.keys(COLUMN_ALIASES).forEach(function (canonical) {
      var aliases = COLUMN_ALIASES[canonical];
      for (var i = 0; i < aliases.length; i++) {
        if (!(aliases[i] in lookup)) continue;
        var col = lookup[aliases[i]];
        if (hasValue(col)) { resolved[canonical] = col; break; }
      }
      // A column that exists but is entirely empty counts as absent.
    });
    return resolved;
  }

  /* Split rows per cell (or one group when no cell column / single cell). */
  function groups(rows, cols) {
    if (!cols.cell) return [rows];
    var map = new Map();
    for (var i = 0; i < rows.length; i++) {
      var k = rows[i][cols.cell];
      if (isMissing(k)) continue;
      k = String(k);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(rows[i]);
    }
    return map.size > 1 ? Array.from(map.values()) : [rows];
  }

  function inferChemistry(datasetId) {
    if (!datasetId) return '_default';
    var up = String(datasetId).toUpperCase();
    var order = ['NMC811', 'LFP', 'LCO', 'NCA', 'NMC'];
    for (var i = 0; i < order.length; i++) if (up.indexOf(order[i]) >= 0) return order[i];
    return '_default';
  }

  /* ── the six checks: each returns null (skipped) or [ratio, note] ── */
  function checkVoltageRange(rows, cols, chem) {
    if (!cols.voltage) return null;
    var v = numeric(rows, cols.voltage);
    if (!v.length) return null;
    var win = VOLTAGE_WINDOWS[chem] || VOLTAGE_WINDOWS._default;
    var within = fraction(v, function (x) { return x >= win[0] && x <= win[1]; });
    return [within, pct(within) + ' within ' + win[0] + '-' + win[1] + 'V'];
  }

  function checkEnergyBalance(rows, cols) {
    var ce = null;
    if (cols.coulombic_efficiency) {
      ce = numeric(rows, cols.coulombic_efficiency);
      if (ce.length && median(ce) > 2) ce = ce.map(function (x) { return x / 100; });
    } else if (cols.capacity && cols.charge_capacity) {
      ce = [];
      if (cols.cycle) {
        // Time series: capacities accumulate within a cycle, so compare the
        // per-cycle (per-cell) maxima rather than row-by-row values.
        var agg = new Map();
        for (var i = 0; i < rows.length; i++) {
          var qd0 = toNumber(rows[i][cols.capacity]);
          var qc0 = toNumber(rows[i][cols.charge_capacity]);
          if (!Number.isFinite(qd0) || !Number.isFinite(qc0)) continue;
          var key = (cols.cell ? String(rows[i][cols.cell]) : '') + '|' + String(rows[i][cols.cycle]);
          var cur = agg.get(key);
          if (!cur) agg.set(key, [qd0, qc0]);
          else { if (qd0 > cur[0]) cur[0] = qd0; if (qc0 > cur[1]) cur[1] = qc0; }
        }
        agg.forEach(function (v) { if (v[0] > 0 && v[1] > 0) ce.push(v[0] / v[1]); });
      } else {
        for (var j = 0; j < rows.length; j++) {
          var qd = toNumber(rows[j][cols.capacity]);
          var qc = toNumber(rows[j][cols.charge_capacity]);
          var r = qd / qc;
          if (Number.isFinite(r)) ce.push(r);
        }
      }
    }
    if (!ce || !ce.length) return null;
    var within = fraction(ce, function (x) { return x >= 0.95 && x <= 1.05; });
    return [within, pct(within) + ' of ' + ce.length + ' cycles CE in 95-105%'];
  }

  function capacityMonoOne(rows, cols) {
    var series;
    if (cols.cycle) {
      var byCycle = new Map();
      for (var i = 0; i < rows.length; i++) {
        var c = toNumber(rows[i][cols.cycle]);
        var q = toNumber(rows[i][cols.capacity]);
        if (!Number.isFinite(c) || !Number.isFinite(q)) continue;
        if (!byCycle.has(c) || byCycle.get(c) < q) byCycle.set(c, q);
      }
      series = Array.from(byCycle.keys()).sort(function (a, b) { return a - b; }).map(function (k) { return byCycle.get(k); });
    } else {
      series = numeric(rows, cols.capacity);
    }
    if (series.length < 3) return [0, 0];
    var tol = series[0] ? 0.02 * Math.abs(series[0]) : 0;
    var rises = 0;
    for (var j = 1; j < series.length; j++) if (series[j] - series[j - 1] > tol) rises++;
    return [rises, series.length - 1];
  }

  function checkCapacityMono(rows, cols) {
    if (!cols.capacity) return null;
    var rises = 0, steps = 0;
    groups(rows, cols).forEach(function (g) { var r = capacityMonoOne(g, cols); rises += r[0]; steps += r[1]; });
    if (steps < 2) return null;
    var ok = 1 - rises / Math.max(1, steps);
    return [ok, rises + ' non-monotonic step(s) over ' + (steps + 1) + ' cycles'];
  }

  function checkTemperatureConsistency(rows, cols) {
    if (!cols.temperature) return null;
    var t = numeric(rows, cols.temperature);
    if (!t.length) return null;
    var nominal = median(t);
    var within = fraction(t, function (x) { return Math.abs(x - nominal) <= 5; });
    return [within, pct(within) + ' within +/-5C of ' + nominal.toFixed(1) + 'C'];
  }

  function timestampSeconds(rows, col) {
    var ts = numeric(rows, col);
    if (ts.length < 3) {
      // Maybe a datetime string column: parse to seconds.
      ts = [];
      for (var i = 0; i < rows.length; i++) {
        var v = rows[i][col];
        if (isMissing(v)) continue;
        var ms = Date.parse(String(v));
        if (Number.isFinite(ms)) ts.push(ms / 1000);
      }
    }
    return ts;
  }

  function timestampOne(rows, cols) {
    var ts = timestampSeconds(rows, cols.timestamp);
    if (ts.length < 3) return [0, 0, 0];
    var dt = [];
    for (var j = 1; j < ts.length; j++) dt.push(ts[j] - ts[j - 1]);
    var negatives = dt.filter(function (d) { return d < 0; }).length;
    var absMedian = median(dt.map(Math.abs));
    var bigGaps = absMedian < 3600 ? dt.filter(function (d) { return d > 24 * 3600; }).length : 0;
    return [negatives, bigGaps, dt.length];
  }

  function checkTimestampIntegrity(rows, cols) {
    if (!cols.timestamp) return null;
    var negatives = 0, bigGaps = 0, intervals = 0;
    groups(rows, cols).forEach(function (g) { var r = timestampOne(g, cols); negatives += r[0]; bigGaps += r[1]; intervals += r[2]; });
    if (intervals < 2) return null;
    var ok = 1 - (negatives + bigGaps) / Math.max(1, intervals);
    return [ok, negatives + ' negative interval(s), ' + bigGaps + ' large gap(s)'];
  }

  function checkCurrentDirection(rows, cols) {
    if (!cols.current) return null;
    var cur = numeric(rows, cols.current);
    if (!cur.length) return null;
    var pos = fraction(cur, function (x) { return x > 0; });
    var neg = fraction(cur, function (x) { return x < 0; });
    if (!(pos > 0 && neg > 0)) return [0.5, 'only one current sign present'];
    // Both directions present. Flag only a pathological split (< 2% of non-zero
    // samples in one direction), which usually means a sign-convention change.
    var nz = cur.filter(function (x) { return x !== 0; });
    var p = fraction(nz, function (x) { return x > 0; });
    var n = fraction(nz, function (x) { return x < 0; });
    var minority = nz.length ? Math.min(p, n) : 0;
    if (minority < 0.02) return [0.9, 'one direction is only ' + (minority * 100).toFixed(1) + '% of non-zero samples'];
    return [1, 'charge ' + Math.round(p * 100) + '% / discharge ' + Math.round(n * 100) + '% of non-zero samples'];
  }

  var CHECK_FUNCS = {
    voltage_range: checkVoltageRange,
    energy_balance: function (rows, cols) { return checkEnergyBalance(rows, cols); },
    capacity_mono: function (rows, cols) { return checkCapacityMono(rows, cols); },
    temperature_consistency: function (rows, cols) { return checkTemperatureConsistency(rows, cols); },
    timestamp_integrity: function (rows, cols) { return checkTimestampIntegrity(rows, cols); },
    current_direction: function (rows, cols) { return checkCurrentDirection(rows, cols); }
  };

  /* ── dimension scores ────────────────────────────────────────── */
  function scoreCompleteness(rows, cols) {
    var present = EXPECTED_CHANNELS.filter(function (ch) { return cols[ch]; });
    var channelScore = present.length / EXPECTED_CHANNELS.length;
    var nonNull = 1;
    if (present.length && rows.length) {
      var missing = 0;
      for (var i = 0; i < rows.length; i++) {
        for (var k = 0; k < present.length; k++) if (isMissing(rows[i][cols[present[k]]])) missing++;
      }
      nonNull = 1 - missing / (rows.length * present.length);
    }
    return clamp01(0.5 * channelScore + 0.5 * nonNull);
  }

  function scoreValidity(rows, cols) {
    var required = ['voltage', 'current'];
    var have = required.filter(function (r) { return cols[r]; }).length;
    var presence = have / required.length;
    var finiteRatios = [];
    ['voltage', 'current', 'temperature', 'capacity'].forEach(function (ch) {
      if (!cols[ch]) return;
      finiteRatios.push(rows.length ? numeric(rows, cols[ch]).length / rows.length : 1);
    });
    var finite = finiteRatios.length ? mean(finiteRatios) : 1;
    return clamp01(0.5 * presence + 0.5 * finite);
  }

  /* Plain counts behind the four cards (shown in the card footers). */
  function metrics(rows, cols, ratios, notes) {
    var present = EXPECTED_CHANNELS.filter(function (ch) { return cols[ch]; });
    var missing = 0;
    if (present.length && rows.length) {
      for (var i = 0; i < rows.length; i++) for (var k = 0; k < present.length; k++) if (isMissing(rows[i][cols[present[k]]])) missing++;
    }
    var cells = 1;
    if (cols.cell) {
      var set = new Set();
      for (var j = 0; j < rows.length; j++) { var v = rows[j][cols.cell]; if (!isMissing(v)) set.add(String(v)); }
      cells = Math.max(1, set.size);
    }
    var seq = 0;
    ['timestamp_integrity', 'capacity_mono'].forEach(function (key) {
      var m = String(notes[key] || '').match(/(\d+) (?:negative|large|non-monotonic)/g) || [];
      m.forEach(function (x) { seq += parseInt(x, 10) || 0; });
    });
    if (ratios.current_direction !== null && ratios.current_direction !== undefined && ratios.current_direction < 0.9) seq += 1;
    var schema = ['voltage', 'current'].filter(function (r) { return !cols[r]; }).length;
    ['voltage', 'current', 'temperature', 'capacity'].forEach(function (ch) {
      if (!cols[ch]) return;
      for (var r = 0; r < rows.length; r++) { var val = rows[r][cols[ch]]; if (!isMissing(val) && !Number.isFinite(toNumber(val))) schema++; }
    });
    return {
      n_rows: rows.length,
      n_cells: cells,
      channels_present: present,
      channels_missing: EXPECTED_CHANNELS.filter(function (ch) { return !cols[ch]; }),
      missing_pct: Math.round((present.length && rows.length ? missing / (rows.length * present.length) * 100 : 0) * 100) / 100,
      sequence_flags: seq,
      schema_errors: schema
    };
  }

  function meanOfAvailable(ratios, keys) {
    var vals = keys.filter(function (k) { return ratios[k] !== null && ratios[k] !== undefined; }).map(function (k) { return ratios[k]; });
    return vals.length ? clamp01(mean(vals)) : 0.9;
  }

  /* ── public entry point ──────────────────────────────────────── */
  /**
   * rows: array of objects (one per record). options: { datasetId, fileName, chemistry, columns }
   */
  function assessRows(rows, options) {
    options = options || {};
    rows = Array.isArray(rows) ? rows : [];
    var columns = options.columns || (rows.length ? Object.keys(rows[0]) : []);
    var cols = resolveColumns(columns, rows);
    var datasetId = options.datasetId || 'uploaded_dataset';
    var chem = String(options.chemistry || inferChemistry(datasetId)).toUpperCase();
    if (!(chem in VOLTAGE_WINDOWS)) chem = '_default';

    var ratios = {};
    var notes = {};
    CHECK_DEFS.forEach(function (def) {
      var key = def[0];
      var result = null;
      try { result = CHECK_FUNCS[key](rows, cols, chem); } catch (_) { result = null; }
      if (!result) { ratios[key] = null; notes[key] = 'channel not available — skipped'; }
      else { ratios[key] = result[0]; notes[key] = result[1]; }
    });

    var checksDetail = CHECK_DEFS.map(function (def) {
      var key = def[0];
      var ratio = ratios[key];
      var status = (ratio === null || ratio >= (CHECK_PASS_MIN[key] || WARN_THRESHOLD)) ? 'pass' : 'warn';
      return { key: key, name: def[1], detail: def[2], status: status, score: ratio === null ? null : round4(ratio), note: notes[key] };
    });
    var warnCount = checksDetail.filter(function (c) { return c.status === 'warn'; }).length;

    var dims = {
      completeness: round2(scoreCompleteness(rows, cols)),
      consistency: round2(meanOfAvailable(ratios, ['timestamp_integrity', 'capacity_mono', 'current_direction'])),
      accuracy: round2(meanOfAvailable(ratios, ['voltage_range', 'energy_balance', 'capacity_mono', 'temperature_consistency'])),
      validity: round2(scoreValidity(rows, cols))
    };
    var overall = round2((dims.completeness + dims.consistency + dims.accuracy + dims.validity) / 4);
    var gate = warnCount === 0 ? 'ready' : 'ready_with_warning';
    // Very low scores mean the file is not a usable cycling dataset as-is.
    if (overall < 0.7 || dims.accuracy < 0.5 || dims.validity < 0.6) gate = 'needs_review';

    return {
      dataset_id: datasetId,
      file_name: options.fileName || datasetId,
      chemistry: chem === '_default' ? 'unknown' : chem,
      n_rows: rows.length,
      resolved_columns: cols,
      metrics: metrics(rows, cols, ratios, notes),
      quality_score: dims,
      overall: overall,
      gate: gate,
      checks_detail: checksDetail,
      checks: checksDetail.map(function (c) {
        return c.status === 'pass' ? { name: c.key, passed: true } : { name: c.key, status: 'review' };
      }),
      warn_count: warnCount,
      generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
      source: 'browser'
    };
  }

  var api = {
    assessRows: assessRows,
    resolveColumns: resolveColumns,
    inferChemistry: inferChemistry,
    CHECK_DEFS: CHECK_DEFS,
    COLUMN_ALIASES: COLUMN_ALIASES
  };
  if (typeof window !== 'undefined') window.BatteryLakeQuality = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
