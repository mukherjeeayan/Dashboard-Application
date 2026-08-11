'use strict';

let editorState = {};
let configLocked = false;
let _undoStack = [];
let _undoMax = 20;
let _undoTotalSize = 0;
const _undoSizeLimit = 50 * 1024 * 1024;
function pushUndo() {
  var snapshot;
  try {
    snapshot = JSON.parse(JSON.stringify(editorState));
  } catch (e) { return; }
  var size = new Blob([JSON.stringify(snapshot)]).size;
  if (size > 1024 * 1024 && _undoStack.length >= 3) {
    _undoStack.shift();
    return;
  }
  _undoStack.push(snapshot);
  _undoTotalSize += size;
  while (_undoStack.length > _undoMax || _undoTotalSize > _undoSizeLimit) {
    var removed = _undoStack.shift();
    if (removed) _undoTotalSize -= new Blob([JSON.stringify(removed)]).size || 0;
  }
}
function undoLast() {
  if (_undoStack.length === 0) { showToast('Nothing to undo.'); return; }
  var removed = _undoStack.pop();
  if (removed) _undoTotalSize -= new Blob([JSON.stringify(removed)]).size || 0;
  editorState = removed;
  saveFullState();
  renderConfigSections();
  showToast('Undone last change.');
}

const DEFAULT_CONFIG = {
  general: {
    title: "Operations Review",
    period: "May 2026 (CW22)",
    portfolioOwner: "SAP CRM Team",
    confidentiality: "Confidential \u2014 Internal Use Only",
    reportDate: "",
    lookbackMonths: 6
  },
  stateMappings: {
    resolvedStates: ["Resolved", "Closed", "Completed"],
    openStates: ["New", "In Progress", "On Hold", "Pending"],
    closedStates: ["Closed", "Cancelled", "Resolved", "Completed"]
  },
  priorityMappings: [
    { label: "1 \u2014 Critical", value: 1 },
    { label: "2 \u2014 High", value: 2 },
    { label: "3 \u2014 Moderate", value: 3 },
    { label: "4 \u2014 Low", value: 4 }
  ],
  ragThresholds: {
    sla: { green: 98, amber: 95, invert: true },
    mttr: { green: 20, amber: 30 },
    reopenRate: { green: 3, amber: 5 },
    firstFixRate: { green: 85, amber: 70, invert: true },
    fteLoad: { green: 35, amber: 45 }
  },
  thresholds: {
    respSlaTarget: 90,
    resolSlaTarget: 90,
    mttrTargetHours: 48,
    rfacUnder8wPct: 80,
    rfacUnder12wPct: 90,
    rfacUnder8wDays: 56,
    rfacUnder12wDays: 84,
    prbUnder3mPct: 80,
    prbUnder6mPct: 90,
    prbUnder3mDays: 90,
    prbUnder6mDays: 180,
    nearMissRatio: 0.90,
    escalationThreshold: 1
  },
  emergencyKeywords: ["emergency"],
  knownErrorValues: [true, "true", "1", "Yes"],
  priorityBuckets: [
    { label: "P1/P2", values: [1, 2], color: "red" },
    { label: "P3", values: [3], color: "amber" },
    { label: "P4", values: [4], color: "blue" }
  ],
  ageBuckets: [
    { label: "0-3 wk", maxDays: 21, color: "green" },
    { label: "3-6 wk", maxDays: 42, color: "amber" },
    { label: "6-10 wk", maxDays: 70, color: "purple" },
    { label: ">10 wk", maxDays: null, color: "red" }
  ],
  ticketTypePrefixes: [
    { prefix: "INC", type: "INC" },
    { prefix: "REQ", type: "SR" },
    { prefix: "SR", type: "SR" }
  ],
  validValues: {
    priorities: ["1 — Critical", "2 — High", "3 — Moderate", "4 — Low"],
    incidentStates: ["New", "In Progress", "On Hold", "Resolved", "Closed", "Cancelled", "Completed", "Pending"],
    srStates: ["New", "In Progress", "On Hold", "Resolved", "Closed", "Cancelled", "Completed", "Pending"],
    rfacStates: ["New", "Assess", "Authorize", "Scheduled", "Implement", "Review", "Closed", "Cancelled", "Rejected", "Draft"],
    prbStates: ["New", "Assigned", "Known Error", "Resolution", "Resolved", "Closed", "Cancelled"]
  },
  fteDefaults: {
    sapAMS: 15,
    sapProjects: 8,
    nsAMS: 10,
    nsProjects: 4
  },
  modules: [
    { id: 'crm', name: 'CRM', domain: 'SAP' },
    { id: 'scm', name: 'SCM', domain: 'SAP' },
    { id: 'authOekg', name: 'Auth OEKG', domain: 'SAP' },
    { id: 'authOste', name: 'Auth OSTE', domain: 'SAP' },
    { id: 'ficoOekg', name: 'FICO OEKG', domain: 'SAP' },
    { id: 'ficoOste', name: 'FICO OSTE', domain: 'SAP' },
    { id: 'successFactors', name: 'SuccessFactors', domain: 'SAP' },
    { id: 'integration', name: 'Integration', domain: 'SAP' },
    { id: 'mdg', name: 'MDG', domain: 'SAP' },
    { id: 'bodsBois', name: 'BODS / BOIS', domain: 'SAP' },
    { id: 'bw', name: 'BW', domain: 'SAP' },
    { id: 'cognosQlik', name: 'Cognos / Qlik', domain: 'SAP' },
    { id: 'ace', name: 'ACE', domain: 'NonERP' },
    { id: 'cpq', name: 'CPQ', domain: 'NonERP' },
    { id: 'democenter', name: 'Democenter', domain: 'NonERP' },
    { id: 'corpSol', name: 'Corp Sol', domain: 'NonERP' },
    { id: 'hr', name: 'HR', domain: 'NonERP' },
    { id: 'iam', name: 'IAM', domain: 'NonERP' },
    { id: 'm365', name: 'M365', domain: 'NonERP' },
    { id: 'serNow', name: 'SerNow', domain: 'NonERP' }
  ],
  mappings: {
    'APP-CRM-L2-EMEA': 'crm',
    'APP-SCM-L2-EMEA': 'scm',
    'APP-AUTH-OEKG-L2': 'authOekg',
    'APP-AUTH-OSTE-L2': 'authOste',
    'APP-FICO-OEKG-L2': 'ficoOekg',
    'APP-FICO-OSTE-L2': 'ficoOste',
    'APP-SF-EMEA-L2': 'successFactors',
    'APP-INTEG-CPI-L2': 'integration',
    'APP-MDG-L2': 'mdg',
    'APP-BODS-L2': 'bodsBois',
    'APP-BW-L2': 'bw',
    'APP-COGNOS-L2': 'cognosQlik',
    'APP-ACE-L2': 'ace',
    'APP-CPQ-L2': 'cpq',
    'APP-DEMO-L2': 'democenter',
    'APP-CORPSOL-L2': 'corpSol',
    'APP-HR-L2': 'hr',
    'APP-IAM-L2': 'iam',
    'APP-M365-L2': 'm365',
    'APP-SERNOW-L2': 'serNow'
  },
  baselines: {}
};

for (const m of DEFAULT_CONFIG.modules) {
  DEFAULT_CONFIG.baselines[m.id] = 50;
}

/* ────────────────────────────
   CONFIG RENDER & STATE
──────────────────────────── */

function getConfig() {
  return editorState.config;
}

function deepMergeDefaults(target, defaults) {
  for (const key of Object.keys(defaults)) {
    if (!(key in target)) {
      target[key] = JSON.parse(JSON.stringify(defaults[key]));
    } else if (defaults[key] && typeof defaults[key] === 'object' && !Array.isArray(defaults[key]) && target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) {
      deepMergeDefaults(target[key], defaults[key]);
    }
  }
  return target;
}

function initEditorState() {
  const stored = localStorage.getItem('ops_editor_full_config');
  if (stored) {
    try {
      editorState = JSON.parse(stored);
      editorState = migrateEditorState(editorState);
      if (!editorState.config) editorState.config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
      if (!editorState.uploadedFiles) editorState.uploadedFiles = { incidents: null, service_requests: null, rfac: null, problems: null };
      if (!editorState.manualData) editorState.manualData = {};
      if (!editorState.manualData.headcount) editorState.manualData.headcount = { ...DEFAULT_CONFIG.fteDefaults, releases: [] };
      if (!editorState.calculatedData) editorState.calculatedData = {};
      if (!editorState.visitedSections) editorState.visitedSections = {};
      if (editorState.modules && !editorState.config.modules) {
        editorState.config.modules = editorState.modules;
        editorState.config.mappings = editorState.mappings || {};
        editorState.config.baselines = editorState.baselines || {};
        delete editorState.modules;
        delete editorState.mappings;
        delete editorState.baselines;
      }
      deepMergeDefaults(editorState.config, DEFAULT_CONFIG);
      return;
    } catch (e) {
      console.warn("Failed to parse stored config, using defaults", e);
      localStorage.removeItem('ops_editor_full_config');
    }
  }

  editorState = {
    config: JSON.parse(JSON.stringify(DEFAULT_CONFIG)),
    uploadedFiles: { incidents: null, service_requests: null, rfac: null, problems: null },
    manualData: {
      pulse: { keyFlag: "" },
      actionItems: [],
      escalations: [],
      appreciations: [],
      serviceOffers: [],
      projects: [],
      continuousImprovement: [],
      headcount: { ...DEFAULT_CONFIG.fteDefaults, releases: [] },
      overrides: {},
      modulesNotes: {}
    },
    calculatedData: {},
    visitedSections: {}
  };

  if (!editorState.config.general.reportDate) {
    editorState.config.general.reportDate = new Date().toISOString().split('T')[0];
  }
  saveFullState();
}

var _saveTimer = null;
function saveFullState() {
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(function () {
    _saveTimer = null;
    pushUndo();
    try {
      var _saveState = Object.assign({}, editorState);
      delete _saveState.uploadedFiles;
      var serialized = JSON.stringify(_saveState);
      if (serialized.length > 4.5 * 1024 * 1024) {
        showToast('State too large (' + (serialized.length / 1024 / 1024).toFixed(1) + ' MB) — localStorage limit is ~5 MB. Export JSON to preserve data.', true);
      }
      localStorage.setItem('ops_editor_full_config', serialized);
    } catch (e) {
      console.warn('Save failed', e);
      showToast('Storage full — work may not be saved. Export JSON to preserve data.', true);
    }
  }, 1500);
}

function migrateEditorState(state) {
  if (!state || typeof state !== 'object') return state;
  var sv = state._schemaVersion || 0;
  if (sv < 1) {
    if (!state.config) state.config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    if (!state.manualData) state.manualData = {};
    if (!state.manualData.headcount) state.manualData.headcount = Object.assign({}, DEFAULT_CONFIG.fteDefaults, { releases: [] });
    if (!state.manualData.pulse) state.manualData.pulse = { keyFlag: '' };
    state._schemaVersion = 1;
  }
  return state;
}

function updateConfigBadge() {
  const badge = document.getElementById('badge-config');
  if (badge) {
    badge.className = 'fbadge ok';
    badge.querySelector('span').textContent = 'Config Ready';
  }
}

/* ────────────────────────────
   CONFIG SECTION RENDER
──────────────────────────── */

const CONFIG_SECTIONS = [
  { id: 'general', icon: '\u2699\uFE0F', title: 'General Parameters', desc: 'Dashboard title, period, owner, confidentiality, lookback months.' },
  { id: 'stateMappings', icon: '\uD83D\uDD04', title: 'State Mappings', desc: 'Map ticket states to resolved / open / closed categories.' },
  { id: 'priorityMappings', icon: '\uD83D\uDD22', title: 'Priority Mappings', desc: 'Map priority labels to numeric levels (1=Critical through 4=Low).' },
  { id: 'thresholds', icon: '\uD83C\uDFAF', title: 'KPI Thresholds', desc: 'SLA targets, MTTR caps, RFAC/PRB aging targets.' },
  { id: 'priorityBuckets', icon: '\uD83D\uDFE2', title: 'Priority Buckets', desc: 'Define priority groupings and their display properties.' },
  { id: 'ageBuckets', icon: '\uD83D\uDD18', title: 'Age Buckets', desc: 'Define age distribution bracket boundaries, labels, and colors.' },
  { id: 'ticketTypePrefixes', icon: '\uD83C\uDFF7', title: 'Ticket Type Prefixes', desc: 'Define ticket number prefixes that determine INC vs SR type.' },
  { id: 'validValues', icon: '\u2705', title: 'Valid Values', desc: 'Accepted priorities and states for validation.' },
  { id: 'fteDefaults', icon: '\uD83D\uDC65', title: 'FTE Defaults', desc: 'Default headcount figures for AMS and Projects.' },
  { id: 'modules', icon: '\uD83D\uDCCA', title: 'Module Definitions', desc: 'Module IDs, display names, and domain (SAP / NonERP).' },
  { id: 'mappings', icon: '\uD83D\uDDFA\uFE0F', title: 'Assignment Group Mappings', desc: 'Map ServiceNow assignment groups to dashboard modules.' },
  { id: 'baselines', icon: '\uD83C\uDFAF', title: 'Module Baselines', desc: 'Contracted monthly ticket volumes per module.' }
];

function renderConfigSections() {
  const container = document.getElementById('config-sections');
  container.innerHTML = '';
  for (const sec of CONFIG_SECTIONS) {
    container.appendChild(buildConfigSection(sec));
  }
  applyConfigLockUI();
  updateLockButtonUI();
}

function buildConfigSection(sec) {
  const wrapper = document.createElement('div');
  wrapper.className = 'cfg-section';
  wrapper.id = 'cfg-' + sec.id;

  const hdr = document.createElement('div');
  hdr.className = 'cfg-section-hdr';
  hdr.onclick = function () {
    wrapper.classList.toggle('open');
  };

  let countStr = '';
  const cfg = getConfig();
  let itemCount = 0;
  if (sec.id === 'general') itemCount = 6;
  else if (sec.id === 'stateMappings') { itemCount = (cfg.stateMappings?.resolvedStates?.length || 0) + (cfg.stateMappings?.openStates?.length || 0) + (cfg.stateMappings?.closedStates?.length || 0); }
  else if (sec.id === 'priorityMappings') itemCount = cfg.priorityMappings?.length || 0;
  else if (sec.id === 'thresholds') itemCount = 10;
  else if (sec.id === 'priorityBuckets') itemCount = cfg.priorityBuckets?.length || 0;
  else if (sec.id === 'ageBuckets') itemCount = cfg.ageBuckets?.length || 0;
  else if (sec.id === 'ticketTypePrefixes') itemCount = cfg.ticketTypePrefixes?.length || 0;
  else if (sec.id === 'validValues') itemCount = (cfg.validValues?.priorities?.length || 0) + (cfg.validValues?.incidentStates?.length || 0) + (cfg.validValues?.srStates?.length || 0) + (cfg.validValues?.rfacStates?.length || 0) + (cfg.validValues?.prbStates?.length || 0);
  else if (sec.id === 'fteDefaults') itemCount = 4;
  else if (sec.id === 'modules') itemCount = cfg.modules?.length || 0;
  else if (sec.id === 'mappings') itemCount = Object.keys(cfg.mappings || {}).length;
  else if (sec.id === 'baselines') itemCount = Object.keys(cfg.baselines || {}).length;
  if (itemCount > 0) countStr = '<span class="cfg-section-count">' + itemCount + '</span>';

  hdr.innerHTML = '<span class="cfg-section-icon">' + sec.icon + '</span>' +
    '<span class="cfg-section-title">' + sec.title + '</span>' +
    '<span style="font-size:10.5px;color:var(--text-muted);margin-right:8px;">' + sec.desc + '</span>' +
    countStr +
    '<span class="cfg-section-chev">\u25B6</span>';

  const body = document.createElement('div');
  body.className = 'cfg-section-body';
  body.innerHTML = renderConfigBody(sec.id);
  wrapper.appendChild(hdr);
  wrapper.appendChild(body);
  return wrapper;
}

