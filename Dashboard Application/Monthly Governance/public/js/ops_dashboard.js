/* ══════════════════════════════════════════════════════════════════════
   OPSREVIEW DASHBOARD  v4.0 — HEADLESS RENDERER
   Every string visible to the user comes from dashboard_config.json.
   To update the dashboard: edit ops_data.json and dashboard_config.json.
═══════════════════════════════════════════════════════════════════════ */

'use strict';

const DATA_FILE = 'data/ops_data.json';
const CONFIG_FILE = 'data/dashboard_config.json';
const CONFIG_OVERRIDE_FILE = 'data/opsreview_config.json';

/* ── Safe tokenizer — only allowlisted tags ── */
const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

const resolveModuleName = moduleId => {
  const mod = (OpsApp.state.data?.modules || []).find(m => m.id === moduleId);
  return mod ? mod.name : moduleId;
};
const TRUST_RE = /(<\/?(?:strong|em|b|i|br)\s*\/?>)/i;
const TRUST_ALLOW = new Set(['strong','em','b','i','br']);
function trust(s) {
  /* SECURITY BOUNDARY: only allowlisted tags, attributes stripped */
  return String(s ?? '').split(TRUST_RE).map(t => {
    if (t.includes('javascript:') || /on\w+=/i.test(t)) return esc(t);
    const m = t.match(/^<\/?(\w+)\s*\/?>$/i);
    if (m && TRUST_ALLOW.has(m[1].toLowerCase())) {
      const tag = m[1].toLowerCase();
      if (tag === 'br') return '<br>';
      return t.startsWith('</') ? `</${tag}>` : `<${tag}>`;
    }
    return esc(t);
  }).join('');
}

/* ── Constants ── */
const INITIALS_LEN = 2;

/* ── Formatting helpers ── */
const fmtPct = val => (val != null && !isNaN(val)) ? val.toFixed(1) + '%' : 'N/A';
const fmtNum = (val, dec = 0) => (val != null && !isNaN(val)) ? val.toFixed(dec) : 'N/A';

const slbl = key => { const v = OpsApp.state?.config?.labels?.moduleSubLabels?.[key]; if (!v) console.warn('Missing moduleSubLabels key:', key); return v || key; };

/* ── Dynamic CSS colour helpers — read from :root at runtime ── */
const FALLBACK_HEX = { red:'#ef4444', amber:'#f59e0b', green:'#10b981', blue:'#3b82f6', purple:'#8b5cf6', muted:'#94a3b8' };
function getCSSColor(key) {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(`--${key}`).trim();
    return v || FALLBACK_HEX[key] || FALLBACK_HEX.muted;
  } catch(e) { return FALLBACK_HEX[key] || FALLBACK_HEX.muted; }
}
function hexToRgba(hex, a) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) hex = FALLBACK_HEX.muted;
  const alpha = typeof a === 'string' ? parseFloat(a) : a;
  return `rgba(${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)},${isNaN(alpha) ? 1 : alpha})`;
}
function getCSSAlpha(key, a) { return hexToRgba(getCSSColor(key), a); }
function colorToRgba(name, opacity) {
  return hexToRgba(getCSSColor(name), opacity);
}
function colorToHex(name) {
  return getCSSColor(name);
}

/* ── Global state ── */
// state moved to OpsApp.state.data
// state moved to OpsApp.state.config
const chartInstances = {};
const OpsApp = { state: { data: null, config: null }, charts: chartInstances };
const TAB_IDS = { OVERVIEW: 'overview', SAP: 'sap', NSAP: 'nsap', QUALITY: 'quality', ACTIONS: 'actions', PROJECTS: 'projects', HEADCOUNT: 'headcount' };
const TAB_CHARTS = { overview: ['chart-overview-volume','chart-overview-backlog'], quality: ['chart-quality-mttr','chart-quality-reopen'], headcount: ['chart-headcount-capacity'], sap: [], nsap: [] };
/* ── Chart factory ── */
function makeChart(id, type, data, extraOpts) {
  if (chartInstances[id]) {
    chartInstances[id].destroy();
  }
  const canvas = document.getElementById(id);
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');
  const defaults = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: getCSSColor('text-sub') } },
      tooltip: {
        backgroundColor: getCSSColor('bg-panel'),
        titleColor: getCSSColor('text-main'),
        bodyColor: getCSSColor('text-sub'),
        padding: 8, cornerRadius: 6,
        borderColor: hexToRgba(getCSSColor('text-muted'), 0.15),
        borderWidth: 1
      }
    }
  };
  const mergedOpts = deepMerge(defaults, extraOpts || {});
  /* Suppress animations during print to ensure canvases are drawn
     synchronously before the print dialog captures them */
  if (window.__opsPrinting) {
    mergedOpts.animation = mergedOpts.animation || {};
    mergedOpts.animation.duration = 0;
  }
  if (mergedOpts.scales) {
    if (mergedOpts.scales.x) {
      mergedOpts.scales.x.ticks = mergedOpts.scales.x.ticks || {};
      if (!mergedOpts.scales.x.ticks.color) mergedOpts.scales.x.ticks.color = getCSSColor('text-sub');
      if (mergedOpts.scales.x.grid === undefined) mergedOpts.scales.x.grid = { display: false };
    }
    if (mergedOpts.scales.y) {
      mergedOpts.scales.y.ticks = mergedOpts.scales.y.ticks || {};
      if (!mergedOpts.scales.y.ticks.color) mergedOpts.scales.y.ticks.color = getCSSColor('text-sub');
      if (mergedOpts.scales.y.grid === undefined) mergedOpts.scales.y.grid = { color: getCSSAlpha('text-muted', 0.12) };
    }
  }
  const c = new Chart(ctx, { type, data, options: mergedOpts });
  chartInstances[id] = c;
  return c;
}

function destroyAllCharts() {
  Object.keys(chartInstances).forEach(k => {
    if (chartInstances[k]) chartInstances[k].destroy();
  });
  Object.keys(chartInstances).forEach(k => delete chartInstances[k]);
}

function destroyChartsForTab(tabId) {
  const ids = [...(TAB_CHARTS[tabId] || [])];
  if (tabId === 'sap' || tabId === 'nsap') {
    const prefix = tabId === 'sap' ? 'sap' : 'ns';
    Object.keys(chartInstances).forEach(k => {
      if (k.startsWith('chart-trend-') || k.startsWith('chart-priority-') || k.startsWith('chart-age-')) {
        ids.push(k);
      }
    });
  }
  ids.forEach(id => {
    if (chartInstances[id]) { chartInstances[id].destroy(); delete chartInstances[id]; }
  });
}

function deepMerge(a, b) {
  const r = Object.assign({}, a);
  for (const k of Object.keys(b || {})) {
    if (b[k] !== null && typeof b[k] === 'object' && !Array.isArray(b[k])) {
      r[k] = deepMerge(r[k] || {}, b[k]);
    } else {
      r[k] = b[k];
    }
  }
  return r;
}

/* ── Threshold functions — driven from config ── */
function getThresholdColor(val, configKey, moduleId) {
  if (val === null || val === undefined) return 'muted';
  
  /* Per-module SLA threshold override (from ops_data.json modules[].slaThreshold) */
  let t;
  if (configKey === 'sla' && moduleId) {
    const mod = (OpsApp.state.data.modules || []).find(m => m.id === moduleId);
    if (mod && mod.slaThreshold) t = mod.slaThreshold;
  }
  
  /* Global default from opsreview_config.json ragThresholds */
  if (!t) t = OpsApp.state.config?.ragThresholds?.[configKey];
  if (!t) return 'muted';
  
  if (t.invert) {
    if (val >= t.green) return 'green';
    if (val >= t.amber) return 'amber';
    return 'red';
  }
  if (val <= t.green) return 'green';
  if (val <= t.amber) return 'amber';
  return 'red';
}