function renderConfigBody(sectionId) {
  const cfg = getConfig();
  switch (sectionId) {
    case 'general':
      return '<div class="fg"><label class="fl">Dashboard Title</label><input type="text" id="cfg-title" value="' + escHtml(cfg.general.title) + '" onchange="setCfg(\'general\',\'title\',this.value)"></div>' +
        '<div class="fg">' +
          '<label class="fl">Reporting Period</label>' +
          '<input type="text" id="cfg-period" value="' + escHtml(cfg.general.period) + '" onchange="setCfg(\'general\',\'period\',this.value)" placeholder="e.g. August 2024 (CW35)">' +
        '</div>' +
        '<div class="fg"><label class="fl">Portfolio Owner</label><input type="text" id="cfg-owner" value="' + escHtml(cfg.general.portfolioOwner) + '" onchange="setCfg(\'general\',\'portfolioOwner\',this.value)"></div>' +
        '<div class="fg"><label class="fl">Confidentiality</label><input type="text" id="cfg-conf" value="' + escHtml(cfg.general.confidentiality) + '" onchange="setCfg(\'general\',\'confidentiality\',this.value)"></div>' +
        '<div class="fg"><label class="fl">Report Date</label><input type="date" id="cfg-reportDate" value="' + escHtml(cfg.general.reportDate) + '" onchange="onCfgReportDateChange(this.value)"></div>' +
        '<div class="fg"><label class="fl">Lookback Months</label><div class="input-hint">Number of historical months for trend analysis, counting back from the report date.</div><input type="number" min="1" max="24" value="' + (cfg.general.lookbackMonths || 6) + '" onchange="setCfg(\'general\',\'lookbackMonths\',+this.value);refreshConfigSection(\'general\')"></div>';

    case 'stateMappings':
      return '<div class="fg"><label class="fl">Resolved States</label><div class="input-hint">Tickets in these states count as resolved.</div><div style="margin-top:6px;">' + renderTagList('stateMappings', 'resolvedStates', cfg.stateMappings.resolvedStates) + '</div></div>' +
        '<div class="fg"><label class="fl">Open States</label><div class="input-hint">Tickets in these states are considered open.</div><div style="margin-top:6px;">' + renderTagList('stateMappings', 'openStates', cfg.stateMappings.openStates) + '</div></div>' +
        '<div class="fg"><label class="fl">Closed States</label><div class="input-hint">Final states used for closed ticket filtering.</div><div style="margin-top:6px;">' + renderTagList('stateMappings', 'closedStates', cfg.stateMappings.closedStates) + '</div></div>';

    case 'priorityMappings':
      let pmHtml = '<div class="input-hint" style="margin-bottom:10px;">Map priority display labels to engine numeric values.</div>';
      (cfg.priorityMappings || []).forEach(function (pm, i) {
        pmHtml += '<div class="input-row" style="margin-bottom:8px;">' +
          '<div class="grid-3">' +
          '<div class="fg"><label class="fl">Label</label><input type="text" value="' + escHtml(pm.label) + '" onchange="updatePriorityMapping(' + i + ',\'label\',this.value)"></div>' +
          '<div class="fg"><label class="fl">Numeric Value</label><input type="number" value="' + pm.value + '" onchange="updatePriorityMapping(' + i + ',\'value\',+this.value)"></div>' +
          '<div style="display:flex;align-items:flex-end;"><button class="btn btn-ghost btn-sm" data-action="delete-priority-mapping" data-idx="' + i + '">✕ Delete</button></div>' +
          '</div></div>';
      });
      pmHtml += '<button class="btn btn-ghost btn-sm" data-action="add-priority-mapping">+ Add Priority</button>';
      return pmHtml;

    case 'thresholds':
      return renderRagThresholdFields(cfg) +
        '<div class="fg" style="margin-top:16px;margin-bottom:10px;"><strong style="color:var(--text-main);font-size:12px;">SLA &amp; MTTR Targets</strong></div><div class="input-row-3">' +
        '<div class="fg"><label class="fl">Response SLA Target %</label><input type="number" value="' + cfg.thresholds.respSlaTarget + '" onchange="setCfg(\'thresholds\',\'respSlaTarget\',+this.value)"></div>' +
        '<div class="fg"><label class="fl">Resolution SLA Target %</label><input type="number" value="' + cfg.thresholds.resolSlaTarget + '" onchange="setCfg(\'thresholds\',\'resolSlaTarget\',+this.value)"></div>' +
        '<div class="fg"><label class="fl">MTTR Target (hrs)</label><input type="number" value="' + cfg.thresholds.mttrTargetHours + '" onchange="setCfg(\'thresholds\',\'mttrTargetHours\',+this.value)"></div>' +
        '</div>' +
        '<div class="fg" style="margin:12px 0 10px;"><strong style="color:var(--text-main);font-size:12px;">RFAC / PRB Targets</strong></div><div class="input-row-3">' +
        '<div class="fg"><label class="fl">RFAC &lt;8w Target %</label><input type="number" value="' + cfg.thresholds.rfacUnder8wPct + '" onchange="setCfg(\'thresholds\',\'rfacUnder8wPct\',+this.value)"></div>' +
        '<div class="fg"><label class="fl">RFAC &lt;12w Target %</label><input type="number" value="' + cfg.thresholds.rfacUnder12wPct + '" onchange="setCfg(\'thresholds\',\'rfacUnder12wPct\',+this.value)"></div>' +
        '<div class="fg"><label class="fl">RFAC &lt;8w (days)</label><input type="number" value="' + cfg.thresholds.rfacUnder8wDays + '" onchange="setCfg(\'thresholds\',\'rfacUnder8wDays\',+this.value)"></div>' +
        '<div class="fg"><label class="fl">RFAC &lt;12w (days)</label><input type="number" value="' + cfg.thresholds.rfacUnder12wDays + '" onchange="setCfg(\'thresholds\',\'rfacUnder12wDays\',+this.value)"></div>' +
        '<div class="fg"><label class="fl">PRB &lt;3m Target %</label><input type="number" value="' + cfg.thresholds.prbUnder3mPct + '" onchange="setCfg(\'thresholds\',\'prbUnder3mPct\',+this.value)"></div>' +
        '<div class="fg"><label class="fl">PRB &lt;6m Target %</label><input type="number" value="' + cfg.thresholds.prbUnder6mPct + '" onchange="setCfg(\'thresholds\',\'prbUnder6mPct\',+this.value)"></div>' +
        '<div class="fg"><label class="fl">PRB &lt;3m (days)</label><input type="number" value="' + cfg.thresholds.prbUnder3mDays + '" onchange="setCfg(\'thresholds\',\'prbUnder3mDays\',+this.value)"></div>' +
        '<div class="fg"><label class="fl">PRB &lt;6m (days)</label><input type="number" value="' + cfg.thresholds.prbUnder6mDays + '" onchange="setCfg(\'thresholds\',\'prbUnder6mDays\',+this.value)"></div>' +
        '</div>' +
        '<div class="fg" style="margin:12px 0 10px;"><strong style="color:var(--text-main);font-size:12px;">Other Thresholds</strong></div><div class="input-row-3">' +
        '<div class="fg"><label class="fl">Near-Miss Ratio</label><input type="number" step="0.01" value="' + cfg.thresholds.nearMissRatio + '" onchange="setCfg(\'thresholds\',\'nearMissRatio\',+this.value)"></div>' +
        '<div class="fg"><label class="fl">Escalation Threshold</label><input type="number" value="' + cfg.thresholds.escalationThreshold + '" onchange="setCfg(\'thresholds\',\'escalationThreshold\',+this.value)"></div>' +
        '</div>' +
        '<div class="fg"><label class="fl">Emergency Keywords (comma-separated)</label><input type="text" value="' + (cfg.emergencyKeywords || ['emergency']).join(', ') + '" onchange="setEmergencyKeywords(this.value)"></div>' +
        '<div class="fg"><label class="fl">Known Error Truthy Values (comma-separated)</label><input type="text" value="' + (cfg.knownErrorValues || [true, 'true', '1', 'Yes']).join(', ') + '" onchange="setKnownErrorValues(this.value)"></div>';

    case 'priorityBuckets': {
      let pbHtml = '<div class="input-hint" style="margin-bottom:10px;">Define priority groupings. Each bucket groups one or more priority values and gets a display label and color.</div>';
      (cfg.priorityBuckets || []).forEach(function (b, i) {
        pbHtml += '<div class="input-row" style="margin-bottom:10px;border:1px solid var(--border);border-radius:var(--radius);padding:10px;background:var(--bg-panel);">' +
          '<div class="grid-4">' +
          '<div class="fg"><label class="fl">Label</label><input type="text" value="' + escHtml(b.label) + '" onchange="updatePriorityBucket(' + i + ',\'label\',this.value)"></div>' +
          '<div class="fg"><label class="fl">Priority Values</label><input type="text" value="' + (b.values || []).join(',') + '" placeholder="e.g. 1,2" onchange="updatePriorityBucket(' + i + ',\'values\',this.value)"></div>' +
          '<div class="fg"><label class="fl">Color</label><select onchange="updatePriorityBucket(' + i + ',\'color\',this.value)">' +
          ['red','amber','green','blue','purple','muted'].map(function (c) { return '<option value="' + c + '"' + (b.color === c ? ' selected' : '') + '>' + c + '</option>'; }).join('') +
          '</select></div>' +
          '<div style="display:flex;align-items:flex-end;"><button class="btn btn-ghost btn-sm" data-action="delete-priority-bucket" data-idx="' + i + '">✕ Delete</button></div>' +
          '</div></div>';
      });
      pbHtml += '<button class="btn btn-green btn-sm" data-action="add-priority-bucket">+ Add Priority Bucket</button>';
      return pbHtml;
    }

    case 'ageBuckets': {
      let abHtml = '<div class="input-hint" style="margin-bottom:10px;">Define age distribution brackets. Each bucket has a max age in days (leave empty for unbounded).</div>';
      (cfg.ageBuckets || []).forEach(function (b, i) {
        abHtml += '<div class="input-row" style="margin-bottom:10px;border:1px solid var(--border);border-radius:var(--radius);padding:10px;background:var(--bg-panel);">' +
          '<div class="grid-4">' +
          '<div class="fg"><label class="fl">Label</label><input type="text" value="' + escHtml(b.label) + '" onchange="updateAgeBucket(' + i + ',\'label\',this.value)"></div>' +
          '<div class="fg"><label class="fl">Max Age (days)</label><input type="number" value="' + (b.maxDays !== null ? b.maxDays : '') + '" placeholder="unbounded" onchange="updateAgeBucket(' + i + ',\'maxDays\',this.value === \'\' ? null : +this.value)"></div>' +
          '<div class="fg"><label class="fl">Color</label><select onchange="updateAgeBucket(' + i + ',\'color\',this.value)">' +
          ['red','amber','green','blue','purple','muted'].map(function (c) { return '<option value="' + c + '"' + (b.color === c ? ' selected' : '') + '>' + c + '</option>'; }).join('') +
          '</select></div>' +
          '<div style="display:flex;align-items:flex-end;"><button class="btn btn-ghost btn-sm" data-action="delete-age-bucket" data-idx="' + i + '">✕ Delete</button></div>' +
          '</div></div>';
      });
      abHtml += '<button class="btn btn-green btn-sm" data-action="add-age-bucket">+ Add Age Bucket</button>';
      return abHtml;
    }

    case 'ticketTypePrefixes': {
      let tpHtml = '<div class="input-hint" style="margin-bottom:10px;">Map ticket number prefixes to type. The first matching prefix determines the type.</div>';
      (cfg.ticketTypePrefixes || []).forEach(function (t, i) {
        tpHtml += '<div class="input-row" style="margin-bottom:8px;">' +
          '<div class="grid-3">' +
          '<div class="fg"><label class="fl">Prefix</label><input type="text" value="' + escHtml(t.prefix) + '" onchange="updateTicketPrefix(' + i + ',\'prefix\',this.value)"></div>' +
          '<div class="fg"><label class="fl">Type</label><select onchange="updateTicketPrefix(' + i + ',\'type\',this.value)">' +
          ['INC','SR'].map(function (tp) { return '<option value="' + tp + '"' + (t.type === tp ? ' selected' : '') + '>' + tp + '</option>'; }).join('') +
          '</select></div>' +
          '<div style="display:flex;align-items:flex-end;"><button class="btn btn-ghost btn-sm" data-action="delete-ticket-prefix" data-idx="' + i + '">✕ Delete</button></div>' +
          '</div></div>';
      });
      tpHtml += '<button class="btn btn-green btn-sm" data-action="add-ticket-prefix">+ Add Prefix</button>';
      return tpHtml;
    }

    case 'validValues':
      return '<div class="fg"><label class="fl">Valid Priorities (Incidents/SR)</label><div class="input-hint">Accepted priority labels for incidents and service requests.</div><div style="margin-top:6px;">' + renderTagList('validValues', 'priorities', cfg.validValues.priorities) + '</div></div>' +
        '<div class="fg" style="margin-top:15px;"><label class="fl">Valid States — Incidents</label><div class="input-hint">Accepted states for incidents.</div><div style="margin-top:6px;">' + renderTagList('validValues', 'incidentStates', cfg.validValues.incidentStates) + '</div></div>' +
        '<div class="fg" style="margin-top:15px;"><label class="fl">Valid States — Service Requests</label><div class="input-hint">Accepted states for service requests.</div><div style="margin-top:6px;">' + renderTagList('validValues', 'srStates', cfg.validValues.srStates) + '</div></div>' +
        '<div class="fg" style="margin-top:15px;"><label class="fl">Valid States — RFAC / Changes</label><div class="input-hint">Accepted states for change requests.</div><div style="margin-top:6px;">' + renderTagList('validValues', 'rfacStates', cfg.validValues.rfacStates) + '</div></div>' +
        '<div class="fg" style="margin-top:15px;"><label class="fl">Valid States — Problems / PRB</label><div class="input-hint">Accepted states for problem tickets.</div><div style="margin-top:6px;">' + renderTagList('validValues', 'prbStates', cfg.validValues.prbStates) + '</div></div>';

    case 'fteDefaults':
      return '<div class="input-row-3">' +
        '<div class="fg"><label class="fl">SAP AMS FTEs</label><input type="number" value="' + cfg.fteDefaults.sapAMS + '" onchange="setFteDefault(\'sapAMS\',+this.value)"></div>' +
        '<div class="fg"><label class="fl">SAP Projects FTEs</label><input type="number" value="' + cfg.fteDefaults.sapProjects + '" onchange="setFteDefault(\'sapProjects\',+this.value)"></div>' +
        '<div class="fg"><label class="fl">Non-ERP AMS FTEs</label><input type="number" value="' + cfg.fteDefaults.nsAMS + '" onchange="setFteDefault(\'nsAMS\',+this.value)"></div>' +
        '<div class="fg"><label class="fl">Non-ERP Projects FTEs</label><input type="number" value="' + cfg.fteDefaults.nsProjects + '" onchange="setFteDefault(\'nsProjects\',+this.value)"></div>' +
        '</div>';

    case 'modules':
      var globalSla = (cfg.ragThresholds && cfg.ragThresholds.sla) || {};
      var defGreen = globalSla.green !== undefined ? globalSla.green : '98';
      var defAmber = globalSla.amber !== undefined ? globalSla.amber : '95';
      let modHtml = '<div class="sc-table-wrap"><table class="sc-table"><thead><tr><th>Module ID</th><th>Display Name</th><th>Domain</th><th>FTE</th><th>SLA Green ≥</th><th>SLA Amber ≥</th><th>Inv</th><th></th></tr></thead><tbody>';
      (cfg.modules || []).forEach(function (m, i) {
        var st = m.slaThreshold || {};
        modHtml += '<tr>' +
          '<td class="mono">' + escHtml(m.id) + '</td>' +
          '<td><input type="text" value="' + escHtml(m.name) + '" onchange="updateModuleDef(' + i + ',\'name\',this.value)" style="width:130px;"></td>' +
          '<td><select onchange="updateModuleDef(' + i + ',\'domain\',this.value)" style="width:100px;">' +
          '<option value="SAP" ' + (m.domain === 'SAP' ? 'selected' : '') + '>SAP</option>' +
          '<option value="NonERP" ' + (m.domain === 'NonERP' ? 'selected' : '') + '>NonERP</option>' +
          '</select></td>' +
          '<td><input type="number" value="' + (m.fte !== undefined ? m.fte : '') + '" placeholder="Auto" onchange="updateModuleDef(' + i + ',\'fte\',this.value === \'\' ? undefined : +this.value)" style="width:60px;"></td>' +
          '<td><input type="number" value="' + (st.green !== undefined ? st.green : '') + '" placeholder="' + defGreen + '" onchange="updateModuleSlaThreshold(' + i + ',\'green\',this.value === \'\' ? undefined : +this.value)" style="width:60px;"></td>' +
          '<td><input type="number" value="' + (st.amber !== undefined ? st.amber : '') + '" placeholder="' + defAmber + '" onchange="updateModuleSlaThreshold(' + i + ',\'amber\',this.value === \'\' ? undefined : +this.value)" style="width:60px;"></td>' +
          '<td><input type="checkbox" ' + (st.invert ? 'checked' : '') + ' onchange="updateModuleSlaThreshold(' + i + ',\'invert\',this.checked ? true : undefined)" title="Higher is better"></td>' +
          '<td><button class="btn btn-red btn-xs" data-action="delete-module-def" data-idx="' + i + '">\u2715</button></td></tr>';
      });
      modHtml += '</tbody></table></div>' +
        '<div class="input-hint" style="margin-top:4px;">Empty SLA fields use the global defaults shown in placeholders. Edit global values in the KPI Thresholds tab.</div>' +
        '<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">' +
        '<input type="text" id="new-mod-id" placeholder="Module ID" style="width:120px;">' +
        '<input type="text" id="new-mod-name" placeholder="Display Name" style="width:140px;">' +
        '<select id="new-mod-domain" style="width:100px;"><option value="SAP">SAP</option><option value="NonERP">NonERP</option></select>' +
        '<button class="btn btn-green btn-sm" data-action="add-module-def">+ Add Module</button>' +
        '</div>';
      return modHtml;

    case 'mappings':
      let mapHtml = '<div class="sc-table-wrap"><table class="sc-table"><thead><tr><th>Assignment Group</th><th>Module ID</th><th></th></tr></thead><tbody>';
      const groups = Object.keys(cfg.mappings || {}).sort();
      groups.forEach(function (grp) {
        mapHtml += '<tr>' +
          '<td class="row-lbl" style="font-size:11.5px;">' + escHtml(grp) + '</td>' +
          '<td><select data-map-group="' + escHtml(grp) + '" onchange="updateMapping(this.dataset.mapGroup,this.value)" style="width:140px;">' +
          cfg.modules.map(function (m) { return '<option value="' + m.id + '" ' + (cfg.mappings[grp] === m.id ? 'selected' : '') + '>' + m.name + '</option>'; }).join('') +
          '</select></td>' +
          '<td><button class="btn btn-red btn-xs" data-action="delete-mapping" data-map-group="' + escHtml(grp) + '">\u2715</button></td></tr>';
      });
      mapHtml += '</tbody></table></div>' +
        '<div style="margin-top:10px;display:flex;gap:8px;">' +
        '<input type="text" id="new-map-group" placeholder="assignment_group" style="flex:2;">' +
        '<select id="new-map-module" style="flex:1;">' +
        cfg.modules.map(function (m) { return '<option value="' + m.id + '">' + m.name + '</option>'; }).join('') +
        '</select>' +
        '<button class="btn btn-green btn-sm" data-action="add-mapping">+ Add Mapping</button>' +
        '<button class="btn btn-ghost btn-sm" onclick="addUnmappedFromData()">\uD83D\uDD0D Detect Unmapped</button>' +
        '</div>';
      return mapHtml;

    case 'baselines':
      let blHtml = '<div class="input-row-3">';
      (cfg.modules || []).forEach(function (m) {
        const val = cfg.baselines[m.id] !== undefined ? cfg.baselines[m.id] : 50;
        blHtml += '<div class="fg"><label class="fl">' + escHtml(m.name) + '</label><input type="number" value="' + val + '" onchange="setCfg(\'baselines\',\'' + m.id + '\',+this.value)"></div>';
      });
      blHtml += '</div>';
      return blHtml;

    default:
      return '<p style="color:var(--text-sub);">Unknown section.</p>';
  }
}

function renderTagList(section, key, items) {
  let html = '<div class="tag-list" data-tag-section="' + section + '" data-tag-key="' + key + '">';
  (items || []).forEach(function (item, idx) {
    html += '<span class="tag"><span class="tag-text">' + escHtml(item) + '</span> <span class="tag-rem" data-tag-idx="' + idx + '">\u00D7</span></span>';
  });
  html += '<span class="tag-add">+ Add</span>';
  html += '</div>';
  return html;
}

function escHtml(str) {
  if (typeof str !== 'string') return str || '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

/* ────────────────────────────
   CONFIG MUTATORS
──────────────────────────── */

function onCfgReportDateChange(val) {
  if (configLocked) return;
  var cfg = getConfig();
  cfg.general.reportDate = val;
  if (val) {
    var result = detectMonthsFromData();
    cfg.general.period = result.period;
    document.getElementById('cfg-period').value = result.period;
  }
  saveFullState();
  markConfigModified();
  updateConfigBadge();
  refreshConfigSection('general');
}

function setRagThreshold(key, field, value) {
  if (configLocked) return;
  const cfg = getConfig();
  if (!cfg.ragThresholds) cfg.ragThresholds = {};
  if (!cfg.ragThresholds[key]) cfg.ragThresholds[key] = {};
  if (field === 'invert') {
    cfg.ragThresholds[key][field] = !!value;
  } else {
    cfg.ragThresholds[key][field] = validatePositive(value);
  }
  saveFullState();
  markConfigModified();
  updateConfigBadge();
  refreshConfigSection('thresholds');
}

function renderRagThresholdFields(cfg) {
  const rt = cfg.ragThresholds || {};
  const fields = [
    { key: 'sla', label: 'SLA Compliance %', invert: true },
    { key: 'mttr', label: 'MTTR (hours)' },
    { key: 'reopenRate', label: 'Reopen Rate %' },
    { key: 'firstFixRate', label: 'First-Fix Rate %', invert: true },
    { key: 'fteLoad', label: 'FTE Load (tickets/FTE)' }
  ];
  let html = '<div class="fg" style="margin-bottom:8px;"><strong style="color:var(--text-main);font-size:12px;">RAG Color Thresholds</strong></div><div class="input-hint" style="margin-bottom:12px;">Green/Amber/Red breakpoints for dashboard indicator coloring. Inverted metrics (higher=better) are marked.</div>';
  fields.forEach(function(f) {
    const t = rt[f.key] || {};
    html += '<div style="border:1px solid var(--border);border-radius:var(--radius);padding:10px 12px;margin-bottom:6px;background:var(--bg-panel);">' +
      '<div style="font-size:11px;font-weight:600;color:var(--text-sub);margin-bottom:6px;">' + escHtml(f.label) + (f.invert ? ' <span style="color:var(--green);font-size:9px;">(inverted)</span>' : '') + '</div>' +
      '<div class="input-row-3" style="gap:8px;display:grid;grid-template-columns:1fr 1fr 1fr;">' +
      '<div class="fg"><label class="fl" style="color:var(--green)">Green ≥</label><input type="number" value="' + (t.green !== undefined ? t.green : '') + '" onchange="setRagThreshold(\'' + f.key + '\',\'green\',+this.value)"></div>' +
      '<div class="fg"><label class="fl" style="color:var(--amber)">Amber ≥</label><input type="number" value="' + (t.amber !== undefined ? t.amber : '') + '" onchange="setRagThreshold(\'' + f.key + '\',\'amber\',+this.value)"></div>' +
      '<div class="fg" style="display:flex;align-items:flex-end;"><label class="fl" style="visibility:hidden">Inv</label><label style="font-size:10px;color:var(--text-muted);display:flex;align-items:center;gap:4px;"><input type="checkbox" ' + (t.invert ? 'checked' : '') + ' onchange="setRagThreshold(\'' + f.key + '\',\'invert\',this.checked)"> Higher is better</label></div>' +
      '</div></div>';
  });
  return html;
}

function setCfg(section, key, value) {
  if (configLocked) return;
  const cfg = getConfig();
  var validated = value;
  if (section === 'thresholds') {
    var pctFields = ['respSlaTarget', 'resolSlaTarget', 'rfacUnder8wPct', 'rfacUnder12wPct', 'prbUnder3mPct', 'prbUnder6mPct'];
    var dayFields = ['rfacUnder8wDays', 'rfacUnder12wDays', 'prbUnder3mDays', 'prbUnder6mDays', 'ageWarningDays', 'ageCriticalDays'];
    if (pctFields.indexOf(key) !== -1) validated = validatePct(value);
    else if (dayFields.indexOf(key) !== -1) validated = validatePositive(value);
    else if (key === 'nearMissRatio') validated = clampNumber(value, 0, 1);
    else validated = validatePositive(value);
  } else if (section === 'baselines') {
    validated = validatePositive(value);
  } else if (section === 'general' && key === 'lookbackMonths') {
    validated = clampNumber(value, 1, 24);
  }
  if (section === 'baselines') {
    cfg.baselines[key] = validated;
  } else {
    cfg[section][key] = validated;
  }
  saveFullState();
  markConfigModified();
  updateConfigBadge();
  refreshConfigSection(section);
}

function setFteDefault(key, value) {
  if (configLocked) return;
  const cfg = getConfig();
  cfg.fteDefaults[key] = validatePositive(value);
  saveFullState();
  markConfigModified();
}

function addTag(section, key) {
  if (configLocked) return;
  const val = prompt('Enter new value:');
  if (val && val.trim()) {
    const cfg = getConfig();
    cfg[section][key].push(val.trim());
    saveFullState();
    refreshConfigSection(section);
  }
}

function removeTag(section, key, idx) {
  if (configLocked) return;
  const cfg = getConfig();
  cfg[section][key].splice(idx, 1);
  saveFullState();
  refreshConfigSection(section);
}

function updatePriorityMapping(idx, key, value) {
  if (configLocked) return;
  const cfg = getConfig();
  cfg.priorityMappings[idx][key] = value;
  saveFullState();
  markConfigModified();
}

function addPriorityMapping() {
  if (configLocked) return;
  const cfg = getConfig();
  if (!cfg.priorityMappings) cfg.priorityMappings = [];
  cfg.priorityMappings.push({ label: "New Priority", value: 5 });
  saveFullState();
  markConfigModified();
  refreshConfigSection('priorityMappings');
}

function deletePriorityMapping(idx) {
  if (configLocked) return;
  if (!confirm('Delete this priority mapping?')) return;
  const cfg = getConfig();
  if (!cfg.priorityMappings) return;
  cfg.priorityMappings.splice(idx, 1);
  saveFullState();
  refreshConfigSection('priorityMappings');
}

function updatePriorityBucket(idx, key, value) {
  if (configLocked) return;
  const cfg = getConfig();
  if (key === 'values') {
    cfg.priorityBuckets[idx].values = value.split(',').map(function (v) { return parseInt(v.trim(), 10); }).filter(function (v) { return !isNaN(v); });
  } else {
    cfg.priorityBuckets[idx][key] = value;
  }
  saveFullState();
  markConfigModified();
  refreshConfigSection('priorityBuckets');
}

function addPriorityBucket() {
  if (configLocked) return;
  const cfg = getConfig();
  if (!cfg.priorityBuckets) cfg.priorityBuckets = [];
  cfg.priorityBuckets.push({ label: "New Bucket", values: [1], color: "blue" });
  saveFullState();
  markConfigModified();
  refreshConfigSection('priorityBuckets');
}

function deletePriorityBucket(idx) {
  if (configLocked) return;
  if (!confirm('Delete this priority bucket?')) return;
  const cfg = getConfig();
  if (!cfg.priorityBuckets) return;
  cfg.priorityBuckets.splice(idx, 1);
  saveFullState();
  refreshConfigSection('priorityBuckets');
}

function updateAgeBucket(idx, key, value) {
  if (configLocked) return;
  const cfg = getConfig();
  cfg.ageBuckets[idx][key] = value;
  saveFullState();
  markConfigModified();
  refreshConfigSection('ageBuckets');
}

function addAgeBucket() {
  if (configLocked) return;
  const cfg = getConfig();
  if (!cfg.ageBuckets) cfg.ageBuckets = [];
  cfg.ageBuckets.push({ label: "New Bucket", maxDays: null, color: "green" });
  saveFullState();
  markConfigModified();
  refreshConfigSection('ageBuckets');
}

function deleteAgeBucket(idx) {
  if (configLocked) return;
  if (!confirm('Delete this age bucket?')) return;
  const cfg = getConfig();
  if (!cfg.ageBuckets) return;
  cfg.ageBuckets.splice(idx, 1);
  saveFullState();
  refreshConfigSection('ageBuckets');
}

function updateTicketPrefix(idx, key, value) {
  if (configLocked) return;
  const cfg = getConfig();
  cfg.ticketTypePrefixes[idx][key] = value;
  saveFullState();
  markConfigModified();
  refreshConfigSection('ticketTypePrefixes');
}

function addTicketPrefix() {
  if (configLocked) return;
  const cfg = getConfig();
  if (!cfg.ticketTypePrefixes) cfg.ticketTypePrefixes = [];
  cfg.ticketTypePrefixes.push({ prefix: "TKT", type: "SR" });
  saveFullState();
  markConfigModified();
  refreshConfigSection('ticketTypePrefixes');
}

function deleteTicketPrefix(idx) {
  if (configLocked) return;
  if (!confirm('Delete this ticket prefix?')) return;
  const cfg = getConfig();
  if (!cfg.ticketTypePrefixes) return;
  cfg.ticketTypePrefixes.splice(idx, 1);
  saveFullState();
  refreshConfigSection('ticketTypePrefixes');
}

function updateModuleDef(idx, key, value) {
  if (configLocked) return;
  const cfg = getConfig();
  cfg.modules[idx][key] = value;
  saveFullState();
  markConfigModified();
}

function updateModuleSlaThreshold(idx, field, value) {
  if (configLocked) return;
  const cfg = getConfig();
  var m = cfg.modules[idx];
  if (!m.slaThreshold) m.slaThreshold = {};
  if (value === undefined) {
    delete m.slaThreshold[field];
    if (Object.keys(m.slaThreshold).length === 0) delete m.slaThreshold;
  } else {
    m.slaThreshold[field] = value;
  }
  saveFullState();
  markConfigModified();
}

function addModuleDef() {
  if (configLocked) return;
  const id = document.getElementById('new-mod-id').value.trim();
  const name = document.getElementById('new-mod-name').value.trim();
  const domain = document.getElementById('new-mod-domain').value;
  if (!id || !name) return;
  const cfg = getConfig();
  if (cfg.modules.find(function (m) { return m.id === id; })) return showToast('Module ID already exists.');
  cfg.modules.push({ id: id, name: name, domain: domain });
  cfg.baselines[id] = 50;
  saveFullState();
  refreshConfigSection('modules');
  refreshConfigSection('mappings');
  refreshConfigSection('baselines');
}

function deleteModuleDef(idx) {
  if (configLocked) return;
  const cfg = getConfig();
  const modId = cfg.modules[idx]?.id;
  if (!modId) return;
  if (!confirm('Delete module "' + (cfg.modules[idx].name || modId) + '" and its baseline/mappings?')) return;
  cfg.modules.splice(idx, 1);
  delete cfg.baselines[modId];
  Object.keys(cfg.mappings).forEach(function (grp) {
    if (cfg.mappings[grp] === modId) delete cfg.mappings[grp];
  });
  saveFullState();
  refreshConfigSection('modules');
  refreshConfigSection('mappings');
  refreshConfigSection('baselines');
}

function updateMapping(group, modId) {
  if (configLocked) return;
  const cfg = getConfig();
  cfg.mappings[group] = modId;
  saveFullState();
  markConfigModified();
}

function addMapping() {
  if (configLocked) return;
  const group = document.getElementById('new-map-group').value.trim();
  const modId = document.getElementById('new-map-module').value;
  if (!group) return;
  const cfg = getConfig();
  cfg.mappings[group] = modId;
  saveFullState();
  document.getElementById('new-map-group').value = '';
  refreshConfigSection('mappings');
}

function deleteMapping(group) {
  if (configLocked) return;
  const cfg = getConfig();
  delete cfg.mappings[group];
  saveFullState();
  refreshConfigSection('mappings');
}

function addUnmappedFromData() {
  const allData = [
    ...(editorState.uploadedFiles.incidents || []),
    ...(editorState.uploadedFiles.service_requests || []),
    ...(editorState.uploadedFiles.rfac || []),
    ...(editorState.uploadedFiles.problems || [])
  ];
  const cfg = getConfig();
  let count = 0;
  allData.forEach(function (row) {
    const grp = getVal(row, 'assignment_group') || getVal(row, 'assignment group');
    if (grp && !cfg.mappings[grp]) {
      cfg.mappings[grp] = cfg.modules[0] ? cfg.modules[0].id : 'crm';
      count++;
    }
  });
  if (count > 0) {
    saveFullState();
    refreshConfigSection('mappings');
    showToast('Detected and pre-mapped ' + count + ' unmapped assignment groups.');
  } else {
    showToast('No new unmapped groups detected in uploaded files.');
  }
}

function setEmergencyKeywords(val) {
  if (configLocked) return;
  const cfg = getConfig();
  cfg.emergencyKeywords = val.split(',').map(function (s) { return s.trim(); }).filter(function (s) { return s; });
  saveFullState();
  markConfigModified();
}

function setKnownErrorValues(val) {
  if (configLocked) return;
  const cfg = getConfig();
  cfg.knownErrorValues = val.split(',').map(function (s) { return s.trim(); }).filter(function (s) { return s; });
  saveFullState();
  markConfigModified();
}

function markConfigModified() {
  const el = document.getElementById('cfg-modified-label');
  if (el) el.style.display = 'inline';
}

function refreshConfigSection(sectionId) {
  const wrapper = document.getElementById('cfg-' + sectionId);
  if (!wrapper) return;
  const body = wrapper.querySelector('.cfg-section-body');
  if (body) {
    body.innerHTML = renderConfigBody(sectionId);
  }
  const countEl = wrapper.querySelector('.cfg-section-count');
  if (countEl) {
    const cfg = getConfig();
    let c = 0;
    if (sectionId === 'stateMappings') c = (cfg.stateMappings?.resolvedStates?.length || 0) + (cfg.stateMappings?.openStates?.length || 0) + (cfg.stateMappings?.closedStates?.length || 0);
    else if (sectionId === 'priorityMappings') c = cfg.priorityMappings?.length || 0;
    else if (sectionId === 'priorityBuckets') c = cfg.priorityBuckets?.length || 0;
    else if (sectionId === 'ageBuckets') c = cfg.ageBuckets?.length || 0;
    else if (sectionId === 'ticketTypePrefixes') c = cfg.ticketTypePrefixes?.length || 0;
    else if (sectionId === 'validValues') c = (cfg.validValues?.priorities?.length || 0) + (cfg.validValues?.incidentStates?.length || 0) + (cfg.validValues?.srStates?.length || 0) + (cfg.validValues?.rfacStates?.length || 0) + (cfg.validValues?.prbStates?.length || 0);
    else if (sectionId === 'modules') c = cfg.modules?.length || 0;
    else if (sectionId === 'mappings') c = Object.keys(cfg.mappings || {}).length;
    else if (sectionId === 'baselines') c = Object.keys(cfg.baselines || {}).length;
    countEl.textContent = c;
  }
}

/* ────────────────────────────
   CONFIG LOCK
──────────────────────────── */

function updateLockButtonUI() {
  document.getElementById('cfg-lock-label').textContent = configLocked ? 'Locked' : 'Unlocked';
  const icon = document.querySelector('#cfg-lock-btn .lock-icon');
  if (icon) icon.textContent = configLocked ? '\uD83D\uDD12' : '\uD83D\uDD10';
  document.getElementById('cfg-lock-btn').classList.toggle('locked', configLocked);
}

function toggleConfigLock() {
  configLocked = !configLocked;
  applyConfigLockUI();
  updateLockButtonUI();
}

function applyConfigLockUI() {
  const container = document.getElementById('config-sections');
  if (!container) return;
  container.classList.toggle('cfg-locked', configLocked);
}

/* ────────────────────────────
   CONFIG EXPORT / IMPORT / PREVIEW
──────────────────────────── */

function downloadConfigJSON() {
  const cfg = getConfig();
  const blob = new Blob([JSON.stringify(cfg, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'opsreview_config.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function uploadConfigJSON(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const imported = JSON.parse(e.target.result);
      editorState.config = imported;
      saveFullState();
      renderConfigSections();
      updateConfigBadge();
      showToast('Configuration loaded successfully.');
    } catch (err) {
      showToast('Error parsing config JSON: ' + err.message);
    }
  };
  reader.onerror = function () {
    showToast("Error reading config file. The file may be too large or inaccessible.");
  };
  reader.onabort = function () {
    showToast("Config file read was aborted.");
  };
  reader.readAsText(file);
  event.target.value = '';
}

function previewConfigJSON() {
  const cfg = getConfig();
  const win = window.open('', '_blank', 'width=800,height=600,scrollbars=yes');
  if (win) {
    win.document.write('<html><head><title>Config Preview</title><style>body{background:#0e0f13;color:#e2e5f0;font-family:monospace;font-size:12px;padding:20px;white-space:pre-wrap;word-break:break-all;}pre{margin:0;}</style></head><body><pre>' + escHtml(JSON.stringify(cfg, null, 2)) + '</pre></body></html>');
    win.document.close();
  }
}

/* ────────────────────────────
   TEMPLATE DOWNLOAD (SHEETJS)
──────────────────────────── */

const TEMPLATE_COLUMNS = {
  incidents: ['number', 'opened_at', 'assignment_group', 'priority', 'state', 'made_sla', 'resolved_at', 'sla_due', 'reopen_count', 'escalation', 'rfc', 'problem_id'],
  service_requests: ['number', 'opened_at', 'assignment_group', 'priority', 'state', 'made_sla', 'resolved_at', 'sla_due', 'reopen_count'],
  rfac: ['number', 'opened_at', 'assignment_group', 'state', 'type', 'short_description', 'priority', 'risk', 'impact', 'backout_plan'],
  problems: ['number', 'opened_at', 'assignment_group', 'state', 'known_error', 'short_description', 'priority', 'workaround']
};

const TEMPLATE_NAMES = {
  incidents: 'Incidents',
  service_requests: 'Service Requests',
  rfac: 'Change Requests',
  problems: 'Problems'
};

function downloadTemplate(type) {
  if (typeof XLSX === 'undefined') {
    showToast('XLSX library not loaded. Please check that js/xlsx.full.min.js exists.');
    return;
  }
  const cols = TEMPLATE_COLUMNS[type];
  if (!cols) return;
  const ws = XLSX.utils.aoa_to_sheet([cols]);
  ws['!cols'] = cols.map(function () { return { wch: 22 }; });
  ws['!rows'] = [{ hpx: 20 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, TEMPLATE_NAMES[type] || type);
  XLSX.writeFile(wb, 'template_' + type + '.xlsx');
}

/* ────────────────────────────
   XLSX UPLOAD HANDLER
──────────────────────────── */

const TYPE_LABELS = {
  incidents: 'inc',
  service_requests: 'sr',
  rfac: 'rfac',
  problems: 'prb'
};

const UPLOAD_REQUIRED_COLUMNS = {
  incidents: ['number', 'opened_at', 'assignment_group', 'priority', 'state'],
  service_requests: ['number', 'opened_at', 'assignment_group', 'priority', 'state'],
  rfac: ['number', 'opened_at', 'assignment_group', 'state'],
  problems: ['number', 'opened_at', 'assignment_group', 'state']
};

function handleXLSXUpload(event, type) {
  const file = event.target.files[0];
  if (!file) return;

  const lbl = TYPE_LABELS[type] || type;
  const statusEl = document.getElementById('ds-' + lbl);
  const infoEl = document.getElementById('info-' + lbl);
  const valEl = document.getElementById('val-' + lbl);
  const dzEl = document.getElementById('dz-' + lbl);

  statusEl.className = 'dz-status warn';
  statusEl.textContent = 'Reading file...';
  dzEl.className = 'dropzone loading';
  document.getElementById('badge-' + lbl).className = 'fbadge';
  document.getElementById('badge-' + lbl).querySelector('span').textContent = lbl.toUpperCase() + ' (...)';

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      if (typeof XLSX === 'undefined') {
        statusEl.className = 'dz-status err';
        statusEl.textContent = '[ERROR] XLSX library not loaded.';
        dzEl.className = 'dropzone err';
        return;
      }
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      if (!jsonData || jsonData.length === 0) {
        statusEl.className = 'dz-status err';
        statusEl.textContent = '[ERROR] Empty or unreadable sheet.';

        dzEl.className = 'dropzone err';
        return;
      }

      const required = UPLOAD_REQUIRED_COLUMNS[type] || [];
      const check = validateColumns(jsonData, required);

      if (check.valid) {
        editorState.uploadedFiles[type] = jsonData;
        statusEl.className = 'dz-status ok';
        statusEl.textContent = '[OK] Loaded ' + jsonData.length + ' records.';
        dzEl.className = 'dropzone ok';
        document.getElementById('badge-' + lbl).className = 'fbadge ok';
        document.getElementById('badge-' + lbl).querySelector('span').textContent = lbl.toUpperCase() + ' (' + jsonData.length + ')';
        infoEl.textContent = 'Columns: ' + Object.keys(jsonData[0]).join(', ');
        valEl.innerHTML = renderValidationReport(jsonData, type, required);
        saveFullState();
        updateNavLocking();
      } else {
        statusEl.className = 'dz-status err';
        var errMsg = '[ERROR] Missing columns: ' + check.missing.join(', ');
        if (check.suggestions && check.suggestions.length > 0) {
          errMsg += ' | Did you mean: ' + check.suggestions.map(function (s) { return s.found + ' (as ' + s.expected + ')'; }).join(', ') + '?';
        }
        statusEl.textContent = errMsg;
        dzEl.className = 'dropzone err';
        infoEl.textContent = 'Found columns: ' + Object.keys(jsonData[0]).join(', ');
        valEl.innerHTML = '';
      }
    } catch (err) {
      statusEl.className = 'dz-status err';
      statusEl.textContent = '[ERROR] ' + err.message;
      dzEl.className = 'dropzone err';
    }
  };
  reader.onerror = function () {
    statusEl.className = 'dz-status err';
    statusEl.textContent = '[ERROR] Failed to read file. The file may be too large or inaccessible.';
    dzEl.className = 'dropzone err';
  };
  reader.onabort = function () {
    statusEl.className = 'dz-status err';
    statusEl.textContent = '[ERROR] File read was aborted.';
    dzEl.className = 'dropzone err';
  };
  reader.readAsArrayBuffer(file);
  event.target.value = '';
}

function processXLSXUpload(file, type, callback) {
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      editorState.uploadedFiles[type] = jsonData;
      callback(jsonData);
    } catch (err) {
      showToast('Error processing XLSX file: ' + err.message);
    }
  };
  reader.onerror = function () {
    showToast("Error reading file. The file may be too large or inaccessible.");
  };
  reader.onabort = function () {
    showToast("File read was aborted.");
  };
  reader.readAsArrayBuffer(file);
}