function getSlaColor(val, moduleId) { return getThresholdColor(val, 'sla', moduleId); }
function getMttrColor(val) { return getThresholdColor(val, 'mttr'); }
function getReopenColor(val) { return getThresholdColor(val, 'reopenRate'); }
function getFirstFixColor(val) { return getThresholdColor(val, 'firstFixRate'); }
function getFteLoadColor(val) { return getThresholdColor(val, 'fteLoad'); }

/* ── Theme system ── */
function toggleTheme() {
  const html = document.documentElement;
  const isLight = html.getAttribute('data-theme') === 'light';
  html.setAttribute('data-theme', isLight ? 'dark' : 'light');
  localStorage.setItem('ops-theme', isLight ? 'dark' : 'light');
}

function initTheme() {
  const saved = localStorage.getItem('ops-theme');
  if (saved) document.documentElement.setAttribute('data-theme', saved);
}

function watchTheme() {
  if (window.__opsThemeObserver) window.__opsThemeObserver.disconnect();
  const obs = new MutationObserver(() => { if (!OpsApp.state.data) return; destroyAllCharts(); renderAllCharts(); });
  window.__opsThemeObserver = obs;
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}

/* ── Font size control (cross-browser via root font-size) ── */
function changeFontSize(delta) {
  const cur = parseFloat(document.documentElement.style.fontSize) || 100;
  const next = Math.min(Math.max(+((cur + delta * 5)).toFixed(1), 70), 150);
  document.documentElement.style.fontSize = next + '%';
  localStorage.setItem('ops-font-size', next);
}

function initFontSize() {
  const saved = localStorage.getItem('ops-font-size');
  if (saved) document.documentElement.style.fontSize = saved + '%';
}

/* ── Print dashboard ── */
function printDashboard() {
  const html = document.documentElement;
  const wasLight = html.getAttribute('data-theme') === 'light';

  const panels = document.querySelectorAll('.panel');
  const panelStates = [];
  panels.forEach(p => { panelStates.push(p.classList.contains('active')); p.classList.add('active'); });

  const _observer = window.__opsThemeObserver;
  if (_observer) _observer.disconnect();

  html.setAttribute('data-theme', 'light');

  function restore() {
    try {
      panels.forEach((p, i) => { if (!panelStates[i]) p.classList.remove('active'); });
      if (!wasLight) html.setAttribute('data-theme', 'dark');
      window.removeEventListener('afterprint', restore);
      if (mql) mql.removeListener(restore);
      if (_observer) _observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    } catch (_) { /* ensure theme and observer are always restored */ }
  }

  window.addEventListener('afterprint', restore);
  const mql = window.matchMedia('print');
  mql.addListener(restore);

  /* Disable chart animations so canvases draw synchronously */
  window.__opsPrinting = true;
  destroyAllCharts();
  renderAllModuleCharts();
  renderOverviewVolumeChart();
  renderOverviewBacklogChart();
  renderQualityMttrChart();
  renderQualityReopenChart();
  renderHeadcountCapacityChart();
  window.__opsPrinting = false;

  /* Print outside requestAnimationFrame context — Chrome's PDF generator
     can produce 0KB output when window.print() is called from within a
     rAF callback due to race conditions in the headless capture pipeline */
  setTimeout(function () {
    try { window.print(); }
    catch (e) { console.error('printDashboard: window.print() failed', e); }
  }, 50);
}

/* ── Help panel ── */
function toggleHelp() {
  const panel = document.getElementById('help-panel');
  const btn = document.getElementById('help-toggle');
  const isOpen = panel.classList.toggle('open');
  if (btn) {
    btn.textContent = isOpen ? '✕' : '?';
    btn.setAttribute('aria-expanded', String(isOpen));
  }
}

/* ── Icon helper ── */
const icon = id => `<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><use href="#ic-${id}"/></svg>`;

/* ══════════════════════════════════════════════════════════════════════
   RENDER FUNCTIONS
═══════════════════════════════════════════════════════════════════════ */

function renderAll() {
  const app = document.getElementById('app');
  const meta = OpsApp.state.data.meta;
  const cfg = OpsApp.state.config;

  app.innerHTML = `
    ${renderHeader(meta, cfg)}
    <div id="help-panel">
      <div id="help-content">${cfg.help ? renderHelpContent(cfg.help, cfg.labels) : ''}</div>
    </div>
    ${renderPulse(OpsApp.state.data.pulse, cfg)}
    ${renderTabs(cfg)}
    <div id="tab-content">
      ${(cfg.tabs || []).map(t => renderPanel(t.id, cfg)).join('')}
    </div>
    ${renderFooter(cfg)}
  `;

  app.style.visibility = 'visible';
  document.getElementById('loader').classList.add('fade');

  bindEvents();
  renderAllCharts();
}

function renderHeader(meta, cfg) {
  const b = cfg.brand;
  const l = cfg.labels || {};
  const initials = (meta.title || b.title).split(' ').map(w => w[0]).join('').slice(0, INITIALS_LEN).toUpperCase();
  const lastUpdatedStr = meta.lastUpdated;
  const lastUpdatedDate = lastUpdatedStr ? new Date(lastUpdatedStr + (lastUpdatedStr.includes('T') ? '' : 'T00:00:00')) : new Date();
  return `
  <header class="masthead" id="dashboard-masthead">
    <div class="masthead-brand">
      <div class="masthead-brand-icon" aria-hidden="true">${esc(initials)}</div>
      <div class="masthead-brand-text">
        <div class="masthead-title">${esc(meta.title || b.title)}</div>
        <div class="masthead-sub">${esc(meta.portfolioOwner || b.subtitle)}</div>
      </div>
    </div>
    <div class="masthead-right">
      <span class="masthead-updated">${esc(l.asOfLabel || 'As of')}: ${lastUpdatedDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
      <span class="masthead-pill">${esc(meta.period)}</span>
      <div class="toolbar">
        <button class="tool-btn" id="btn-toggle-theme" title="Toggle light/dark mode" aria-label="Toggle theme">◐</button>
        <button class="tool-btn" id="btn-font-down" title="Decrease font size" aria-label="Decrease font size">A−</button>
        <button class="tool-btn" id="btn-font-up" title="Increase font size" aria-label="Increase font size">A+</button>
        <button class="tool-btn" id="btn-print" title="Print dashboard (PDF)" aria-label="Print dashboard">⎙</button>
      </div>
      <button class="help-btn" id="help-toggle"
        aria-label="How to update this dashboard"
        aria-expanded="false"
        title="How to update this dashboard">?</button>
    </div>
  </header>`;
}

function renderFooter(cfg) {
  const r = (cfg.labels && cfg.labels.ragLegend) || {};
  return `
  <div class="footer">
    <div class="footer-rag">
      <span class="fr-item"><span class="rag rag-green"></span> ${esc(r.green || 'Good')}</span>
      <span class="fr-item"><span class="rag rag-amber"></span> ${esc(r.amber || 'Warning')}</span>
      <span class="fr-item"><span class="rag rag-red"></span> ${esc(r.red || 'Critical')}</span>
    </div>
  </div>`;
}

function renderPulse(pulse, cfg) {
  if (!pulse || !pulse.keyFlag) return '';
  if (!cfg.pulse) return `<div class="flag-banner"><div class="flag-text">${esc(pulse.keyFlag)}</div></div>`;
  return `
  <div class="flag-banner">
    <div class="flag-icon">${esc(cfg.pulse.icon)}</div>
    <div class="flag-text">
      <strong>${esc(cfg.pulse.prefix)}</strong> ${esc(pulse.keyFlag)}
    </div>
  </div>`;
}

function renderTabs(cfg) {
  const tabs = (cfg.tabs || []).map(t =>
    `<button class="db-tab ${t.id === TAB_IDS.OVERVIEW ? 'active' : ''}" data-tab="${esc(t.id)}" role="tab" aria-selected="${t.id === TAB_IDS.OVERVIEW}">${esc(t.icon)} ${esc(t.label)}</button>`
  ).join('');
  return `<div class="dashboard-tabs" role="tablist">${tabs}</div>`;
}

function renderPanel(tabId, cfg) {
  const active = tabId === TAB_IDS.OVERVIEW ? 'active' : '';
  const panelId = `panel-${tabId}`;
  const tabLabel = (cfg.tabs || []).find(t => t.id === tabId)?.label || tabId;
  const tabIcon = (cfg.tabs || []).find(t => t.id === tabId)?.icon || '';
  let inner = '';

  try {
    switch (tabId) {
      case TAB_IDS.OVERVIEW:
        inner = renderOverviewContent(cfg);
        break;
      case TAB_IDS.SAP:
        inner = renderModuleSection('SAP', cfg);
        break;
      case TAB_IDS.NSAP:
        inner = renderModuleSection('NonERP', cfg);
        break;
      case TAB_IDS.QUALITY:
        inner = renderQualityContent(cfg);
        break;
      case TAB_IDS.ACTIONS:
        inner = renderActionsContent(cfg);
        break;
      case TAB_IDS.PROJECTS:
        inner = renderProjectsContent(cfg);
        break;
      case TAB_IDS.HEADCOUNT:
        inner = renderHeadcountContent(cfg);
        break;
      default:
        inner = '<p>Unknown tab: ' + esc(tabId) + '</p>';
        break;
    }
  } catch (e) {
    inner = '<div class="card"><p style="color:var(--red)">Error rendering tab: ' + esc(tabId) + '</p></div>';
  }

  return `<div class="panel ${active}" id="${panelId}" role="tabpanel">
    <div class="panel-print-label">${esc(tabIcon)} ${esc(tabLabel)}</div>
    ${inner}
  </div>`;
}

function renderOverviewContent(cfg) {
  const ov = cfg.overview;
  const g = OpsApp.state.data.global;
  if (!g) return '';

  const cards = (ov.cards || []).map(c => {
    const val = g[c.key];
    const delta = g[c.key.replace('Total', 'TotalDelta').replace('SLAComposite', 'SLADelta')];
    const deltaVal = delta !== undefined ? delta : 0;
    const isFlat = Math.abs(deltaVal) < 0.01;
    const isUp = deltaVal > 0;
    const badUp = c.invertDelta ? !isUp : isUp;
    const color = isFlat ? 'text-muted' : (badUp ? 'red' : 'green');
    return `
    <div class="summary-card">
      <div class="summary-card-hdr">${esc(c.label)}</div>
      <div class="summary-card-val">${c.unit === '%' ? fmtPct(val) : fmtNum(val)}</div>
      <div class="summary-card-sub" style="color: var(--${color})">
        ${isFlat ? '—' : (isUp ? '▲' : '▼')} ${isFlat ? '' : fmtNum(Math.abs(deltaVal), 1) + '%'} ${esc(c.subLabel || '')}
      </div>
    </div>`;
  }).join('');

  const charts = (ov.charts || []).map(ch =>
    `<div class="card"><div class="card-title">${esc(ch.title)}</div><div class="chart-wrap" style="height:${ch.height}px"><canvas id="${ch.id}" role="img" aria-label="${esc(ch.title)}"></canvas></div></div>`
  ).join('');

  return `<div class="summary-strip">${cards}</div><div class="grid-2">${charts}</div>`;
}

function renderModuleSection(domain, cfg) {
  const mp = cfg.modulePanel;
  const sectionKey = domain === 'SAP' ? 'sapSection' : 'nsSection';
  const section = mp[sectionKey];
  const prefix = domain === 'SAP' ? 'sap' : 'ns';
  const detailsId = `${prefix}-details-container`;

  return `
  <div class="sub-tabs-container">
    <div class="sub-tabs-header">${esc(section.title)}</div>
    <div class="sub-tabs ${prefix}-sub-tabs" role="tablist"></div>
  </div>
  <div id="${detailsId}"></div>`;
}

function renderQualityContent(cfg) {
  const q = cfg.quality;
  const charts = (q.charts || []).map(ch =>
    `<div class="card"><div class="card-title">${esc(ch.title)}</div><div class="chart-wrap" style="height:${ch.height}px"><canvas id="${ch.id}" role="img" aria-label="${esc(ch.title)}"></canvas></div></div>`
  ).join('');

  const headers = (q.tableHeaders || []).map(h => `<th style="text-align:${h === q.tableHeaders[0] ? 'left' : 'center'}">${esc(h)}</th>`).join('');

  return `
  <div class="grid-2" style="margin-bottom:20px">${charts}</div>
  <div class="card">
    <div class="card-title">${esc(q.title)}</div>
    <div class="sc-table-wrap">
      <table class="sc-table">
        <thead><tr>${headers}</tr></thead>
        <tbody id="quality-table-body"></tbody>
      </table>
    </div>
  </div>`;
}

function renderActionsContent(cfg) {
  const a = cfg.actions;
  const activeHeaders = (a.activeHeaders || []).map(h => `<th style="text-align:${h === a.activeHeaders[0] ? 'left' : 'center'}">${esc(h)}</th>`).join('');
  const escHeaders = (a.escHeaders || []).map(h => `<th style="text-align:${h === a.escHeaders[0] ? 'left' : 'center'}">${esc(h)}</th>`).join('');
  const apprHeaders = (a.apprHeaders || []).map(h => `<th style="text-align:${h === a.apprHeaders[0] ? 'left' : 'center'}">${esc(h)}</th>`).join('');
  const soHeaders = (a.soHeaders || []).map(h => `<th style="text-align:${h === a.soHeaders[0] ? 'left' : 'center'}">${esc(h)}</th>`).join('');

  return `
  <div class="card" style="margin-bottom:20px">
    <div class="card-title">${esc(a.activeLogTitle)}</div>
    <div class="sc-table-wrap">
      <table class="sc-table">
        <thead><tr>${activeHeaders}</tr></thead>
        <tbody id="action-items-body"></tbody>
      </table>
    </div>
  </div>
  <div class="card" style="margin-bottom:20px">
    <div class="card-title">${esc(a.escTitle)}</div>
    <div class="sc-table-wrap">
      <table class="sc-table">
        <thead><tr>${escHeaders}</tr></thead>
        <tbody id="escalations-body"></tbody>
      </table>
    </div>
  </div>
  <div class="card" style="margin-bottom:20px">
    <div class="card-title">${esc(a.apprTitle)}</div>
    <div class="sc-table-wrap">
      <table class="sc-table">
        <thead><tr>${apprHeaders}</tr></thead>
        <tbody id="appreciations-body"></tbody>
      </table>
    </div>
  </div>
  <div class="card">
    <div class="card-title">${esc(a.soTitle)}</div>
    <div class="sc-table-wrap">
      <table class="sc-table">
        <thead><tr>${soHeaders}</tr></thead>
        <tbody id="service-offers-body"></tbody>
      </table>
    </div>
  </div>`;
}