function validateColumns(data, requiredCols) {
  if (data.length === 0) return { valid: false, missing: requiredCols, suggestions: [] };
  var headers = Object.keys(data[0]);
  var headersLower = headers.map(function (h) { return h.toLowerCase().trim(); });
  var missing = [];
  var suggestions = [];
  requiredCols.forEach(function (c) {
    var cl = c.toLowerCase().trim();
    if (headersLower.indexOf(cl) === -1) {
      var closeMatch = headersLower.filter(function (h) { return h.replace(/[^a-z0-9]/g, '') === cl.replace(/[^a-z0-9]/g, '') || h.indexOf(cl) !== -1 || cl.indexOf(h) !== -1; });
      if (closeMatch.length > 0) {
        suggestions.push({ expected: c, found: headers[headersLower.indexOf(closeMatch[0])] });
      } else {
        missing.push(c);
      }
    }
  });
  return { valid: missing.length === 0, missing: missing, suggestions: suggestions };
}

function renderValidationReport(data, type, required) {
  const cfg = getConfig();

  let validStates = [];
  if (type === 'incidents' || type === 'service_requests') {
    validStates = cfg.validValues?.incidentStates || [];
  } else if (type === 'rfac') {
    validStates = cfg.validValues?.rfacStates || [];
  } else if (type === 'problems') {
    validStates = cfg.validValues?.prbStates || [];
  }

  const checkPriority = (type === 'incidents' || type === 'service_requests');
  const validPriorities = checkPriority ? (cfg.validValues?.priorities || []) : [];

  let totalRows = data.length;
  let missingPriority = 0, missingState = 0, missingGroup = 0;
  let invalidPriority = 0, invalidState = 0;
  let dupCount = 0, badDateCount = 0, unmappedCount = 0;
  let sampleErrors = [];
  let seenNumbers = {};

  data.forEach(function (row) {
    const p = getVal(row, 'priority');
    const s = getVal(row, 'state');
    const g = getVal(row, 'assignment_group') || getVal(row, 'assignment group');
    const num = getVal(row, 'number');

    if (num) {
      if (seenNumbers[num]) { dupCount++; }
      else { seenNumbers[num] = true; }
    }

    if (!g) missingGroup++;
    if (!p) missingPriority++;
    if (!s) missingState++;

    if (g && !cfg.mappings[g.trim()]) unmappedCount++;

    const opened = getVal(row, 'opened_at') || getVal(row, 'opened');
    if (opened && !parseDate(opened)) {
      badDateCount++;
      if (sampleErrors.length < 5) sampleErrors.push({ row: num || '?', field: 'opened_at', value: opened, issue: 'Invalid date format' });
    }

    if (p && checkPriority && validPriorities.length > 0 && !validPriorities.some(function (vp) { return p.toString().toLowerCase() === vp.toLowerCase(); })) {
      invalidPriority++;
      if (sampleErrors.length < 5) sampleErrors.push({ row: num || '?', field: 'priority', value: p, issue: 'Unrecognised priority value' });
    }
    if (s && validStates.length > 0 && !validStates.some(function (vs) { return s.toString().toLowerCase() === vs.toLowerCase(); })) {
      invalidState++;
      if (sampleErrors.length < 5) sampleErrors.push({ row: num || '?', field: 'state', value: s, issue: 'Unrecognised state value' });
    }
  });

  let issueCount = dupCount + badDateCount + missingGroup + unmappedCount + missingPriority + missingState + invalidPriority + invalidState;
  let hasErrors = badDateCount > 0 || invalidPriority > 0 || invalidState > 0;
  let hasWarnings = !hasErrors && issueCount > 0;
  var typeLabels = { incidents: 'Incidents', service_requests: 'Service Requests', rfac: 'Change Requests', problems: 'Problems' };
  let typeLabel = typeLabels[type] || type;

  let html = '<div class="val-report">';

  // Banner — RTB style
  if (issueCount === 0) {
    html += '<div class="val-banner ok">\u2705 Validation passed &mdash; ' + totalRows.toLocaleString() + ' rows loaded successfully from ' + typeLabel + '</div>';
  } else if (hasErrors) {
    html += '<div class="val-banner err">\u274C ' + issueCount + ' issue' + (issueCount > 1 ? 's' : '') + ' found in ' + typeLabel + ' &mdash; review details below</div>';
  } else {
    html += '<div class="val-banner warn">\u26A0\uFE0F ' + issueCount + ' warning' + (issueCount > 1 ? 's' : '') + ' found in ' + typeLabel + ' &mdash; review details below</div>';
  }

  // Summary stat badges
  html += '<div class="val-summary">';
  html += '<span class="val-stat ok"><span class="val-stat-num">' + totalRows + '</span> Total Rows</span>';
  html += '<span class="val-stat ' + (dupCount === 0 ? 'ok' : 'warn') + '"><span class="val-stat-num">' + dupCount + '</span> Duplicates</span>';
  html += '<span class="val-stat ' + (badDateCount === 0 ? 'ok' : 'err') + '"><span class="val-stat-num">' + badDateCount + '</span> Bad Dates</span>';
  html += '<span class="val-stat ' + (missingGroup === 0 ? 'ok' : 'warn') + '"><span class="val-stat-num">' + missingGroup + '</span> Missing Group</span>';
  html += '<span class="val-stat ' + (unmappedCount === 0 ? 'ok' : 'warn') + '"><span class="val-stat-num">' + unmappedCount + '</span> Unmapped Groups</span>';
  html += '<span class="val-stat ' + (missingPriority === 0 ? 'ok' : 'warn') + '"><span class="val-stat-num">' + missingPriority + '</span> Missing Priority</span>';
  html += '<span class="val-stat ' + (missingState === 0 ? 'ok' : 'warn') + '"><span class="val-stat-num">' + missingState + '</span> Missing State</span>';
  if (checkPriority && validPriorities.length > 0) html += '<span class="val-stat ' + (invalidPriority === 0 ? 'ok' : 'err') + '"><span class="val-stat-num">' + invalidPriority + '</span> Invalid Priority</span>';
  if (validStates.length > 0) html += '<span class="val-stat ' + (invalidState === 0 ? 'ok' : 'err') + '"><span class="val-stat-num">' + invalidState + '</span> Invalid State</span>';
  html += '</div>';

  // Sample errors table — RTB scrollable style
  if (sampleErrors.length > 0) {
    html += '<div class="val-table-wrap"><table class="val-table"><thead><tr><th>Row</th><th>Field</th><th>Value</th><th>Issue</th></tr></thead><tbody>';
    sampleErrors.forEach(function (e) {
      html += '<tr><td>' + escHtml(e.row) + '</td><td>' + e.field + '</td><td>' + escHtml(e.value) + '</td><td>' + escHtml(e.issue) + '</td></tr>';
    });
    html += '</tbody></table></div>';
  }

  html += '</div>';
  return html;
}

/* ────────────────────────────
   HELPER FUNCTIONS
──────────────────────────── */