function renderProjectsContent(cfg) {
  const p = cfg.projects;
  const ciHeaders = (p.ciHeaders || []).map(h => `<th style="text-align:${h === p.ciHeaders[0] ? 'left' : 'center'}">${esc(h)}</th>`).join('');

  return `
  <div class="sect-title">${esc(p.sectionTitle)}</div>
  <div class="grid-3" id="projects-cards-container" style="margin-bottom:20px"></div>
  <div class="card">
    <div class="card-title">${esc(p.ciTitle)}</div>
    <div class="sc-table-wrap">
      <table class="sc-table">
        <thead><tr>${ciHeaders}</tr></thead>
        <tbody id="ci-table-body"></tbody>
      </table>
    </div>
  </div>`;
}

function renderHeadcountContent(cfg) {
  const h = cfg.headcount;
  const hc = OpsApp.state.data.headcount || {};

  const cards = (h.cards || []).map(c =>
    `<div class="summary-card">
      <div class="summary-card-hdr">${esc(c.label)}</div>
      <div class="summary-card-val">${hc[c.key] ?? '—'}</div>
      <div class="summary-card-sub">${esc(c.sub)}</div>
    </div>`
  ).join('');

  return `
  <div class="grid-4" style="margin-bottom:20px">${cards}</div>
  <div class="card">
    <div class="card-title">${esc(h.capacityChart.title)}</div>
    <div class="chart-wrap" style="height:${h.capacityChart.height}px">
      <canvas id="${h.capacityChart.id}" role="img" aria-label="${esc(h.capacityChart.title)}"></canvas>
    </div>
    <div class="capacity-note">${trust(h.capacityNote)}</div>
  </div>`;
}

function renderHelpContent(help, labels) {
  if (!help || !help.sections) return '';
  const heading = (labels && labels.helpHeading) || 'How to Update This Dashboard';
  const grid = help.sections.map(sec => {
    const items = (sec.items || []).map(item => `<li>${trust(item)}</li>`).join('');
    return `
    <div class="help-block">
      <h4>${esc(sec.icon || '')} ${esc(sec.title)}</h4>
      <ul>${items}</ul>
    </div>`;
  }).join('');
  return `<h3>${esc(heading)}</h3><div class="help-grid">${grid}</div>`;
}

/* ══════════════════════════════════════════════════════════════════════
   POST-RENDER DATA POPULATION
═══════════════════════════════════════════════════════════════════════ */

function populateModuleSubTabs() {
  const mp = OpsApp.state.config.modulePanel;
  ['SAP', 'NonERP'].forEach(domain => {
    const prefix = domain === 'SAP' ? 'sap' : 'ns';
    const container = document.querySelector(`.${prefix}-sub-tabs`);
    if (!container) return;
    container.innerHTML = '';

    const modules = OpsApp.state.data.modules.filter(m => m.domain.toLowerCase() === domain.toLowerCase());
    modules.forEach((m, idx) => {
      const btn = document.createElement('button');
      btn.className = `sub-tab ${getSlaColor(m.resolSla, m.id)}`;
      btn.textContent = m.name;
      btn.dataset.moduleId = m.id;
      btn.dataset.domain = domain;
      btn.setAttribute('role', 'tab');
      container.appendChild(btn);
      if (idx === 0) btn.classList.add('active');
    });

    const detailsId = `${prefix}-details-container`;
    if (modules.length > 0) {
      populateModulePanel(modules[0].id, document.getElementById(detailsId));
    }
  });
}