function parseDate(str) {
  if (!str) return null;
  str = str.toString().trim();
  if (str === '') return null;

  let m = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2}):(\d{2}))?$/);
  if (m) {
    return new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]), m[4] ? parseInt(m[4]) : 0, m[5] ? parseInt(m[5]) : 0, m[6] ? parseInt(m[6]) : 0);
  }

  m = str.match(/^(\d{2})-(\d{2})-(\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?$/);
  if (m) {
    return new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]), m[4] ? parseInt(m[4]) : 0, m[5] ? parseInt(m[5]) : 0, m[6] ? parseInt(m[6]) : 0);
  }

  m = str.match(/^(\d{4})\/(\d{2})\/(\d{2})(?:\s+(\d{2}):(\d{2}):(\d{2}))?$/);
  if (m) {
    return new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]), m[4] ? parseInt(m[4]) : 0, m[5] ? parseInt(m[5]) : 0, m[6] ? parseInt(m[6]) : 0);
  }

  m = str.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?$/);
  if (m) {
    return new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]), m[4] ? parseInt(m[4]) : 0, m[5] ? parseInt(m[5]) : 0, m[6] ? parseInt(m[6]) : 0);
  }

  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function clampNumber(val, min, max) {
  var n = Number(val);
  if (isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function validatePct(val) {
  return clampNumber(val, 0, 100);
}

function validatePositive(val) {
  return Math.max(0, Number(val) || 0);
}

function showToast(msg, isError) {
  var t = document.getElementById('editor-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'editor-toast';
    t.style.cssText = 'position:fixed;top:12px;right:12px;z-index:9999;background:#1f2937;color:#fff;padding:10px 18px;border-radius:6px;font-size:13px;box-shadow:0 4px 12px rgba(0,0,0,.3);max-width:360px;transition:opacity .3s;opacity:0;pointer-events:none';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  if (isError) {
    t.style.background = '#7f1d1d';
  } else {
    t.style.background = '#1f2937';
  }
  t.style.opacity = '1';
  if (window.__toastTimer) clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(function () { t.style.opacity = '0'; }, 5000);
}

function getMonthLabel(date, includeYear) {
  if (!date) return '';
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var lbl = months[date.getMonth()];
  if (includeYear) lbl += " '" + date.getFullYear().toString().slice(-2);
  return lbl;
}

function getYearMonthString(date) {
  if (!date) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return y + '-' + m;
}

/* ────────────────────────────
   MONTH DETECTION HELPERS
   Months are derived from the report date anchor
──────────────────────────── */
function getCW(date) {
  var d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  var dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

function detectMonthsFromData() {
  var cfg = getConfig();
  var anchor = cfg.general.reportDate ? parseDate(cfg.general.reportDate) : new Date();
  if (!anchor) anchor = new Date();
  var lk = cfg.general.lookbackMonths || 6;
  var labels = [], full = [];
  for (var i = lk - 1; i >= 0; i--) {
    var d = new Date(anchor.getFullYear(), anchor.getMonth() - i, 1);
    labels.push(getMonthLabel(d));
    full.push(getYearMonthString(d));
  }
  var monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var periodStr = monthNames[anchor.getMonth()] + ' ' + anchor.getFullYear() + ' (CW' + getCW(anchor) + ')';
  return { months: labels, monthsFull: full, period: periodStr, reportDate: cfg.general.reportDate || anchor.toISOString().split('T')[0], anchor: anchor };
}

function getVal(row, key) {
  const normalizedKey = key.toLowerCase();
  for (const k of Object.keys(row)) {
    if (k.toLowerCase() === normalizedKey) {
      return row[k];
    }
  }
  return null;
}

/* ────────────────────────────
   NAV LOCKING
──────────────────────────── */

function visitSection(sectionId) {
  if (!editorState.visitedSections) editorState.visitedSections = {};
  editorState.visitedSections[sectionId] = true;
  updateNavLocking();
  saveFullState();
}

function isSectionVisited(sectionId) {
  return !!(editorState.visitedSections && editorState.visitedSections[sectionId]);
}

function updateNavLocking() {
  const hasImport = !!(editorState.uploadedFiles.incidents && editorState.uploadedFiles.service_requests);
  const hasCalc = !!(editorState.calculatedData && editorState.calculatedData.modules);

  setNavState('nav-config', isSectionVisited('config') ? 'done' : '', false);
  setNavState('nav-import', hasImport || isSectionVisited('import') ? 'done' : '', false);
  setNavState('nav-preview', hasCalc || isSectionVisited('preview') ? 'done' : '', false);
  setNavState('nav-meta', isSectionVisited('meta') ? 'done' : '', false);
  setNavState('nav-manual', isSectionVisited('manual') ? 'done' : '', false);
  setNavState('nav-export', hasCalc || isSectionVisited('export') ? 'done' : '', false);
}

function setNavState(navId, cls, locked) {
  const el = document.getElementById(navId);
  if (!el) return;
  el.classList.remove('done', 'locked');
  if (cls) el.classList.add(cls);
  if (locked) el.classList.add('locked');
  else el.classList.remove('locked');
}

/* ────────────────────────────
   CALCULATION ENGINE
──────────────────────────── */

function triggerCalculation() {
  const hasData = !!(editorState.calculatedData && editorState.calculatedData.modules && editorState.calculatedData.modules.length > 0);
  const hasInc = editorState.uploadedFiles.incidents && editorState.uploadedFiles.incidents.length > 0;
  const hasSr = editorState.uploadedFiles.service_requests && editorState.uploadedFiles.service_requests.length > 0;
  if (!hasInc && !hasSr && !hasData) {
    showToast('Please upload at least Incidents and/or Service Requests XLSX files, or load a previous JSON before calculating.');
    return;
  }
  if (!hasInc && !hasSr && hasData) {
    showToast('Recalculating from imported data with current configuration...');
  }
  runCalculationEngine();
  populateModuleSelector();
  renderModulePreviewDetails();
  loadMetadataFields();
  switchTab('preview');
}

function runCalculationEngine() {
  try {
  const cfg = getConfig();
  const incData = editorState.uploadedFiles.incidents || [];
  const srData = editorState.uploadedFiles.service_requests || [];
  const rfacData = editorState.uploadedFiles.rfac || [];
  const prbData = editorState.uploadedFiles.problems || [];

  const today = new Date();
  const thresholds = cfg.thresholds || DEFAULT_CONFIG.thresholds;
  const modules = cfg.modules || DEFAULT_CONFIG.modules;
  const mappings = cfg.mappings || {};
  const baselines = cfg.baselines || {};
  const lookbackMonths = Math.max(1, cfg.general.lookbackMonths || 6);
  const latestMonthIdx = lookbackMonths - 1;
  const priorMonthIdx = Math.max(0, lookbackMonths - 2);

  // Collect all dates for month detection
  let allDates = [];
  incData.forEach(function (row) {
    const opened = parseDate(getVal(row, 'opened_at') || getVal(row, 'opened'));
    if (opened) allDates.push(opened);
  });
  srData.forEach(function (row) {
    const opened = parseDate(getVal(row, 'opened_at') || getVal(row, 'opened'));
    if (opened) allDates.push(opened);
  });
  if (allDates.length === 0) allDates.push(today);
  allDates.sort(function (a, b) { return a - b; });
  const latestDate = allDates[allDates.length - 1];
  var reportEndDate = new Date(latestDate.getFullYear(), latestDate.getMonth() + 1, 0, 23, 59, 59);

  const monthsArray = [];
  for (let i = lookbackMonths - 1; i >= 0; i--) {
    const d = new Date(latestDate.getFullYear(), latestDate.getMonth() - i, 1);
    monthsArray.push({ label: getMonthLabel(d, lookbackMonths > 12), value: getYearMonthString(d), year: d.getFullYear(), month: d.getMonth() });
  }
  const latestMonthVal = monthsArray[latestMonthIdx].value;

  const pfxs = cfg.ticketTypePrefixes || DEFAULT_CONFIG.ticketTypePrefixes;

  function getModuleId(assignmentGroup) {
    if (!assignmentGroup) return null;
    return mappings[assignmentGroup.trim()] || null;
  }

  function detectType(num) {
    if (!num) return 'SR';
    for (let pi = 0; pi < pfxs.length; pi++) {
      if (num.startsWith(pfxs[pi].prefix)) return pfxs[pi].type;
    }
    return 'SR';
  }

  function makeMonthArray(initVal) {
    var arr = [];
    for (var i = 0; i < lookbackMonths; i++) arr.push(initVal);
    return arr;
  }
  function zeroArr(n) {
    var a = [];
    for (var i = 0; i < n; i++) a.push(0);
    return a;
  }

  const pBuckets = cfg.priorityBuckets || DEFAULT_CONFIG.priorityBuckets;
  const aBuckets = cfg.ageBuckets || DEFAULT_CONFIG.ageBuckets;
  const bucketCount = pBuckets.length;
  const ageBucketCount = aBuckets.length;

  const modulesResults = {};
  modules.forEach(function (m) {
    modulesResults[m.id] = {
      id: m.id, name: m.name, domain: m.domain,
      baseline: baselines[m.id] || 50,
      mom: makeMonthArray(0),
      incMom: makeMonthArray(0),
      srMom: makeMonthArray(0),
      resolvedMom: makeMonthArray(0),
      netFlowMom: makeMonthArray(0),
      backlogMom: makeMonthArray(0),
      respSlaMom: makeMonthArray(100),
      resolSlaMom: makeMonthArray(100),
      inc: 0, sr: 0, total: 0, resolved: 0, netFlow: 0, openCount: 0,
      respSla: null, resolSla: null, mttr: null, reopenRate: null, firstFixRate: null,
      breachCount: 0, nearMissCount: 0, escalationRate: null,
      age: zeroArr(ageBucketCount), priority: zeroArr(bucketCount), automation: 0, notes: [],
      _ageBuckets: aBuckets, _priorityBuckets: pBuckets
    };
  });

  const ticketList = [];

  function processTicketRows(rows, defaultType) {
    rows.forEach(function (row) {
      const ticketNum = getVal(row, 'number');
      if (!ticketNum) return;
      const openedDate = parseDate(getVal(row, 'opened_at') || getVal(row, 'opened'));
      if (!openedDate) return;
      const group = getVal(row, 'assignment_group') || getVal(row, 'assignment group');
      const moduleId = getModuleId(group);
      if (!moduleId) return;

      const type = defaultType || detectType(ticketNum);
      const state = (getVal(row, 'state') || '').trim();
      const resolvedDate = parseDate(getVal(row, 'resolved_at') || getVal(row, 'resolved'));
      const closedDate = parseDate(getVal(row, 'closed_at') || getVal(row, 'closed'));

      let madeSla = true;
      const msRaw = getVal(row, 'made_sla') || getVal(row, 'made sla');
      if (msRaw !== null) {
        const msStr = msRaw.toString().toLowerCase().trim();
        if (msStr === 'false' || msStr === 'no' || msStr === '0') madeSla = false;
      }

      const slaDue = parseDate(getVal(row, 'sla_due') || getVal(row, 'sla due'));
      const reopenCount = parseInt(getVal(row, 'reopen_count') || getVal(row, 'reopen count') || '0', 10);
      const escalation = parseInt(getVal(row, 'escalation') || '0', 10);
      const rfc = getVal(row, 'rfc') || getVal(row, 'caused_by_change');
      const problem = getVal(row, 'problem_id') || getVal(row, 'problem');
      const priorityRaw = getVal(row, 'priority') || '4';

      let priority = 4;
      const pm = cfg.priorityMappings || [];
      const rawStr = priorityRaw.toString().toLowerCase().trim();
      const rawNum = parseInt(rawStr, 10);
      let matched = false;
      for (let pi = 0; pi < pm.length; pi++) {
        if (rawStr.includes(pm[pi].label.toLowerCase()) || new RegExp('\\b' + pm[pi].value + '\\b').test(rawStr)) {
          priority = pm[pi].value;
          matched = true;
          break;
        }
      }
      if (!matched && !isNaN(rawNum)) { priority = rawNum; }

      const yymm = getYearMonthString(openedDate);

      ticketList.push({
        number: ticketNum, openedDate, resolvedDate, type, moduleId, state,
        madeSla, slaDue, reopenCount, escalation, rfc, problem, priority, yymm
      });
    });
  }

  processTicketRows(incData, 'INC');
  processTicketRows(srData, 'SR');

  /* Group ticketList by moduleId + yymm for O(1) lookups */
  var ticketsByModYymm = {};
  ticketList.forEach(function (t) {
    var key = t.moduleId + '|' + t.yymm;
    if (!ticketsByModYymm[key]) ticketsByModYymm[key] = [];
    ticketsByModYymm[key].push(t);
  });

  /* Group by moduleId alone for per-module scans */
  var ticketsByMod = {};
  ticketList.forEach(function (t) {
    if (!ticketsByMod[t.moduleId]) ticketsByMod[t.moduleId] = [];
    ticketsByMod[t.moduleId].push(t);
  });

  monthsArray.forEach(function (mObj, index) {
    modules.forEach(function (mod) {
      const res = modulesResults[mod.id];
      const monthVal = mObj.value;

      var modYymmKey = mod.id + '|' + monthVal;
      var openedInMonth = ticketsByModYymm[modYymmKey] || [];
      var incCount = 0, srCount = 0;
      for (var ti = 0; ti < openedInMonth.length; ti++) {
        if (openedInMonth[ti].type === 'INC') incCount++; else srCount++;
      }
      res.mom[index] = incCount + srCount;
      res.incMom[index] = incCount;
      res.srMom[index] = srCount;

      var resolvedInMonth = [];
      var allModTickets = ticketsByMod[mod.id] || [];
      for (var ri = 0; ri < allModTickets.length; ri++) {
        var t = allModTickets[ri];
        if (t.resolvedDate && getYearMonthString(t.resolvedDate) === monthVal) resolvedInMonth.push(t);
      }
      res.resolvedMom[index] = resolvedInMonth.length;
      res.netFlowMom[index] = res.mom[index] - res.resolvedMom[index];

      var endOfMonth = new Date(mObj.year, mObj.month + 1, 0, 23, 59, 59);
      var backlogCount = 0;
      for (var bi = 0; bi < allModTickets.length; bi++) {
        var bt = allModTickets[bi];
        if (bt.openedDate <= endOfMonth && (!bt.resolvedDate || bt.resolvedDate > endOfMonth)) backlogCount++;
      }
      res.backlogMom[index] = backlogCount;

      var withResponseSla = 0, metResponseSla = 0;
      for (var si = 0; si < openedInMonth.length; si++) {
        if (openedInMonth[si].madeSla !== null) {
          withResponseSla++;
          if (openedInMonth[si].madeSla) metResponseSla++;
        }
      }
      res.respSlaMom[index] = withResponseSla > 0 ? (metResponseSla / withResponseSla) * 100 : 100;

      var withResolSla = 0, metResolSla = 0;
      for (var ti2 = 0; ti2 < resolvedInMonth.length; ti2++) {
        if (resolvedInMonth[ti2].slaDue !== null) {
          withResolSla++;
          if (resolvedInMonth[ti2].resolvedDate <= resolvedInMonth[ti2].slaDue) metResolSla++;
        }
      }
      res.resolSlaMom[index] = withResolSla > 0 ? (metResolSla / withResolSla) * 100 : 100;
    });
  });

  modules.forEach(function (mod) {
    const res = modulesResults[mod.id];

    res.inc = res.incMom[latestMonthIdx];
    res.sr = res.srMom[latestMonthIdx];
    res.total = res.mom[latestMonthIdx];
    res.resolved = res.resolvedMom[latestMonthIdx];
    res.netFlow = res.netFlowMom[latestMonthIdx];

    var modTickets = ticketsByMod[mod.id] || [];
    var latestKey = mod.id + '|' + latestMonthVal;
    var openedCurrentMonth = ticketsByModYymm[latestKey] || [];
    var resolvedCurrentMonth = [];
    for (var ri2 = 0; ri2 < modTickets.length; ri2++) {
      var tt = modTickets[ri2];
      if (tt.resolvedDate && getYearMonthString(tt.resolvedDate) === latestMonthVal) resolvedCurrentMonth.push(tt);
    }

    var respSlaTicks = 0, respSlaMet = 0;
    for (var si2 = 0; si2 < openedCurrentMonth.length; si2++) {
      if (openedCurrentMonth[si2].madeSla !== null) {
        respSlaTicks++;
        if (openedCurrentMonth[si2].madeSla) respSlaMet++;
      }
    }
    res.respSla = respSlaTicks > 0 ? (respSlaMet / respSlaTicks) * 100 : null;

    var resolSlaTicks = 0, resolSlaMet = 0;
    for (var ri3 = 0; ri3 < resolvedCurrentMonth.length; ri3++) {
      if (resolvedCurrentMonth[ri3].slaDue !== null) {
        resolSlaTicks++;
        if (resolvedCurrentMonth[ri3].resolvedDate <= resolvedCurrentMonth[ri3].slaDue) resolSlaMet++;
      }
    }
    res.resolSla = resolSlaTicks > 0 ? (resolSlaMet / resolSlaTicks) * 100 : null;

    var totalResolveTimeHrs = 0;
    for (var ri4 = 0; ri4 < resolvedCurrentMonth.length; ri4++) {
      totalResolveTimeHrs += (resolvedCurrentMonth[ri4].resolvedDate - resolvedCurrentMonth[ri4].openedDate) / (1000 * 60 * 60);
    }
    res.mttr = resolvedCurrentMonth.length > 0 ? (totalResolveTimeHrs / resolvedCurrentMonth.length) : null;

    var reopenedCount = 0;
    for (var si3 = 0; si3 < openedCurrentMonth.length; si3++) {
      if (openedCurrentMonth[si3].reopenCount > 0) reopenedCount++;
    }
    // Note: reopen-rate metric is inherently approximate; reopenCount may be set during creation quality checks even for never-resolved tickets
    res.reopenRate = openedCurrentMonth.length > 0 ? (reopenedCount / openedCurrentMonth.length) * 100 : null;

    var firstFixCount = 0;
    for (var ri5 = 0; ri5 < resolvedCurrentMonth.length; ri5++) {
      if (resolvedCurrentMonth[ri5].reopenCount === 0) firstFixCount++;
    }
    res.firstFixRate = resolvedCurrentMonth.length > 0 ? (firstFixCount / resolvedCurrentMonth.length) * 100 : null;

    var breachCount = 0;
    for (var ri6 = 0; ri6 < resolvedCurrentMonth.length; ri6++) {
      if (!resolvedCurrentMonth[ri6].madeSla) breachCount++;
    }
    res.breachCount = breachCount;

    var nearMisses = 0;
    for (var ri7 = 0; ri7 < resolvedCurrentMonth.length; ri7++) {
      var tx = resolvedCurrentMonth[ri7];
      if (tx.slaDue && tx.openedDate && tx.resolvedDate <= tx.slaDue) {
        var totalDuration = tx.slaDue - tx.openedDate;
        if (totalDuration > 0) {
          var ratio = (tx.resolvedDate - tx.openedDate) / totalDuration;
          if (ratio >= thresholds.nearMissRatio && ratio <= 1.0) nearMisses++;
        }
      }
    }
    res.nearMissCount = nearMisses;

    var escalatedCount = 0;
    for (var si5 = 0; si5 < openedCurrentMonth.length; si5++) {
      if (openedCurrentMonth[si5].escalation >= thresholds.escalationThreshold) escalatedCount++;
    }
    res.escalationRate = openedCurrentMonth.length > 0 ? (escalatedCount / openedCurrentMonth.length) * 100 : null;

    var closedStates = cfg.stateMappings.closedStates || DEFAULT_CONFIG.stateMappings.closedStates;
    var openCount = 0;
    var currentOpenTickets = [];
    for (var mi = 0; mi < modTickets.length; mi++) {
      var mt = modTickets[mi];
      var isClosed = false;
      for (var ci = 0; ci < closedStates.length; ci++) {
        if (mt.state.toLowerCase().includes(closedStates[ci].toLowerCase())) { isClosed = true; break; }
      }
      if (!isClosed) { openCount++; currentOpenTickets.push(mt); }
    }
    res.openCount = openCount;

    // Dynamic age bucket categorization
    var ageCounts = zeroArr(ageBucketCount);
    currentOpenTickets.forEach(function (t) {
      var ageDays = (reportEndDate - t.openedDate) / (1000 * 60 * 60 * 24);
      for (var bi = 0; bi < aBuckets.length; bi++) {
        if (aBuckets[bi].maxDays === null || ageDays <= aBuckets[bi].maxDays) {
          ageCounts[bi]++;
          break;
        }
      }
    });
    if (res.openCount > 0) {
      for (var bi = 0; bi < ageBucketCount; bi++) res.age[bi] = (ageCounts[bi] / res.openCount) * 100;
    } else {
      res.age[0] = 100;
    }

    // Dynamic priority bucket categorization
    var priorityCounts = zeroArr(bucketCount);
    openedCurrentMonth.forEach(function (t) {
      for (var bi = 0; bi < pBuckets.length; bi++) {
        if (pBuckets[bi].values.indexOf(t.priority) !== -1) {
          priorityCounts[bi]++;
          break;
        }
      }
    });
    var totalOpened = openedCurrentMonth.length;
    if (totalOpened > 0) {
      for (var bi = 0; bi < bucketCount; bi++) res.priority[bi] = (priorityCounts[bi] / totalOpened) * 100;
    } else {
      res.priority[0] = 100;
    }

    res.priorityMeta = pBuckets.map(function (pb, i) { return { label: pb.label, color: pb.color, pct: res.priority[i] || 0 }; });
    res.ageMeta = aBuckets.map(function (ab, i) { return { label: ab.label, color: ab.color, pct: res.age[i] || 0 }; });
    res.notes = editorState.manualData.modulesNotes ? (editorState.manualData.modulesNotes[mod.id] || []) : [];
  });

  // RFAC Analysis
  const rfacResults = {};
  modules.forEach(function (mod) {
    rfacResults[mod.id] = {
      moduleId: mod.id, openCount: 0, under8wPct: 100, under12wPct: 100,
      emergencyCount: 0, cycleTimeAvgDays: 0, slaCompliant: true
    };

    const modRfacs = rfacData.filter(function (row) {
      const grp = getVal(row, 'assignment_group') || getVal(row, 'assignment group');
      return getModuleId(grp) === mod.id;
    });

    rfacResults[mod.id].openCount = modRfacs.length;

    if (modRfacs.length > 0) {
      let ageSum = 0, under8w = 0, under12w = 0, emergency = 0;
      modRfacs.forEach(function (row) {
        const opened = parseDate(getVal(row, 'opened_at') || getVal(row, 'opened'));
        const ageDays = opened ? Math.max(0, (today - opened) / (1000 * 60 * 60 * 24)) : 0;
        ageSum += ageDays;
        if (ageDays <= thresholds.rfacUnder8wDays) under8w++;
        if (ageDays <= thresholds.rfacUnder12wDays) under12w++;
        const type = (getVal(row, 'type') || '').toLowerCase();
        if ((cfg.emergencyKeywords || ['emergency']).some(function (kw) { return type.includes(kw.toLowerCase()); })) emergency++;
      });
      const tot = modRfacs.length;
      rfacResults[mod.id].under8wPct = (under8w / tot) * 100;
      rfacResults[mod.id].under12wPct = (under12w / tot) * 100;
      rfacResults[mod.id].emergencyCount = emergency;
      rfacResults[mod.id].cycleTimeAvgDays = ageSum / tot;
      rfacResults[mod.id].slaCompliant = (rfacResults[mod.id].under8wPct >= thresholds.rfacUnder8wPct) && (rfacResults[mod.id].under12wPct >= thresholds.rfacUnder12wPct);
    }
  });

  // PRB Analysis
  const prbResults = {};
  modules.forEach(function (mod) {
    prbResults[mod.id] = {
      moduleId: mod.id, openCount: 0, under3mPct: 100, under6mPct: 100,
      knownErrorCount: 0, oldestDays: 0
    };

    const modPrbs = prbData.filter(function (row) {
      const grp = getVal(row, 'assignment_group') || getVal(row, 'assignment group');
      return getModuleId(grp) === mod.id;
    });

    prbResults[mod.id].openCount = modPrbs.length;

    if (modPrbs.length > 0) {
      let maxAge = 0, under3m = 0, under6m = 0, knownErr = 0;
      modPrbs.forEach(function (row) {
        const opened = parseDate(getVal(row, 'opened_at') || getVal(row, 'opened'));
        const ageDays = opened ? Math.max(0, (today - opened) / (1000 * 60 * 60 * 24)) : 0;
        if (ageDays > maxAge) maxAge = ageDays;
        if (ageDays <= thresholds.prbUnder3mDays) under3m++;
        if (ageDays <= thresholds.prbUnder6mDays) under6m++;
        const ke = getVal(row, 'known_error') || getVal(row, 'known error');
        if ((cfg.knownErrorValues || [true, 'true', '1', 'Yes']).some(function (kv) { return ke === kv || ke === String(kv); })) knownErr++;
      });
      const tot = modPrbs.length;
      prbResults[mod.id].under3mPct = (under3m / tot) * 100;
      prbResults[mod.id].under6mPct = (under6m / tot) * 100;
      prbResults[mod.id].knownErrorCount = knownErr;
      prbResults[mod.id].oldestDays = maxAge;
    }
  });

  // Global Portfolio Calculations — iterate over all unique domains dynamically
  var uniqueDomains = [];
  modules.forEach(function (m) {
    if (uniqueDomains.indexOf(m.domain) === -1) uniqueDomains.push(m.domain);
  });

  var globalSummary = { domains: {} };
  uniqueDomains.forEach(function (domain) {
    var domainMods = modules.filter(function (m) { return m.domain === domain; });
    var total = 0, backlog = 0, slaWeightSum = 0, slaResolvedCount = 0;
    var priorTotal = 0, priorBacklog = 0, priorSlaSum = 0, priorSlaResolved = 0;

    domainMods.forEach(function (mod) {
      var res = modulesResults[mod.id];
      total += res.total;
      backlog += res.openCount;
      if (res.resolSla !== null) { slaWeightSum += res.resolSla * res.resolved; slaResolvedCount += res.resolved; }
      priorTotal += res.mom[priorMonthIdx];
      priorBacklog += res.backlogMom[priorMonthIdx];
      if (res.resolSlaMom[priorMonthIdx] !== null) { priorSlaSum += res.resolSlaMom[priorMonthIdx] * res.resolvedMom[priorMonthIdx]; priorSlaResolved += res.resolvedMom[priorMonthIdx]; }
    });

    var slaComposite = slaResolvedCount > 0 ? (slaWeightSum / slaResolvedCount) : 100;
    var priorSlaComposite = priorSlaResolved > 0 ? (priorSlaSum / priorSlaResolved) : 100;

    var dKey = domain.replace(/[^a-zA-Z0-9]/g, '');
    globalSummary[dKey + 'Total'] = total;
    globalSummary[dKey + 'Backlog'] = backlog;
    globalSummary[dKey + 'SLAComposite'] = slaComposite;
    globalSummary[dKey + 'TotalDelta'] = priorTotal > 0 ? ((total - priorTotal) / priorTotal) * 100 : 0;
    globalSummary[dKey + 'BacklogDelta'] = priorBacklog > 0 ? ((backlog - priorBacklog) / priorBacklog) * 100 : 0;
    globalSummary[dKey + 'SLADelta'] = slaComposite - priorSlaComposite;
    globalSummary.domains[domain] = { total: total, backlog: backlog, slaComposite: slaComposite, priorTotal: priorTotal };
  });

  // Backward-compat aliases: if SAP domain exists, copy to sapTotal/nsTotal
  if (globalSummary.SAPTotal !== undefined) {
    globalSummary.sapTotal = globalSummary.SAPTotal;
    globalSummary.sapBacklog = globalSummary.SAPBacklog;
    globalSummary.sapSLAComposite = globalSummary.SAPSLAComposite;
    globalSummary.sapTotalDelta = globalSummary.SAPTotalDelta;
    globalSummary.sapBacklogDelta = globalSummary.SAPBacklogDelta;
    globalSummary.sapSLADelta = globalSummary.SAPSLADelta;
  }
  var nsKey = 'NonERPTotal';
  if (globalSummary[nsKey] !== undefined) {
    globalSummary.nsTotal = globalSummary[nsKey];
    globalSummary.nsBacklog = globalSummary.NonERPBacklog;
    globalSummary.nsSLAComposite = globalSummary.NonERPSLAComposite;
    globalSummary.nsTotalDelta = globalSummary.NonERPTotalDelta;
    globalSummary.nsBacklogDelta = globalSummary.NonERPBacklogDelta;
    globalSummary.nsSLADelta = globalSummary.NonERPSLADelta;
  }

  const monthsList = monthsArray.map(function (m) { return m.label; });
  const monthsFull = monthsArray.map(function (m) { return m.value; });

  editorState.calculatedData = {
    meta: {
      _schemaVersion: 1,
      title: cfg.general.title, confidentiality: cfg.general.confidentiality,
      portfolioOwner: cfg.general.portfolioOwner, period: cfg.general.period,
      reportDate: cfg.general.reportDate, lastUpdated: new Date().toISOString(),
      generatedAt: new Date().toISOString()
    },
    global: globalSummary, months: monthsList, monthsFull: monthsFull,
    modules: Object.values(modulesResults), rfac: rfacResults, prb: prbResults
  };

  saveFullState();
  updateNavLocking();
  } catch (e) { showToast('Calculation failed: ' + e.message); }
}

/* ────────────────────────────
   ASSEMBLE & EXPORT
──────────────────────────── */

function assembleFinalJSON() {
  const calc = editorState.calculatedData;
  if (!calc || !calc.meta) return null;

  const cfg = getConfig();

  var currentSchemaVersion = 1;
  if (calc.meta._schemaVersion && calc.meta._schemaVersion !== currentSchemaVersion) {
    showToast('Warning: loaded data schema version (' + calc.meta._schemaVersion + ') differs from current (' + currentSchemaVersion + '). Some fields may not map correctly.', true);
  }

  return {
    schemaVersion: 1,
    _instructions: {
      meta: "Report-level parameters like period name, dates, owner details.",
      pulse: "Key visual flag/announcement at the top of the dashboard.",
      global: "Computed composites for SAP and NonERP workstreams.",
      modules: "Detailed per-module metrics (calculated and overrides).",
      rfac: "Change Request backlog snapshot metrics.",
      prb: "Problem ticket backlog snapshot metrics.",
      actionItems: "Manually maintained operational action items.",
      projects: "High-level project status cards.",
      continuousImprovement: "Continuous Improvement initiatives track.",
      headcount: "AMS and Project FTE numbers, releases and backfills.",
      escalations: "Active operational escalations.",
      appreciations: "Kudos received from stakeholders during the period.",
      serviceOffers: "New service offerings / CCRs."
    },
    meta: calc.meta,
    pulse: { keyFlag: (editorState.manualData.pulse ? editorState.manualData.pulse.keyFlag : ""), generatedAt: calc.meta.lastUpdated },
    global: calc.global,
    months: calc.months,
    monthsFull: calc.monthsFull,
    modules: calc.modules.map(function (m) {
      var en = Object.assign({}, m);
      delete en._ageBuckets;
      delete en._priorityBuckets;
      // Architecture note: baseline values are embedded in the output for transparency;
      // the dashboard should read baselines from config at runtime rather than relying on this embedded copy.
      var modCfg = cfg.modules.find(function (c) { return c.id === m.id; });
      if (modCfg) {
        if (modCfg.fte !== undefined) {
          en.fte = modCfg.fte;
        }
        if (modCfg.slaThreshold && Object.keys(modCfg.slaThreshold).length > 0) {
          en.slaThreshold = Object.assign({}, modCfg.slaThreshold);
        }
      }
      return en;
    }),
    config: {
      priorityBuckets: cfg.priorityBuckets || [],
      ageBuckets: cfg.ageBuckets || [],
      lookbackMonths: cfg.general.lookbackMonths || 6,
      respSlaTarget: (cfg.thresholds || {}).respSlaTarget || 90,
      resolSlaTarget: (cfg.thresholds || {}).resolSlaTarget || 90
    },
    rfac: calc.rfac,
    prb: calc.prb,
    actionItems: editorState.manualData.actionItems || [],
    projects: editorState.manualData.projects || [],
    continuousImprovement: editorState.manualData.continuousImprovement || [],
    headcount: editorState.manualData.headcount || { sapAMS: cfg.fteDefaults.sapAMS, sapProjects: cfg.fteDefaults.sapProjects, nsAMS: cfg.fteDefaults.nsAMS, nsProjects: cfg.fteDefaults.nsProjects, releases: [] },
    escalations: editorState.manualData.escalations || [],
    appreciations: editorState.manualData.appreciations || [],
    serviceOffers: editorState.manualData.serviceOffers || []
  };
}

function exportJSONFile() {
  const finalObj = assembleFinalJSON();
  if (!finalObj) { showToast("Please upload datasets and compute operational metrics first."); return; }
  const blob = new Blob([JSON.stringify(finalObj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ops_data.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function copyJSONToClipboard() {
  const finalObj = assembleFinalJSON();
  if (!finalObj) { showToast("No calculations found to copy. Please run calculations first."); return; }
  navigator.clipboard.writeText(JSON.stringify(finalObj, null, 2))
    .then(function () { showToast("JSON copied to clipboard!"); })
    .catch(function (err) { showToast("Could not copy JSON: " + err); });
}

function importPreviousJSON(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const imported = JSON.parse(e.target.result);

      const cfg = getConfig();

      if (imported.meta) {
        cfg.general.title = imported.meta.title || cfg.general.title;
        cfg.general.period = imported.meta.period || cfg.general.period;
        cfg.general.portfolioOwner = imported.meta.portfolioOwner || cfg.general.portfolioOwner;
        cfg.general.confidentiality = imported.meta.confidentiality || cfg.general.confidentiality;
        cfg.general.reportDate = imported.meta.reportDate || cfg.general.reportDate;
        if (imported.meta.lookbackMonths !== undefined) cfg.general.lookbackMonths = imported.meta.lookbackMonths;
      }

            /* Ensure escalation items have module field */
      if (imported.escalations) {
        imported.escalations.forEach(function (e) {
          if (e.module === undefined) e.module = '';
        });
      }

      /* Unlock all sections when loading previous JSON */
      configLocked = false;
      applyConfigLockUI();
      updateLockButtonUI();

      /* Import config fields (priorityBuckets, ageBuckets, thresholds) */
      if (imported.config) {
        if (imported.config.priorityBuckets) cfg.priorityBuckets = imported.config.priorityBuckets;
        if (imported.config.ageBuckets) cfg.ageBuckets = imported.config.ageBuckets;
        if (imported.config.lookbackMonths !== undefined) cfg.general.lookbackMonths = imported.config.lookbackMonths;
        if (imported.config.respSlaTarget !== undefined) cfg.thresholds.respSlaTarget = imported.config.respSlaTarget;
        if (imported.config.resolSlaTarget !== undefined) cfg.thresholds.resolSlaTarget = imported.config.resolSlaTarget;
      }

      editorState.manualData = Object.assign(editorState.manualData || {}, {
        pulse: imported.pulse || editorState.manualData.pulse || { keyFlag: "" },
        actionItems: imported.actionItems || editorState.manualData.actionItems || [],
        projects: imported.projects || editorState.manualData.projects || [],
        continuousImprovement: imported.continuousImprovement || editorState.manualData.continuousImprovement || [],
        headcount: imported.headcount ? Object.assign({}, imported.headcount, { releases: imported.headcount.releases || editorState.manualData.headcount?.releases || [] }) : (editorState.manualData.headcount || { sapAMS: cfg.fteDefaults.sapAMS, sapProjects: cfg.fteDefaults.sapProjects, nsAMS: cfg.fteDefaults.nsAMS, nsProjects: cfg.fteDefaults.nsProjects, releases: [] }),
        escalations: imported.escalations || editorState.manualData.escalations || [],
        appreciations: imported.appreciations || editorState.manualData.appreciations || [],
        serviceOffers: imported.serviceOffers || editorState.manualData.serviceOffers || []
      });

      if (imported.modules) {
        imported.modules.forEach(function (m) {
          if (!m.id) return;
          var tgt = cfg.modules.find(function (c) { return c.id === m.id; });
          if (!tgt) return; /* skip modules that no longer exist */
          if (m.baseline) cfg.baselines[m.id] = m.baseline;
          if (m.fte !== undefined) tgt.fte = m.fte;
          if (m.slaThreshold) tgt.slaThreshold = Object.assign({}, m.slaThreshold);
          if (m.notes) {
            if (!editorState.manualData.modulesNotes) editorState.manualData.modulesNotes = {};
            editorState.manualData.modulesNotes[m.id] = m.notes;
          }
        });
        editorState.calculatedData = { modules: imported.modules, meta: imported.meta, global: imported.global, months: imported.months, monthsFull: imported.monthsFull, rfac: imported.rfac, prb: imported.prb };
      }

      /* Mark config, import, and preview as visited since imported JSON has computed data */
      if (imported.modules) {
        visitSection('config');
        visitSection('import');
        visitSection('preview');
      }

      saveFullState();

      /* Mark uploaded file badges to show data is available */
      if (imported.modules) {
        var badges = ['inc', 'sr', 'rfac', 'prb'];
        badges.forEach(function (b) {
          var el = document.getElementById('badge-' + b);
          if (el) { el.className = 'fbadge ok'; el.querySelector('span').textContent = b.toUpperCase() + ' (\u2713)'; }
        });
        var dzStatuses = ['inc', 'sr', 'rfac', 'prb'];
        dzStatuses.forEach(function (s) {
          var ds = document.getElementById('ds-' + s);
          if (ds) { ds.className = 'dz-status ok'; ds.textContent = '[OK] Data from imported JSON'; }
        });
      }

      loadMetadataFields();
      renderManualSections();
      renderConfigSections();
      populateModuleSelector();
      renderModulePreviewDetails();
      updateNavLocking();
      updateConfigBadge();
      showToast("Previous configuration and manual entries loaded successfully.");
    } catch (err) {
      showToast("Error parsing JSON: " + err.message);
    }
  };
  reader.onerror = function () {
    showToast("Error reading file. The file may be too large or inaccessible.");
  };
  reader.onabort = function () {
    showToast("File read was aborted.");
  };
  reader.readAsText(file);
  event.target.value = '';
}

/* ────────────────────────────
   PREFLIGHT CHECKS
──────────────────────────── */

function runPreflightChecks() {
  const container = document.getElementById('preflight-checks-container');
  if (!container) return;
  container.innerHTML = '';

  const cfg = getConfig();
  const hasCalc = !!(editorState.calculatedData && editorState.calculatedData.modules);
  const hasInc = !!editorState.uploadedFiles.incidents || hasCalc;
  const hasSr = !!editorState.uploadedFiles.service_requests || hasCalc;
  const hasRfac = !!editorState.uploadedFiles.rfac || hasCalc;
  const hasPrb = !!editorState.uploadedFiles.problems || hasCalc;
  const hasPulse = !!(editorState.manualData.pulse && editorState.manualData.pulse.keyFlag);
  const modCount = (cfg.modules || []).length;
  const mapCount = Object.keys(cfg.mappings || {}).length;
  const vis = editorState.visitedSections || {};
  const visConfig = !!vis.config;
  const visMeta = !!vis.meta;
  const visManual = !!vis.manual;
  const hasMeta = !!(cfg.general.title && cfg.general.period);
  const hasManualData = !!((editorState.manualData.actionItems && editorState.manualData.actionItems.length > 0) ||
    (editorState.manualData.escalations && editorState.manualData.escalations.length > 0) ||
    (editorState.manualData.appreciations && editorState.manualData.appreciations.length > 0) ||
    (editorState.manualData.serviceOffers && editorState.manualData.serviceOffers.length > 0) ||
    (editorState.manualData.projects && editorState.manualData.projects.length > 0) ||
    (editorState.manualData.continuousImprovement && editorState.manualData.continuousImprovement.length > 0));
  const hasConfig = modCount > 0 && mapCount > 0;

  function descFromCalc(label) {
    return hasCalc ? 'Data loaded from imported JSON' : ('Required for ' + label + '.');
  }

  const checks = [
    { label: 'Incidents (Uploaded or Imported)', pass: hasInc, desc: hasInc ? ((editorState.uploadedFiles && editorState.uploadedFiles.incidents ? editorState.uploadedFiles.incidents.length + ' records loaded' : 'From imported JSON')) : descFromCalc('SLA & volume') },
    { label: 'Service Requests (Uploaded or Imported)', pass: hasSr, desc: hasSr ? ((editorState.uploadedFiles && editorState.uploadedFiles.service_requests ? editorState.uploadedFiles.service_requests.length + ' records loaded' : 'From imported JSON')) : descFromCalc('SLA & volume') },
    { label: 'Change Request Snapshot (Uploaded or Imported)', pass: hasRfac, desc: hasRfac ? ((editorState.uploadedFiles && editorState.uploadedFiles.rfac ? editorState.uploadedFiles.rfac.length + ' records loaded' : 'From imported JSON')) : descFromCalc('CR aging') },
    { label: 'Problems Snapshot (Uploaded or Imported)', pass: hasPrb, desc: hasPrb ? ((editorState.uploadedFiles && editorState.uploadedFiles.problems ? editorState.uploadedFiles.problems.length + ' records loaded' : 'From imported JSON')) : descFromCalc('PRB aging') },
    { label: 'Calculation Engine Executed', pass: hasCalc, desc: hasCalc ? 'KPIs computed successfully' : 'Click Calculate in Step 3.' },
    { label: 'Configuration Visited', pass: visConfig && hasConfig, desc: visConfig ? (hasConfig ? modCount + ' modules, ' + mapCount + ' mappings' : 'Modules or mappings incomplete') : 'Visit Config section first.' },
    { label: 'Meta & Pulse Filled', pass: visMeta && hasMeta, desc: visMeta ? (hasMeta ? 'Title and period set' : 'Title or period missing') : 'Visit Meta section first.' },
    { label: 'Manual Data (optional)', pass: !visManual || hasManualData, desc: visManual ? (hasManualData ? 'Data entered' : 'No entries (optional)') : 'Visit Manual Data section (optional).' }
  ];

  checks.forEach(function (c) {
    const row = document.createElement('div');
    row.className = 'check-row';
    row.innerHTML = '<div class="check-icon">' + (c.pass ? '\u2705' : '\u274C') + '</div>' +
      '<div class="check-label"><strong>' + c.label + '</strong><br><span style="font-size:11px;color:var(--text-sub);">' + c.desc + '</span></div>' +
      '<div class="check-badge ' + (c.pass ? 'pass' : 'fail') + '">' + (c.pass ? 'PASS' : 'FAIL') + '</div>';
    container.appendChild(row);
  });
}

/* ────────────────────────────
   METADATA & HEADCOUNT
──────────────────────────── */

function loadMetadataFields() {
  const cfg = getConfig();
  var el;
  el = document.getElementById('meta-title'); if (el) el.value = cfg.general.title || '';
  el = document.getElementById('meta-period'); if (el) el.value = cfg.general.period || '';
  el = document.getElementById('meta-owner'); if (el) el.value = cfg.general.portfolioOwner || '';
  el = document.getElementById('meta-confidentiality'); if (el) el.value = cfg.general.confidentiality || '';
  el = document.getElementById('meta-report-date'); if (el) el.value = cfg.general.reportDate || '';
  el = document.getElementById('pulse-flag-text'); if (el) el.value = (editorState.manualData.pulse ? editorState.manualData.pulse.keyFlag : '') || '';

  // Show detected months
  var monthsDisplay = document.getElementById('meta-months-display');
  if (monthsDisplay) {
    var detected = detectMonthsFromData();
    if (detected && detected.months) {
      monthsDisplay.innerHTML = '<strong>' + detected.months.length + '-month window:</strong> ' + detected.months.join(' → ') + ' &nbsp;|&nbsp; <em>Latest: ' + escHtml(detected.period) + '</em>';
    } else {
      monthsDisplay.textContent = 'Upload data and run calculations to auto-detect the month range.';
    }
  }

  var hc = editorState.manualData.headcount;
  el = document.getElementById('hc-sap-ams'); if (el) el.value = hc ? hc.sapAMS : cfg.fteDefaults.sapAMS;
  el = document.getElementById('hc-sap-proj'); if (el) el.value = hc ? hc.sapProjects : cfg.fteDefaults.sapProjects;
  el = document.getElementById('hc-ns-ams'); if (el) el.value = hc ? hc.nsAMS : cfg.fteDefaults.nsAMS;
  el = document.getElementById('hc-ns-proj'); if (el) el.value = hc ? hc.nsProjects : cfg.fteDefaults.nsProjects;
}

function updateMetaParam(param, val) {
  const cfg = getConfig();
  if (param === 'title') cfg.general.title = val;
  else if (param === 'period') cfg.general.period = val;
  else if (param === 'portfolioOwner') cfg.general.portfolioOwner = val;
  else if (param === 'confidentiality') cfg.general.confidentiality = val;
  else if (param === 'reportDate') cfg.general.reportDate = val;
  saveFullState();
}

function onMetaReportDateChange(val) {
  updateMetaParam('reportDate', val);
  var cfg = getConfig();
  if (val) {
    var result = detectMonthsFromData();
    cfg.general.period = result.period;
    document.getElementById('meta-period').value = result.period;
    // Update months display
    var monthsDisplay = document.getElementById('meta-months-display');
    if (monthsDisplay && result.months) {
      monthsDisplay.innerHTML = '<strong>' + result.months.length + '-month window:</strong> ' + result.months.join(' → ') + ' &nbsp;|&nbsp; <em>Latest: ' + escHtml(result.period) + '</em>';
    }
  }
  saveFullState();
  // Recalculate if data is loaded
  if (editorState.calculatedData) {
    triggerCalculation();
  }
}

function updatePulseFlag(val) {
  if (!editorState.manualData.pulse) editorState.manualData.pulse = {};
  editorState.manualData.pulse.keyFlag = val;
  saveFullState();
}

function updateHeadcount(key, val) {
  if (!editorState.manualData.headcount) editorState.manualData.headcount = {};
  editorState.manualData.headcount[key] = validatePositive(val);
  saveFullState();
}

/* ────────────────────────────
   PREVIEW
──────────────────────────── */

function populateModuleSelector() {
  const sel = document.getElementById('preview-module-selector');
  sel.innerHTML = '';
  const cfg = getConfig();
  (cfg.modules || []).forEach(function (m) {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = m.name + ' (' + m.domain + ')';
    sel.appendChild(opt);
  });
}

function renderModulePreviewDetails() {
  const modId = document.getElementById('preview-module-selector').value;
  if (!modId) return;

  const calcMod = editorState.calculatedData.modules ? editorState.calculatedData.modules.find(function (m) { return m.id === modId; }) : null;
  const container = document.getElementById('module-kpis-preview');

  if (!calcMod) {
    container.innerHTML = '<p style="color:var(--text-sub);">Please load ServiceNow files and run calculations first.</p>';
    return;
  }

  if (!editorState.manualData.overrides) editorState.manualData.overrides = {};
  if (!editorState.manualData.overrides[modId]) editorState.manualData.overrides[modId] = {};
  const ov = editorState.manualData.overrides[modId];

  const kpisList = [
    { key: 'total', label: 'Tickets Received (Total)', calcVal: calcMod.total },
    { key: 'resolved', label: 'Tickets Resolved', calcVal: calcMod.resolved },
    { key: 'respSla', label: 'Response SLA %', calcVal: calcMod.respSla, format: 'pct' },
    { key: 'resolSla', label: 'Resolution SLA %', calcVal: calcMod.resolSla, format: 'pct' },
    { key: 'mttr', label: 'MTTR (hours)', calcVal: calcMod.mttr, format: 'num' },
    { key: 'reopenRate', label: 'Reopen Rate %', calcVal: calcMod.reopenRate, format: 'pct' },
    { key: 'firstFixRate', label: 'First-Fix Rate %', calcVal: calcMod.firstFixRate, format: 'pct' }
  ];

  let html = '<table class="sc-table"><thead><tr><th style="text-align:left;">KPI Indicator</th><th>Calculated Value</th><th>Manual Override</th></tr></thead><tbody>';

  kpisList.forEach(function (k) {
    let displayCalc = k.calcVal;
    if (k.calcVal === null || k.calcVal === undefined) displayCalc = 'N/A';
    else if (k.format === 'pct') displayCalc = k.calcVal.toFixed(1) + '%';
    else if (k.format === 'num') displayCalc = k.calcVal.toFixed(1);

    const currentOverrideVal = ov[k.key] !== undefined ? ov[k.key] : '';

    html += '<tr><td class="row-lbl" style="text-align:left;">' + k.label + '</td><td>' + displayCalc + '</td>' +
      '<td><input type="number" step="any" class="' + (currentOverrideVal !== '' ? 'overridden' : '') + '" value="' + currentOverrideVal + '" placeholder="Override..." onchange="saveManualOverride(\'' + modId + '\',\'' + k.key + '\',this.value)"></td></tr>';
  });

  html += '</tbody></table>';

  // Monthly breakdown table
  var months = editorState.calculatedData.months || [];
  if (months.length > 0) {
    html += '<div class="sect-title" style="margin-top:20px;">Month-by-Month Distribution</div>';
    html += '<div class="input-hint" style="margin-bottom:8px;">Ticket counts spread across the ' + months.length + '-month lookback window, automatically determined from uploaded data dates.</div>';
    html += '<table class="sc-table"><thead><tr><th>Month</th><th>Received (INC)</th><th>Received (SR)</th><th>Total</th><th>Resolved</th><th>Net Flow</th><th>Backlog</th><th>Resp SLA%</th><th>Resol SLA%</th></tr></thead><tbody>';
    months.forEach(function (mLabel, mi) {
      html += '<tr>' +
        '<td class="row-lbl">' + escHtml(mLabel) + '</td>' +
        '<td>' + ((calcMod.incMom && calcMod.incMom[mi]) || 0) + '</td>' +
        '<td>' + ((calcMod.srMom && calcMod.srMom[mi]) || 0) + '</td>' +
        '<td><strong>' + ((calcMod.mom && calcMod.mom[mi]) || 0) + '</strong></td>' +
        '<td>' + ((calcMod.resolvedMom && calcMod.resolvedMom[mi]) || 0) + '</td>' +
        '<td style="color:' + (((calcMod.netFlowMom && calcMod.netFlowMom[mi]) || 0) > 0 ? 'var(--red)' : 'var(--green)') + '">' + ((calcMod.netFlowMom && calcMod.netFlowMom[mi]) || 0) + '</td>' +
        '<td>' + ((calcMod.backlogMom && calcMod.backlogMom[mi]) || 0) + '</td>' +
        '<td>' + (((calcMod.respSlaMom && calcMod.respSlaMom[mi]) || 0) === 100 ? '100%' : ((calcMod.respSlaMom && calcMod.respSlaMom[mi]) || 0).toFixed(1) + '%') + '</td>' +
        '<td>' + (((calcMod.resolSlaMom && calcMod.resolSlaMom[mi]) || 0) === 100 ? '100%' : ((calcMod.resolSlaMom && calcMod.resolSlaMom[mi]) || 0).toFixed(1) + '%') + '</td>' +
        '</tr>';
    });
    html += '</tbody></table>';
  }

  container.innerHTML = html;

  const chartsRow = document.getElementById('editor-charts-row');
  if (chartsRow) chartsRow.style.display = '';

  renderEditorPriorityChart(calcMod);
  renderEditorAgeChart(calcMod);
  renderEditorSlaMeters(calcMod);

  const notesTextarea = document.getElementById('module-notes-input');
  const existingNotes = editorState.manualData.modulesNotes ? (editorState.manualData.modulesNotes[modId] || []) : [];
  notesTextarea.value = existingNotes.join('\n');
}

function saveManualOverride(modId, key, val) {
  if (!editorState.manualData.overrides) editorState.manualData.overrides = {};
  if (!editorState.manualData.overrides[modId]) editorState.manualData.overrides[modId] = {};

  const parsed = val.trim() === '' ? undefined : +val;
  if (parsed === undefined) {
    delete editorState.manualData.overrides[modId][key];
  } else {
    editorState.manualData.overrides[modId][key] = parsed;
  }

  saveFullState();
  if (editorState.calculatedData.modules) {
    const calcMod = editorState.calculatedData.modules.find(function (m) { return m.id === modId; });
    if (calcMod) {
      if (parsed === undefined) { runCalculationEngine(); }
      else { calcMod[key] = parsed; }
    }
  }
  renderModulePreviewDetails();
}

var editorChartInstances = {};
var ecColorRgba = { red:'239,68,68', amber:'245,158,11', green:'16,185,129', blue:'59,130,246', purple:'139,92,246', muted:'148,163,184' };
var ecColorHex = { red:'#ef4444', amber:'#f59e0b', green:'#10b981', blue:'#3b82f6', purple:'#8b5cf6', muted:'#94a3b8' };

function renderEditorPriorityChart(mod) {
  var canvasId = 'editor-chart-priority';
  var el = document.getElementById(canvasId);
  if (!el) return;
  var ctx = el.getContext('2d');
  if (editorChartInstances[canvasId]) { editorChartInstances[canvasId].destroy(); }

  var meta = mod.priorityMeta || [];
  var labels = meta.map(function (m) { return m.label; });
  var data = meta.map(function (m) { return m.pct; });
  var bgColors = meta.map(function (m) { return 'rgba(' + (ecColorRgba[m.color] || '148,163,184') + ',0.85)'; });
  var borderColors = meta.map(function (m) { return ecColorHex[m.color] || '#94a3b8'; });

  editorChartInstances[canvasId] = new Chart(ctx, {
    type: 'doughnut',
    data: { labels: labels, datasets: [{ data: data, backgroundColor: bgColors, borderColor: borderColors, borderWidth: 1 }] },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '68%',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: function (ctx) { return ctx.label + ': ' + ctx.parsed.toFixed(1) + '%'; } } }
      }
    }
  });
}

function renderEditorAgeChart(mod) {
  var canvasId = 'editor-chart-age';
  var el = document.getElementById(canvasId);
  if (!el) return;
  var ctx = el.getContext('2d');
  if (editorChartInstances[canvasId]) { editorChartInstances[canvasId].destroy(); }

  var meta = mod.ageMeta || [];
  var labels = meta.map(function (m) { return m.label; });
  var data = meta.map(function (m) { return m.pct; });
  var bgColors = meta.map(function (m) { return 'rgba(' + (ecColorRgba[m.color] || '148,163,184') + ',0.85)'; });
  var borderColors = meta.map(function (m) { return ecColorHex[m.color] || '#94a3b8'; });

  editorChartInstances[canvasId] = new Chart(ctx, {
    type: 'doughnut',
    data: { labels: labels, datasets: [{ data: data, backgroundColor: bgColors, borderColor: borderColors, borderWidth: 1 }] },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '68%',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: function (ctx) { return ctx.label + ': ' + ctx.parsed.toFixed(1) + '%'; } } }
      }
    }
  });
}

function renderEditorSlaMeters(mod) {
  var container = document.getElementById('editor-sla-meters');
  if (!container) return;

  var th = editorState.config.thresholds || {};
  var slaGreen = (editorState.config.ragThresholds && editorState.config.ragThresholds.sla && editorState.config.ragThresholds.sla.green) || 98;
  var slaAmber = (editorState.config.ragThresholds && editorState.config.ragThresholds.sla && editorState.config.ragThresholds.sla.amber) || 95;
  var respTarget = th.respSlaTarget || 90;
  var resolTarget = th.resolSlaTarget || 90;

  function slaColor(v) {
    if (v === null || v === undefined) return 'var(--text-muted)';
    if (v >= slaGreen) return 'var(--green)';
    if (v >= slaAmber) return 'var(--amber)';
    return 'var(--red)';
  }

  var rSla = mod.respSla;
  var rsSla = mod.resolSla;
  var rColor = slaColor(rSla);
  var rsColor = slaColor(rsSla);
  var rPct = rSla !== null && rSla !== undefined ? Math.min(rSla, 100) : 0;
  var rsPct = rsSla !== null && rsSla !== undefined ? Math.min(rsSla, 100) : 0;

  container.innerHTML =
    '<div class="sla-meter">' +
      '<div class="sla-meter-hdr">' +
        '<span class="sla-meter-label">Response SLA</span>' +
        '<span class="sla-meter-val" style="color:' + rColor + ';">' + (rSla !== null && rSla !== undefined ? rSla.toFixed(1) + '%' : 'N/A') + '</span>' +
      '</div>' +
      '<div class="sla-track">' +
        '<div class="sla-fill" style="width:' + rPct + '%;background:' + rColor + ';"></div>' +
        '<div class="sla-target" style="left:' + respTarget + '%;"></div>' +
      '</div>' +
    '</div>' +
    '<div class="sla-meter" style="margin-top:10px;">' +
      '<div class="sla-meter-hdr">' +
        '<span class="sla-meter-label">Resolution SLA</span>' +
        '<span class="sla-meter-val" style="color:' + rsColor + ';">' + (rsSla !== null && rsSla !== undefined ? rsSla.toFixed(1) + '%' : 'N/A') + '</span>' +
      '</div>' +
      '<div class="sla-track">' +
        '<div class="sla-fill" style="width:' + rsPct + '%;background:' + rsColor + ';"></div>' +
        '<div class="sla-target" style="left:' + resolTarget + '%;"></div>' +
      '</div>' +
    '</div>';
}