function populateModulePanel(moduleId, container) {
  if (!container) return;
  const mod = OpsApp.state.data.modules.find(m => m.id === moduleId);
  if (!mod) return;

  const rfac = OpsApp.state.data.rfac?.[moduleId] || {};
  const prb = OpsApp.state.data.prb?.[moduleId] || {};
  const rfacEmpty = Object.keys(rfac).length === 0;
  const prbEmpty = Object.keys(prb).length === 0;
  const mp = OpsApp.state.config.modulePanel;
  const receivedPct = (mod.baseline != null && mod.total != null && mod.baseline > 0) ? ((mod.total - mod.baseline) / mod.baseline * 100) : 0;
  const receivedPctLabel = receivedPct >= 0 ? `+${receivedPct.toFixed(1)}%` : `${receivedPct.toFixed(1)}%`;

  const kpiCards = (mp.kpis || []).map(k => {
    let val, sub, color;
    switch (k.key) {
      case 'receivedBaseline':
        val = `${mod.total} / ${mod.baseline}`;
        sub = `<span class="${receivedPct > 10 ? 'red' : receivedPct > 0 ? 'amber' : 'green'}">${receivedPctLabel} ${esc(slbl('receivedBaseline'))}</span>`;
        break;
      case 'incSrSplit':
        val = `${mod.inc} / ${mod.sr}`;
        sub = esc(slbl('incSrSplit'));
        break;
      case 'resolvedNetFlow':
        val = `${mod.resolved} (${mod.netFlow >= 0 ? '+' : ''}${mod.netFlow})`;
        sub = `<span class="${mod.netFlow > 0 ? 'red' : 'green'}">${esc(slbl('resolvedNetFlow'))}</span>`;
        break;
      case 'respSla':
        val = fmtPct(mod.respSla);
        color = `var(--${getSlaColor(mod.respSla, mod.id)})`;
        sub = esc(slbl('respSla'));
        break;
      case 'resolSla':
        val = fmtPct(mod.resolSla);
        color = `var(--${getSlaColor(mod.resolSla, mod.id)})`;
        sub = esc(slbl('resolSla'));
        break;
      case 'mttr':
        val = mod.mttr != null ? fmtNum(mod.mttr, 1) + 'h' : 'N/A';
        color = `var(--${getMttrColor(mod.mttr)})`;
        sub = esc(slbl('mttr'));
        break;
      default:
        val = mod[k.key] ?? '—';
        sub = '';
        break;
    }
    return `
    <div class="kpi-card">
      <div class="kpi-card-label">${esc(k.label)}</div>
      <div class="kpi-card-value"${color ? ` style="color:${color}"` : ''}>${val}</div>
      <div class="kpi-card-sub">${sub}</div>
    </div>`;
  }).join('');

  const slaMeters = (mp.slaMeters.meters || []).map(m => {
    const val = mod[m.key];
    const color = getSlaColor(val, mod.id);
    const tgt = m.key === 'resolSla' ? OpsApp.state.config.overrideThresholds?.resolSlaTarget : OpsApp.state.config.overrideThresholds?.respSlaTarget;
    return `
    <div class="sla-meter">
      <div class="sla-meter-hdr">
        <span class="sla-meter-label">${esc(m.label)}</span>
        <span class="sla-meter-val" style="color:var(--${color})">${fmtPct(val)}</span>
      </div>
      <div class="sla-track">
        <div class="sla-fill" style="width:${Math.max(0, Math.min(val ?? 0, 100))}%;background:var(--${color})"></div>
        <div class="sla-target" style="left:${(tgt || 90)}%"></div>
      </div>
    </div>`;
  }).join('');

  const rfacRows = rfacEmpty
    ? '<tr><td colspan="2" style="text-align:center;color:var(--text-muted)">No RFAC data</td></tr>'
    : (mp.rfacSection.rows || []).map(r => {
      const val = rfac[r.key];
      let display;
      if (r.format === 'pct') {
        display = fmtPct(val);
      } else if (r.format === 'bool') {
        display = val ? '<span style="color:var(--green)">✓ Yes</span>' : '<span style="color:var(--red)">✗ No</span>';
      } else if (r.format === 'days') {
        display = val != null ? val + 'd' : '—';
      } else {
        display = val ?? '—';
      }
      return `<tr><td class="row-lbl">${esc(r.label)}</td><td>${display}</td></tr>`;
    }).join('');

  const prbRows = prbEmpty
    ? '<tr><td colspan="2" style="text-align:center;color:var(--text-muted)">No PRB data</td></tr>'
    : (mp.prbSection.rows || []).map(r => {
      const val = prb[r.key];
      let display;
      if (r.format === 'pct') {
        display = fmtPct(val);
      } else if (r.format === 'days') {
        display = val != null ? val + 'd' : '—';
      } else {
        display = val ?? '—';
      }
      return `<tr><td class="row-lbl">${esc(r.label)}</td><td>${display}</td></tr>`;
    }).join('');

  const prioritySegs = (mod.priorityMeta || []).map((p, i) =>
    (i > 0 ? '<span style="margin-left:8px"></span>' : '') + `<span class="legend-dot ${p.color}"></span>${esc(p.label)}`
  ).join('');

  const ageSegs = (mod.ageMeta || []).map((a, i) =>
    (i > 0 ? '<span style="margin-left:8px"></span>' : '') + `<span class="legend-dot ${a.color}"></span>${esc(a.label)}`
  ).join('');

  /* Destroy any existing chart instances for this module before wiping the container */
  ['chart-trend-', 'chart-priority-', 'chart-age-'].forEach(function (pfx) {
    const ci = chartInstances[pfx + moduleId];
    if (ci) { ci.destroy(); delete chartInstances[pfx + moduleId]; }
  });

  container.innerHTML = `
    <div class="kpi-strip">${kpiCards}</div>
    <div class="grid-2">
      <div class="card">
        <div class="card-title">${esc(mp.trendChart.title)}</div>
        <div class="chart-wrap" style="height:${mp.trendChart.height}px">
          <canvas id="chart-trend-${mod.id}" role="img" aria-label="${esc(mp.trendChart.title)}"></canvas>
        </div>
      </div>
      <div class="card">
        <div class="grid-2">
          <div>
            <div class="card-title" style="font-size:12px;margin-bottom:4px">${esc(mp.priorityChart.title)}</div>
            <div class="chart-wrap" style="height:${mp.priorityChart.height}px">
              <canvas id="chart-priority-${mod.id}" role="img" aria-label="${esc(mp.priorityChart.title)}"></canvas>
            </div>
            <div class="chart-legend-sm">${prioritySegs}</div>
          </div>
          <div>
            <div class="card-title" style="font-size:12px;margin-bottom:4px">${esc(mp.ageChart.title)}</div>
            <div class="chart-wrap" style="height:${mp.ageChart.height}px">
              <canvas id="chart-age-${mod.id}" role="img" aria-label="${esc(mp.ageChart.title)}"></canvas>
            </div>
            <div class="chart-legend-sm">${ageSegs}</div>
          </div>
        </div>
        <div class="sla-meters" style="margin-top:12px">
          <div class="card-title" style="font-size:12px;margin-bottom:6px">${esc(mp.slaMeters.title)}</div>
          ${slaMeters}
        </div>
      </div>
    </div>
    <div class="grid-2" style="margin-top:20px">
      <div class="card">
        <div class="card-title">${esc(mp.rfacSection.title)}</div>
        <div class="sc-table-wrap">
          <table class="sc-table">
            <thead><tr>${(mp.rfacSection.headers || []).map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
            <tbody>${rfacRows}</tbody>
          </table>
        </div>
      </div>
      <div class="card">
        <div class="card-title">${esc(mp.prbSection.title)}</div>
        <div class="sc-table-wrap">
          <table class="sc-table">
            <thead><tr>${(mp.prbSection.headers || []).map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
            <tbody>${prbRows}</tbody>
          </table>
        </div>
      </div>
    </div>
    ${(mod.notes && mod.notes.length) ? `
    <div class="notes-box" style="margin-top:20px">
      <div class="notes-box-title">${esc(mp.notesTitle)}</div>
      <div class="notes-box-content"><ul>${mod.notes.map(n => `<li>${trust(n)}</li>`).join('')}</ul></div>
    </div>` : ''}
  `;

  renderChartsForModule(mod);
}

function populateQualityTable() {
  const body = document.getElementById('quality-table-body');
  if (!body) return;
  body.innerHTML = '';

  (OpsApp.state.data.modules || []).forEach(m => {
    const tr = document.createElement('tr');
    const cols = OpsApp.state.config.quality.valueKeys || [];
    const colorFns = OpsApp.state.config.quality.colorKeys || [];
    let cells = cols.map((key, i) => {
      const val = m[key];
      const isColor = colorFns.includes(key);
      let color = '';
      if (key === 'reopenRate' && isColor) color = `style="color:var(--${getReopenColor(val)})"`;
      else if (key === 'firstFixRate' && isColor) color = `style="color:var(--${getFirstFixColor(val)})"`;
      else if (key === 'mttr' && isColor) color = `style="color:var(--${getMttrColor(val)})"`;
      let display;
      if (key === 'reopenRate' || key === 'firstFixRate') display = fmtPct(val);
      else if (key === 'mttr') display = val != null ? fmtNum(val, 1) + 'h' : 'N/A';
      else display = val ?? '—';
      return `<td ${color}>${display}</td>`;
    }).join('');
    tr.innerHTML = `<td class="row-lbl">${esc(m.name)}</td>${cells}`;
    body.appendChild(tr);
  });
}

function populateActionItems() {
  const body = document.getElementById('action-items-body');
  const escBody = document.getElementById('escalations-body');
  const acfg = OpsApp.state.config?.actions;
  if (body) {
    body.innerHTML = '';
    const items = OpsApp.state.data.actionItems || [];
    if (items.length === 0) {
      body.innerHTML = `<tr><td colspan="${(acfg?.activeHeaders?.length) || 1}" style="text-align:center;color:var(--text-muted)">${esc(acfg?.noDataMsg || 'No data')}</td></tr>`;
    } else {
      items.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="row-lbl">${esc(item.action)}</td>
          <td>${esc(item.owner)}</td>
          <td class="mono">${esc(item.dueDate)}</td>
          <td><span class="sc-status ${item.status === 'Closed' ? 'done' : item.status === 'In Progress' ? 'inprog' : item.status === 'Open' ? 'open' : 'pending'}">${esc(item.status)}</span></td>
          <td style="text-align:left">${esc(item.nextSteps)}</td>`;
        body.appendChild(tr);
      });
    }
  }
  if (escBody) {
    escBody.innerHTML = '';
    const items = OpsApp.state.data.escalations || [];
    if (items.length === 0) {
      escBody.innerHTML = `<tr><td colspan="${(acfg?.escHeaders?.length) || 1}" style="text-align:center;color:var(--text-muted)">${esc(acfg?.noEscMsg || 'No escalations')}</td></tr>`;
    } else {
      items.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="row-lbl" style="color:var(--red)">${esc(item.issue)}</td>
          <td>${esc(item.module ? resolveModuleName(item.module) : '')}</td>
          <td>${esc(item.responsible)}</td>
          <td class="mono">${esc(item.dueDate)}</td>
          <td><span class="sc-status ${item.status === 'Resolved' ? 'done' : 'pending'}">${esc(item.status)}</span></td>
          <td style="text-align:left">${esc(item.nextSteps)}</td>`;
        escBody.appendChild(tr);
      });
    }
  }

  populateAppreciations();
  populateServiceOffers();
}