function saveModuleNotes() {
  const modId = document.getElementById('preview-module-selector').value;
  const text = document.getElementById('module-notes-input').value;
  const notesArray = text.split('\n').map(function (l) { return l.trim(); }).filter(function (l) { return l !== ''; });

  if (!editorState.manualData.modulesNotes) editorState.manualData.modulesNotes = {};
  editorState.manualData.modulesNotes[modId] = notesArray;
  saveFullState();

  if (editorState.calculatedData.modules) {
    const calcMod = editorState.calculatedData.modules.find(function (m) { return m.id === modId; });
    if (calcMod) calcMod.notes = notesArray;
  }
  showToast("Operational notes saved for " + modId);
}

function renderModuleOptions(selectedVal) {
  const mods = getConfig().modules || [];
  return mods.map(function (m) {
    var sel = (selectedVal === m.id || selectedVal === m.name) ? ' selected' : '';
    return '<option value="' + m.id + '"' + sel + '>' + escHtml(m.name) + '</option>';
  }).join('');
}

/* ────────────────────────────
   MANUAL SECTIONS
──────────────────────────── */

function renderManualSections() {
  renderActionItems();
  renderEscalations();
  renderAppreciations();
  renderServiceOffers();
  renderProjects();
  renderContinuousImprovement();
}

function renderActionItems() {
  const container = document.getElementById('action-items-container');
  if (!container) return;
  container.innerHTML = '';
  const items = editorState.manualData.actionItems || [];
  items.forEach(function (item, idx) {
    const card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML = '<button class="item-del" onclick="deleteActionItem(' + idx + ')">\u2715 Delete</button>' +
      '<div class="grid-4">' +
      '<div class="fg"><label class="fl">Action description</label><input type="text" value="' + escHtml(item.action || '') + '" onchange="updateActionItem(' + idx + ',\'action\',this.value)"></div>' +
      '<div class="fg"><label class="fl">Owner</label><input type="text" value="' + escHtml(item.owner || '') + '" onchange="updateActionItem(' + idx + ',\'owner\',this.value)"></div>' +
      '<div class="fg"><label class="fl">Due date</label><div class="date-wrap"><input type="date" value="' + escHtml(item.dueDate || '') + '" onchange="updateActionItem(' + idx + ',\'dueDate\',this.value)"></div></div>' +
      '<div class="fg"><label class="fl">Status</label>' +
      '<select onchange="updateActionItem(' + idx + ',\'status\',this.value)">' +
      '<option value="Open"' + (item.status === 'Open' ? ' selected' : '') + '>Open</option>' +
      '<option value="In Progress"' + (item.status === 'In Progress' ? ' selected' : '') + '>In Progress</option>' +
      '<option value="Closed"' + (item.status === 'Closed' ? ' selected' : '') + '>Closed</option>' +
      '</select></div></div>' +
      '<div class="fg" style="margin-top: 10px;"><label class="fl">Next Steps</label><input type="text" value="' + escHtml(item.nextSteps || '') + '" onchange="updateActionItem(' + idx + ',\'nextSteps\',this.value)"></div>';
    container.appendChild(card);
  });
}

function addNewActionItem() {
  if (!editorState.manualData.actionItems) editorState.manualData.actionItems = [];
  editorState.manualData.actionItems.push({ action: "", owner: "", dueDate: "", status: "Open", nextSteps: "" });
  saveFullState();
  renderActionItems();
}

function updateActionItem(idx, key, val) {
  editorState.manualData.actionItems[idx][key] = val;
  saveFullState();
}

function deleteActionItem(idx) {
  editorState.manualData.actionItems.splice(idx, 1);
  saveFullState();
  renderActionItems();
}

function renderEscalations() {
  const container = document.getElementById('escalations-container');
  if (!container) return;
  container.innerHTML = '';
  const items = editorState.manualData.escalations || [];
  items.forEach(function (item, idx) {
    const card = document.createElement('div');
    card.className = 'item-card';
    const escModOptions = renderModuleOptions(item.module || '');
    card.innerHTML = '<button class="item-del" onclick="deleteEscalation(' + idx + ')">\u2715 Delete</button>' +
      '<div class="fg"><label class="fl">Escalation Issue</label><input type="text" value="' + escHtml(item.issue || '') + '" onchange="updateEscalation(' + idx + ',\'issue\',this.value)"></div>' +
      '<div class="grid-4">' +
      '<div class="fg"><label class="fl">Module</label><select onchange="updateEscalation(' + idx + ',\'module\',this.value)">' +
      '<option value="">-- Select Module --</option>' + escModOptions +
      '</select></div>' +
      '<div class="fg"><label class="fl">Responsible Lead</label><input type="text" value="' + escHtml(item.responsible || '') + '" onchange="updateEscalation(' + idx + ',\'responsible\',this.value)"></div>' +
      '<div class="fg"><label class="fl">Target Date</label><div class="date-wrap"><input type="date" value="' + escHtml(item.dueDate || '') + '" onchange="updateEscalation(' + idx + ',\'dueDate\',this.value)"></div></div>' +
      '<div class="fg"><label class="fl">Status</label>' +
      '<select onchange="updateEscalation(' + idx + ',\'status\',this.value)">' +
      '<option value="Open"' + (item.status === 'Open' ? ' selected' : '') + '>Open</option>' +
      '<option value="Resolved"' + (item.status === 'Resolved' ? ' selected' : '') + '>Resolved</option>' +
      '</select></div></div>' +
      '<div class="fg" style="margin-top: 10px;"><label class="fl">Next Steps &amp; Intervention Detail</label><input type="text" value="' + escHtml(item.nextSteps || '') + '" onchange="updateEscalation(' + idx + ',\'nextSteps\',this.value)"></div>';
    container.appendChild(card);
  });
}

function addNewEscalation() {
  if (!editorState.manualData.escalations) editorState.manualData.escalations = [];
  editorState.manualData.escalations.push({ issue: "", module: "", responsible: "", dueDate: "", status: "Open", nextSteps: "" });
  saveFullState();
  renderEscalations();
}

function updateEscalation(idx, key, val) {
  editorState.manualData.escalations[idx][key] = val;
  saveFullState();
}

function deleteEscalation(idx) {
  editorState.manualData.escalations.splice(idx, 1);
  saveFullState();
  renderEscalations();
}

function renderAppreciations() {
  const container = document.getElementById('appreciations-container');
  if (!container) return;
  container.innerHTML = '';
  const items = editorState.manualData.appreciations || [];
  items.forEach(function (item, idx) {
    const card = document.createElement('div');
    card.className = 'item-card';
    const appModOptions = renderModuleOptions(item.module || '');
    card.innerHTML = '<button class="item-del" onclick="deleteAppreciation(' + idx + ')">\u2715 Delete</button>' +
      '<div class="grid-2">' +
      '<div class="fg"><label class="fl">Module</label><select onchange="updateAppreciation(' + idx + ',\'module\',this.value)">' +
      '<option value="">-- Select Module --</option>' + appModOptions +
      '</select></div>' +
      '<div class="fg"><label class="fl">Kudos Note / Quote</label><textarea onchange="updateAppreciation(' + idx + ',\'note\',this.value)">' + escHtml(item.note || '') + '</textarea></div>' +
      '</div>';
    container.appendChild(card);
  });
}

function addNewAppreciation() {
  if (!editorState.manualData.appreciations) editorState.manualData.appreciations = [];
  editorState.manualData.appreciations.push({ module: "", note: "" });
  saveFullState();
  renderAppreciations();
}

function updateAppreciation(idx, key, val) {
  editorState.manualData.appreciations[idx][key] = val;
  saveFullState();
}

function deleteAppreciation(idx) {
  editorState.manualData.appreciations.splice(idx, 1);
  saveFullState();
  renderAppreciations();
}

function renderServiceOffers() {
  const container = document.getElementById('serviceoffers-container');
  if (!container) return;
  container.innerHTML = '';
  const items = editorState.manualData.serviceOffers || [];
  items.forEach(function (item, idx) {
    const card = document.createElement('div');
    card.className = 'item-card';
    const soStatuses = ['Proposed', 'In Review', 'Approved', 'In Progress', 'Implemented', 'Deferred', 'Rejected'];
    card.innerHTML = '<button class="item-del" onclick="deleteServiceOffer(' + idx + ')">\u2715 Delete</button>' +
      '<div class="grid-4">' +
      '<div class="fg"><label class="fl">Requester / Subject</label><input type="text" value="' + escHtml(item.requester || '') + '" onchange="updateServiceOffer(' + idx + ',\'requester\',this.value)"></div>' +
      '<div class="fg"><label class="fl">Status</label>' +
      '<select onchange="updateServiceOffer(' + idx + ',\'status\',this.value)">' +
      '<option value="">-- Select Status --</option>' +
      soStatuses.map(function (s) { return '<option value="' + s + '"' + (item.status === s ? ' selected' : '') + '>' + s + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="fg"><label class="fl">Scope Reason</label><input type="text" value="' + escHtml(item.reason || '') + '" onchange="updateServiceOffer(' + idx + ',\'reason\',this.value)"></div>' +
      '<div class="fg"><label class="fl">Next Steps</label><input type="text" value="' + escHtml(item.nextSteps || '') + '" onchange="updateServiceOffer(' + idx + ',\'nextSteps\',this.value)"></div>' +
      '</div>';
    container.appendChild(card);
  });
}

function addNewServiceOffer() {
  if (!editorState.manualData.serviceOffers) editorState.manualData.serviceOffers = [];
  editorState.manualData.serviceOffers.push({ requester: "", status: "", reason: "", nextSteps: "" });
  saveFullState();
  renderServiceOffers();
}

function updateServiceOffer(idx, key, val) {
  editorState.manualData.serviceOffers[idx][key] = val;
  saveFullState();
}

function deleteServiceOffer(idx) {
  editorState.manualData.serviceOffers.splice(idx, 1);
  saveFullState();
  renderServiceOffers();
}

function renderProjects() {
  const container = document.getElementById('projects-container');
  if (!container) return;
  container.innerHTML = '';
  const items = editorState.manualData.projects || [];
  items.forEach(function (item, idx) {
    const card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML = '<button class="item-del" onclick="deleteProjectCard(' + idx + ')">\u2715 Delete</button>' +
      '<div class="grid-4">' +
      '<div class="fg"><label class="fl">Project Name</label><input type="text" value="' + escHtml(item.name || '') + '" onchange="updateProjectCard(' + idx + ',\'name\',this.value)"></div>' +
      '<div class="fg"><label class="fl">Track</label><input type="text" value="' + escHtml(item.track || '') + '" onchange="updateProjectCard(' + idx + ',\'track\',this.value)"></div>' +
      '<div class="fg"><label class="fl">Planned Go-Live</label><input type="text" value="' + escHtml(item.plannedGoLive || '') + '" onchange="updateProjectCard(' + idx + ',\'plannedGoLive\',this.value)"></div>' +
      '<div class="fg"><label class="fl">Overall RAG</label>' +
      '<select onchange="updateProjectCard(' + idx + ',\'ragOverall\',this.value)">' +
      '<option value="GREEN"' + (item.ragOverall === 'GREEN' ? ' selected' : '') + '>Green</option>' +
      '<option value="AMBER"' + (item.ragOverall === 'AMBER' ? ' selected' : '') + '>Amber</option>' +
      '<option value="RED"' + (item.ragOverall === 'RED' ? ' selected' : '') + '>Red</option>' +
      '</select></div></div>' +
      '<div class="grid-2" style="margin-top: 10px;">' +
      '<div class="fg"><label class="fl">Status Pill Text</label><input type="text" value="' + escHtml(item.status || '') + '" placeholder="e.g. Build Phase" onchange="updateProjectCard(' + idx + ',\'status\',this.value)"></div>' +
      '<div class="fg"><label class="fl">Current Status / Key Risks</label><input type="text" value="' + escHtml(item.currentStatus || '') + '" onchange="updateProjectCard(' + idx + ',\'currentStatus\',this.value)"></div>' +
      '</div>';
    container.appendChild(card);
  });
}

function addNewProjectCard() {
  if (!editorState.manualData.projects) editorState.manualData.projects = [];
  editorState.manualData.projects.push({ name: "", track: "", status: "", plannedGoLive: "", currentStatus: "", ragOverall: "GREEN" });
  saveFullState();
  renderProjects();
}

function updateProjectCard(idx, key, val) {
  editorState.manualData.projects[idx][key] = val;
  saveFullState();
}

function deleteProjectCard(idx) {
  editorState.manualData.projects.splice(idx, 1);
  saveFullState();
  renderProjects();
}

function renderContinuousImprovement() {
  const container = document.getElementById('continuous-imp-container');
  if (!container) return;
  container.innerHTML = '';
  const items = editorState.manualData.continuousImprovement || [];
  items.forEach(function (item, idx) {
    const card = document.createElement('div');
    card.className = 'item-card';
    card.innerHTML = '<button class="item-del" onclick="deleteContinuousImprovement(' + idx + ')">\u2715 Delete</button>' +
      '<div class="grid-4">' +
      '<div class="fg"><label class="fl">Track</label><input type="text" value="' + escHtml(item.track || '') + '" onchange="updateContinuousImprovement(' + idx + ',\'track\',this.value)"></div>' +
      '<div class="fg"><label class="fl">Initiative Name</label><input type="text" value="' + escHtml(item.initiative || '') + '" onchange="updateContinuousImprovement(' + idx + ',\'initiative\',this.value)"></div>' +
      '<div class="fg"><label class="fl">Effort Saved</label><input type="text" value="' + escHtml(item.effortSaved || '') + '" placeholder="e.g. 12 hrs/mo" onchange="updateContinuousImprovement(' + idx + ',\'effortSaved\',this.value)"></div>' +
      '<div class="fg"><label class="fl">Planned Deploy</label><input type="text" value="' + escHtml(item.plannedDeploy || '') + '" onchange="updateContinuousImprovement(' + idx + ',\'plannedDeploy\',this.value)"></div>' +
      '</div>' +
      '<div class="grid-2" style="margin-top: 10px;">' +
      '<div class="fg"><label class="fl">Olympus Lead</label><input type="text" value="' + escHtml(item.olympusLead || '') + '" onchange="updateContinuousImprovement(' + idx + ',\'olympusLead\',this.value)"></div>' +
      '<div class="fg"><label class="fl">Status</label><input type="text" value="' + escHtml(item.status || '') + '" placeholder="e.g. Deployed" onchange="updateContinuousImprovement(' + idx + ',\'status\',this.value)"></div>' +
      '</div>';
    container.appendChild(card);
  });
}

function addNewContinuousImprovement() {
  if (!editorState.manualData.continuousImprovement) editorState.manualData.continuousImprovement = [];
  editorState.manualData.continuousImprovement.push({ track: "", initiative: "", status: "", effortSaved: "", plannedDeploy: "", olympusLead: "" });
  saveFullState();
  renderContinuousImprovement();
}

function updateContinuousImprovement(idx, key, val) {
  editorState.manualData.continuousImprovement[idx][key] = val;
  saveFullState();
}

function deleteContinuousImprovement(idx) {
  editorState.manualData.continuousImprovement.splice(idx, 1);
  saveFullState();
  renderContinuousImprovement();
}

/* ────────────────────────────
   DRAG & DROP SUPPORT
──────────────────────────── */

function setupEditorDropZones() {
  const dropTypes = ['inc', 'sr', 'rfac', 'prb'];
  const typeMap = { inc: 'incidents', sr: 'service_requests', rfac: 'rfac', prb: 'problems' };
  dropTypes.forEach(function (short) {
    var dz = document.getElementById('dz-' + short);
    if (!dz) return;
    dz.addEventListener('dragenter', function (e) { e.preventDefault(); dz.classList.add('drag-over'); });
    dz.addEventListener('dragover', function (e) { e.preventDefault(); dz.classList.add('drag-over'); });
    dz.addEventListener('dragleave', function (e) { e.preventDefault(); dz.classList.remove('drag-over'); });
    dz.addEventListener('drop', function (e) {
      e.preventDefault();
      dz.classList.remove('drag-over');
      var file = e.dataTransfer.files[0];
      if (!file) return;
      var fakeEvent = { target: { files: [file] } };
      handleXLSXUpload(fakeEvent, typeMap[short]);
    });
  });
}