function populateAppreciations() {
  const body = document.getElementById('appreciations-body');
  if (!body) return;
  body.innerHTML = '';
  const items = OpsApp.state.data.appreciations || [];
  const acfg = OpsApp.state.config?.actions;
  if (items.length === 0) {
    body.innerHTML = `<tr><td colspan="${(acfg?.apprHeaders?.length) || 1}" style="text-align:center;color:var(--text-muted)">${esc(acfg?.noApprMsg || 'No appreciations')}</td></tr>`;
  } else {
    items.forEach(item => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${esc(item.module ? resolveModuleName(item.module) : '')}</td>
        <td style="text-align:left;font-style:italic;color:var(--text-sub)">${esc(item.note || item.message || '')}</td>`;
      body.appendChild(tr);
    });
  }
}

function populateServiceOffers() {
  const body = document.getElementById('service-offers-body');
  if (!body) return;
  body.innerHTML = '';
  const items = OpsApp.state.data.serviceOffers || [];
  const acfg = OpsApp.state.config?.actions;
  if (items.length === 0) {
    body.innerHTML = `<tr><td colspan="${(acfg?.soHeaders?.length) || 1}" style="text-align:center;color:var(--text-muted)">${esc(acfg?.noSOMsg || 'No service offers')}</td></tr>`;
  } else {
    items.forEach(item => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="row-lbl">${esc(item.requester || item.title || '')}</td>
        <td>${esc(item.status)}</td>
        <td style="text-align:left">${esc(item.reason || item.description || '')}</td>
        <td style="text-align:left">${esc(item.nextSteps || '')}</td>`;
      body.appendChild(tr);
    });
  }
}

function populateProjects() {
  const projContainer = document.getElementById('projects-cards-container');
  const ciBody = document.getElementById('ci-table-body');
  const pcfg = OpsApp.state.config?.projects;

  if (projContainer) {
    projContainer.innerHTML = '';
    const projects = OpsApp.state.data.projects || [];
    if (projects.length === 0) {
      projContainer.innerHTML = `<p style="grid-column:span ${(pcfg?.cards?.length) || 3};text-align:center;color:var(--text-muted)">${esc(pcfg?.noDataMsg || 'No projects')}</p>`;
    } else {
      projects.forEach(p => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
            <div style="font-weight:700;font-size:14px;color:var(--text-main)">${esc(p.name)}</div>
            <span class="rag-badge ${p.ragOverall}">${esc(p.ragOverall)}</span>
          </div>
          <div class="fg" style="margin-bottom:8px">
            <span class="mono" style="font-size:11px;padding:2px 6px;background:var(--bg-card);border-radius:4px">${esc(p.track)}</span>
            <span class="mono" style="margin-left:6px;font-size:11px">${esc((OpsApp.state.config.labels && OpsApp.state.config.labels.goLivePrefix) || 'Go-Live')}: ${esc(p.plannedGoLive)}</span>
          </div>
          <p style="font-size:12.5px;font-weight:600;color:var(--primary);margin-bottom:8px">${esc(p.status)}</p>
          <p style="font-size:12px;color:var(--text-sub);line-height:1.6">${esc(p.currentStatus)}</p>`;
        projContainer.appendChild(card);
      });
    }
  }

  if (ciBody) {
    ciBody.innerHTML = '';
    const ci = OpsApp.state.data.continuousImprovement || [];
    if (ci.length === 0) {
      ciBody.innerHTML = `<tr><td colspan="${(pcfg?.ciHeaders?.length) || 1}" style="text-align:center;color:var(--text-muted)">${esc(pcfg?.noCiMsg || 'No continuous improvement items')}</td></tr>`;
    } else {
      ci.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="row-lbl">${esc(item.track)}</td>
          <td style="text-align:left">${esc(item.initiative)}</td>
          <td>${esc(item.status)}</td>
          <td class="mono" style="color:var(--green);font-weight:700">${esc(item.effortSaved)}</td>
          <td class="mono">${esc(item.plannedDeploy)}</td>
          <td>${esc(item.olympusLead)}</td>`;
        ciBody.appendChild(tr);
      });
    }
  }
}

/* ══════════════════════════════════════════════════════════════════════
   CHART RENDERING
═══════════════════════════════════════════════════════════════════════ */

function renderAllCharts() {
  const activePanel = document.querySelector('.panel.active');
  let tabId = '';
  if (activePanel) {
    tabId = activePanel.id.replace('panel-', '');
    renderChartsForTab(tabId);
  }

  populateQualityTable();
  populateActionItems();
  populateProjects();
}

function renderChartsForTab(tabId) {
  switch (tabId) {
    case TAB_IDS.OVERVIEW:
      renderOverviewVolumeChart();
      renderOverviewBacklogChart();
      break;
    case TAB_IDS.QUALITY:
      renderQualityMttrChart();
      renderQualityReopenChart();
      break;
    case TAB_IDS.HEADCOUNT:
      renderHeadcountCapacityChart();
      break;
    case TAB_IDS.SAP:
    case TAB_IDS.NSAP:
      renderAllModuleCharts();
      break;
  }
}

function renderAllModuleCharts() {
  (OpsApp.state.data.modules || []).forEach(m => {
    const trendCanvas = document.getElementById(`chart-trend-${m.id}`);
    if (trendCanvas) renderChartsForModule(m);
  });
}

function renderChartsForModule(mod) {
  renderModuleTrendChart(mod);
  renderModulePriorityChart(mod);
  renderModuleAgeChart(mod);
}

function renderModuleTrendChart(mod) {
  const labels = OpsApp.state.data.months;
  const receivedData = mod.mom;
  const baselineData = labels.map(() => mod.baseline);
  const chartLabels = (OpsApp.state.config.modulePanel && OpsApp.state.config.modulePanel.trendChart && OpsApp.state.config.modulePanel.trendChart.labels) || {};
  const receivedLabel = chartLabels.received || 'Received Tickets';
  const baselineLabel = chartLabels.baseline || 'Contracted Baseline';

  makeChart(`chart-trend-${mod.id}`, 'line', {
    labels,
    datasets: [
      {
        label: receivedLabel,
        data: receivedData,
        borderColor: getCSSColor('primary'),
        backgroundColor: getCSSAlpha('primary', 0.1),
        tension: 0.3,
        fill: true,
        pointRadius: 3
      },
      {
        label: baselineLabel,
        data: baselineData,
        borderColor: hexToRgba(getCSSColor('text-muted'), 0.5),
        borderDash: [5, 5],
        pointRadius: 0,
        fill: false
      }
    ]
  }, {
    plugins: {
      legend: { display: true, position: 'top', labels: { color: getCSSColor('text-sub'), font: { size: 10 } } }
    },
    scales: {
      x: { ticks: { color: getCSSColor('text-sub') }, grid: { display: false } },
      y: { ticks: { color: getCSSColor('text-sub') }, grid: { color: getCSSAlpha('text-muted', 0.12) } }
    }
  });
}

function renderModulePriorityChart(mod) {
  const meta = mod.priorityMeta || [];
  makeChart(`chart-priority-${mod.id}`, 'doughnut', {
    labels: meta.map(m => m.label),
    datasets: [{
      data: meta.map(m => m.pct),
      backgroundColor: meta.map(m => colorToRgba(m.color, 0.85)),
      borderColor: meta.map(m => colorToHex(m.color)),
      borderWidth: 1
    }]
  }, {
    cutout: '68%',
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: ctx => ctx.label + ': ' + ctx.parsed.toFixed(1) + '%'
        }
      }
    }
  });
}

function renderModuleAgeChart(mod) {
  const meta = mod.ageMeta || [];
  makeChart(`chart-age-${mod.id}`, 'doughnut', {
    labels: meta.map(m => m.label),
    datasets: [{
      data: meta.map(m => m.pct),
      backgroundColor: meta.map(m => colorToRgba(m.color, 0.85)),
      borderColor: meta.map(m => colorToHex(m.color)),
      borderWidth: 1
    }]
  }, {
    cutout: '68%',
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: ctx => ctx.label + ': ' + ctx.parsed.toFixed(1) + '%'
        }
      }
    }
  });
}

function renderOverviewVolumeChart() {
  const labels = OpsApp.state.data.months;
  if (!Array.isArray(labels) || !Array.isArray(OpsApp.state.data.modules)) return;
  const sapTotals = labels.map((_, idx) =>
    OpsApp.state.data.modules.filter(m => m.domain === 'SAP').reduce((sum, m) => sum + ((m.mom && m.mom[idx]) || 0), 0)
  );
  const nsTotals = labels.map((_, idx) =>
    OpsApp.state.data.modules.filter(m => m.domain === 'NonERP').reduce((sum, m) => sum + ((m.mom && m.mom[idx]) || 0), 0)
  );

  const _ol = OpsApp.state.config.labels?.overviewCharts || {};
  makeChart('chart-overview-volume', 'line', {
    labels,
    datasets: [
      {
        label: _ol.sapVolume || 'SAP Volume',
        data: sapTotals,
        borderColor: getCSSColor('primary'),
        backgroundColor: getCSSAlpha('primary', 0.05),
        tension: 0.3,
        fill: true
      },
      {
        label: _ol.nsVolume || 'Non-ERP Volume',
        data: nsTotals,
        borderColor: getCSSColor('purple'),
        backgroundColor: getCSSAlpha('purple', 0.05),
        tension: 0.3,
        fill: true
      }
    ]
  }, {
    plugins: {
      legend: { display: true, labels: { color: getCSSColor('text-sub') } }
    },
    scales: {
      x: { ticks: { color: getCSSColor('text-sub') }, grid: { display: false } },
      y: { ticks: { color: getCSSColor('text-sub') }, grid: { color: getCSSAlpha('text-muted', 0.12) } }
    }
  });
}

function renderOverviewBacklogChart() {
  const labels = OpsApp.state.data.months;
  if (!Array.isArray(labels) || !Array.isArray(OpsApp.state.data.modules)) return;
  const sapBacklog = labels.map((_, idx) =>
    OpsApp.state.data.modules.filter(m => m.domain === 'SAP').reduce((sum, m) => sum + ((m.backlogMom && m.backlogMom[idx]) || 0), 0)
  );
  const nsBacklog = labels.map((_, idx) =>
    OpsApp.state.data.modules.filter(m => m.domain === 'NonERP').reduce((sum, m) => sum + ((m.backlogMom && m.backlogMom[idx]) || 0), 0)
  );

  const _ol2 = OpsApp.state.config.labels?.overviewCharts || {};
  makeChart('chart-overview-backlog', 'line', {
    labels,
    datasets: [
      {
        label: _ol2.sapBacklog || 'SAP Backlog',
        data: sapBacklog,
        borderColor: getCSSColor('green'),
        backgroundColor: getCSSAlpha('green', 0.05),
        tension: 0.3,
        fill: true
      },
      {
        label: _ol2.nsBacklog || 'Non-ERP Backlog',
        data: nsBacklog,
        borderColor: getCSSColor('amber'),
        backgroundColor: getCSSAlpha('amber', 0.05),
        tension: 0.3,
        fill: true
      }
    ]
  }, {
    plugins: {
      legend: { display: true, labels: { color: getCSSColor('text-sub') } }
    },
    scales: {
      x: { ticks: { color: getCSSColor('text-sub') }, grid: { display: false } },
      y: { ticks: { color: getCSSColor('text-sub') }, grid: { color: getCSSAlpha('text-muted', 0.12) } }
    }
  });
}

function renderQualityMttrChart() {
  if (!Array.isArray(OpsApp.state.data.modules)) return;
  const modules = OpsApp.state.data.modules.filter(m => m.mttr != null);
  const labels = modules.map(m => m.name);
  const data = modules.map(m => m.mttr);
  const bgColors = modules.map(m => {
    const col = getMttrColor(m.mttr);
    return colorToRgba(col, 0.7);
  });

  makeChart('chart-quality-mttr', 'bar', {
    labels,
    datasets: [{ label: (OpsApp.state.config.labels?.chartLabels?.mttr) || 'MTTR in Hours', data, backgroundColor: bgColors, borderRadius: 4 }]
  }, {
    indexAxis: 'y',
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: getCSSColor('text-sub') }, grid: { color: getCSSAlpha('text-muted', 0.12) } },
      y: { ticks: { color: getCSSColor('text-sub') }, grid: { display: false } }
    }
  });
}

function renderQualityReopenChart() {
  if (!Array.isArray(OpsApp.state.data.modules)) return;
  const modules = OpsApp.state.data.modules.filter(m => m.reopenRate != null);
  const labels = modules.map(m => m.name);
  const data = modules.map(m => m.reopenRate);
  const bgColors = modules.map(m => {
    const col = getReopenColor(m.reopenRate);
    return colorToRgba(col, 0.7);
  });

  makeChart('chart-quality-reopen', 'bar', {
    labels,
    datasets: [{ label: (OpsApp.state.config.labels?.chartLabels?.reopen) || 'Reopen Rate %', data, backgroundColor: bgColors, borderRadius: 4 }]
  }, {
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: getCSSColor('text-sub') }, grid: { display: false } },
      y: { ticks: { color: getCSSColor('text-sub'), callback: v => v + '%' }, grid: { color: getCSSAlpha('text-muted', 0.12) } }
    }
  });
}

function renderHeadcountCapacityChart() {
  if (!Array.isArray(OpsApp.state.data.modules)) return;
  const modules = OpsApp.state.data.modules;
  const hasPerModuleFte = modules.some(m => m.fte != null);
  const labels = modules.map(m => m.name);
  const hc = OpsApp.state.data.headcount || { sapAMS: 15, nsAMS: 10 };
  const sapTotalFtes = hc.sapAMS;
  const nsTotalFtes = hc.nsAMS;
  const sapModulesCount = modules.filter(m => m.domain === 'SAP').length;
  const nsModulesCount = modules.filter(m => m.domain === 'NonERP').length;

  const data = modules.map(m => {
    const fte = hasPerModuleFte ? (m.fte || 0) : (m.domain === 'SAP' ? (sapTotalFtes / sapModulesCount) : (nsTotalFtes / nsModulesCount));
    return fte > 0 ? (m.total / fte) : 0;
  });
  const bgColors = data.map(v => colorToRgba(getFteLoadColor(v), 0.7));

  makeChart('chart-headcount-capacity', 'bar', {
    labels,
    datasets: [{ label: (OpsApp.state.config.labels?.chartLabels?.ticketsPerFte) || 'Tickets per FTE', data, backgroundColor: bgColors, borderRadius: 4 }]
  }, {
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: getCSSColor('text-sub') }, grid: { display: false } },
      y: { ticks: { color: getCSSColor('text-sub') }, grid: { color: getCSSAlpha('text-muted', 0.12) } }
    }
  });
}

/* ══════════════════════════════════════════════════════════════════════
   EVENT BINDING
═══════════════════════════════════════════════════════════════════════ */

function bindEvents() {
  /* Tab switching — event delegation */
  const tabContainer = document.querySelector('.dashboard-tabs');
  if (tabContainer) {
    tabContainer.addEventListener('click', e => {
      const tab = e.target.closest('.db-tab');
      if (!tab) return;
      const tabId = tab.dataset.tab;
      if (!tabId) return;

      document.querySelectorAll('.db-tab').forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');

      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      const panel = document.getElementById(`panel-${tabId}`);
      if (panel) panel.classList.add('active');

      if (tabId !== TAB_IDS.ACTIONS && tabId !== TAB_IDS.PROJECTS) {
        destroyChartsForTab(tabId);
        renderChartsForTab(tabId);
        if (tabId !== TAB_IDS.SAP && tabId !== TAB_IDS.NSAP) renderAllModuleCharts();
      }
    });
  }

  /* Sub-tab switching — event delegation */
  ['sap', 'ns'].forEach(prefix => {
    const container = document.querySelector(`.${prefix}-sub-tabs`);
    if (!container) return;
    container.addEventListener('click', e => {
      const tab = e.target.closest('.sub-tab');
      if (!tab) return;
      const moduleId = tab.dataset.moduleId;
      const domain = tab.dataset.domain;
      if (!moduleId || !domain) return;

      container.querySelectorAll('.sub-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const prefix2 = domain === 'SAP' ? 'sap' : 'ns';
      const detailsContainer = document.getElementById(`${prefix2}-details-container`);
      if (detailsContainer) populateModulePanel(moduleId, detailsContainer);
    });
  });

  /* Toolbar buttons */
  const themeBtn = document.getElementById('btn-toggle-theme');
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

  const fontDown = document.getElementById('btn-font-down');
  if (fontDown) fontDown.addEventListener('click', () => changeFontSize(-1));

  const fontUp = document.getElementById('btn-font-up');
  if (fontUp) fontUp.addEventListener('click', () => changeFontSize(1));

  const printBtn = document.getElementById('btn-print');
  if (printBtn) printBtn.addEventListener('click', printDashboard);

  const helpBtn = document.getElementById('help-toggle');
  if (helpBtn) helpBtn.addEventListener('click', toggleHelp);
}

/* ══════════════════════════════════════════════════════════════════════
   INIT & AUTO-REFRESH
═══════════════════════════════════════════════════════════════════════ */

async function loadAndRender() {
  destroyAllCharts();
  const scrollPos = window.scrollY;

  const loader = document.getElementById('loader');
  if (loader) { loader.style.display = ''; loader.classList.remove('fade'); }

  try {
    /* PORTABLE_FETCH_BLOCK_START */
    if (window.__OPS_DATA__ && window.__OPS_CONFIG__) {
      OpsApp.state.data = window.__OPS_DATA__;
      OpsApp.state.config = window.__OPS_CONFIG__;
      const overrideConfig = window.__OPS_OVERRIDE__ || {};
      if (overrideConfig.ragThresholds) OpsApp.state.config.ragThresholds = overrideConfig.ragThresholds;
      if (overrideConfig.thresholds) OpsApp.state.config.overrideThresholds = overrideConfig.thresholds;
      if (OpsApp.state.data.schemaVersion === undefined) console.warn('ops_data.json has no schemaVersion — may be incompatible');
      renderAll();
      populateModuleSubTabs();
      requestAnimationFrame(() => window.scrollTo(0, scrollPos));
      return;
    }
    /* PORTABLE_FETCH_BLOCK_END */

    const [dataResp, configResp, overrideResp] = await Promise.all([
      fetch(DATA_FILE, { cache: 'no-cache' }),
      fetch(CONFIG_FILE, { cache: 'no-cache' }),
      fetch(CONFIG_OVERRIDE_FILE, { cache: 'no-cache' })
    ]);

    if (!dataResp.ok || !configResp.ok || !overrideResp.ok) {
      throw new Error(`Failed to load data: ${dataResp.status} / ${configResp.status} / ${overrideResp.status}`);
    }

    OpsApp.state.data = await dataResp.json();
    OpsApp.state.config = await configResp.json();
    if (OpsApp.state.data.schemaVersion === undefined) console.warn('ops_data.json has no schemaVersion — may be incompatible');
    const overrideConfig = await overrideResp.json();

    /* Merge ragThresholds and thresholds from opsreview_config into OpsApp.state.config.
       Other keys in opsreview_config (modules, mappings, baselines, stateMappings, etc.)
       are editor-only configuration and are not consumed by the dashboard at runtime. */
    if (overrideConfig) {
      if (overrideConfig.ragThresholds) OpsApp.state.config.ragThresholds = overrideConfig.ragThresholds;
      if (overrideConfig.thresholds) OpsApp.state.config.overrideThresholds = overrideConfig.thresholds;
    }

    renderAll();
    populateModuleSubTabs();

    _lastDataHash = dataHash(OpsApp.state.data) + dataHash(OpsApp.state.config) + dataHash(overrideConfig);

    requestAnimationFrame(() => window.scrollTo(0, scrollPos));
  } catch (err) {
    document.getElementById('loader').classList.add('fade');
    document.getElementById('app').style.visibility = 'visible';
    document.getElementById('app').innerHTML = `
      <div class="error-screen">
        <h2 style="color:var(--red);font-size:18px;margin-bottom:10px">Failed to Load Dashboard Data</h2>
        <p style="color:var(--text-sub);font-size:13px;margin-bottom:20px">${esc(err.message)}</p>
        <p style="color:var(--text-muted);font-size:11px">
          Browsers block local file access for security reasons.<br>
          Please launch using the Batch Launcher:<br>
          <code style="color:var(--green)">scripts/Launcher.bat -> Option 2</code><br>
          Or serve the public directory locally:<br>
          <code style="color:var(--green)">python -m http.server 8080</code>
        </p>
      </div>`;
    setTimeout(() => { document.getElementById('loader').style.display = 'none'; }, 500);
  }
}

let _lastDataHash = '';
function dataHash(obj) {
  const s = typeof obj === 'string' ? obj : JSON.stringify(obj);
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
  return 'h' + Math.abs(h).toString(36);
}

window.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initFontSize();
  loadAndRender();
  setInterval(async () => {
    /* PORTABLE_FETCH_BLOCK_START */
    if (window.__OPS_DATA__) return;
    /* PORTABLE_FETCH_BLOCK_END */
    try {
      const [dr, cr, or] = await Promise.all([
        fetch(DATA_FILE, { cache: 'no-cache' }),
        fetch(CONFIG_FILE, { cache: 'no-cache' }),
        fetch(CONFIG_OVERRIDE_FILE, { cache: 'no-cache' })
      ]);
      if (!dr.ok || !cr.ok || !or.ok) return;
      const [dt, ct, ot] = [await dr.text(), await cr.text(), await or.text()];
      const [dj, cj, oj] = [JSON.parse(dt), JSON.parse(ct), JSON.parse(ot)];
      if (dataHash(dj) + dataHash(cj) + dataHash(oj) === _lastDataHash) return;
    } catch (_) { return; }
    await loadAndRender();
  }, 300000);
  watchTheme();
});
