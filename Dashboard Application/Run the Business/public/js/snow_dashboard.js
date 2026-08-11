/* ══════════════════════════════════════════════════════════════════════
   HEADLESS RENDERER  v3.1
   Every string visible to the user comes from snow_weekly.json.
   To update the dashboard: edit snow_weekly.json only.
══════════════════════════════════════════════════════════════════════ */

const DATA_FILE = 'data/snow_weekly.json';

/* ── Safe tokenizer for intentionally-authored HTML (body/decision/cmt text).
   Splits on allowlisted tags (<strong>, <em>, <b>, <i>, <br>), HTML-escapes
   all text segments, and reconstructs safe markup — no DOM parsing, no XSS. */
const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const TRUST_RE = /(<\/?(?:strong|em|b|i|br)\s*\/?>)/i;
const TRUST_ALLOW = new Set(['strong','em','b','i','br']);
function trust(s) {
  return String(s ?? '').split(TRUST_RE).map(t => {
    const m = t.match(/^<\/?(\w+)\s*\/?>$/i);
    if (m && TRUST_ALLOW.has(m[1].toLowerCase())) {
      const tag = m[1].toLowerCase();
      if (tag === 'br') return '<br>';
      return t.startsWith('</') ? `</${tag}>` : `<${tag}>`;
    }
    return esc(t);
  }).join('');
}

/* ── Dynamic CSS colour helpers — read from :root custom properties at runtime.
   Charts re-render automatically when the theme flips (see MutationObserver below). */
const FALLBACK_HEX = { red:'#e05252', amber:'#e8a030', green:'#2db882', blue:'#3b8fe8', purple:'#7c5fe0', muted:'#4e6a80' };
function getCSSColor(key) {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(`--${key}`).trim();
    return v || FALLBACK_HEX[key] || FALLBACK_HEX.muted;
  } catch(e) { return FALLBACK_HEX[key] || FALLBACK_HEX.muted; }
}
function hexToRgba(hex, a) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) hex = FALLBACK_HEX.muted;
  return `rgba(${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)},${a})`;
}
function getCSSAlpha(key, a) { return hexToRgba(getCSSColor(key), a); }

/* Safe lookup helpers — warn on unknown colour key, return safe fallback */
const safeC  = k => { if (!FALLBACK_HEX[k]) console.warn(`Unknown color_key: "${k}"`); return `var(--${k||'muted'})`; };
const safeCH = k => { if (!FALLBACK_HEX[k]) console.warn(`Unknown color_key: "${k}"`); return getCSSColor(k||'muted'); };

/* ── Shared Chart.js config ── */
const CHART_DEFAULTS = {
  responsive:true, maintainAspectRatio:false,
  plugins:{
    legend:{ display:false },
    tooltip:{ backgroundColor:getCSSColor('navy3'), titleColor:getCSSColor('text'), bodyColor:getCSSColor('text2'),
              padding:8, cornerRadius:6, borderColor:hexToRgba(getCSSColor('text3'),'.15'), borderWidth:1 }
  }
};
function getGridColor() { return hexToRgba(getCSSColor('text3'),'.1'); }
function getTickColor() { return getCSSColor('text3'); }
const TICK_FONT  = { family:"'DM Sans', system-ui", size:10 };

/* ── Helpers ── */
const icon = id => `<svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true"><use href="#ic-${id}"/></svg>`;

const deltaSymbol = dir => ({ up:'▲', down:'▼', flat:'—' }[dir] || '—');

const STYLE = {
  badge: {
    red:'background:var(--red);color:#fff', amber:'background:rgba(232,160,48,.15);color:var(--amber)',
    green:'background:rgba(45,184,130,.15);color:var(--green)', blue:'background:rgba(59,143,232,.15);color:var(--blue)',
    purple:'background:rgba(124,95,224,.15);color:var(--purple)', muted:'background:rgba(255,255,255,.06);color:var(--muted)',
  },
  pill: {
    red:'background:rgba(224,82,82,.2);color:#f07070', blue:'background:rgba(59,143,232,.2);color:var(--blue)',
    purple:'background:rgba(124,95,224,.2);color:var(--purple)', amber:'background:rgba(232,160,48,.2);color:var(--amber)',
    green:'background:rgba(45,184,130,.2);color:var(--green)', muted:'background:rgba(255,255,255,.06);color:var(--muted)',
  },
  trend: {
    red:'background:rgba(224,82,82,.15);color:#f07070', green:'background:rgba(45,184,130,.15);color:var(--green)',
    flat:'background:rgba(255,255,255,.06);color:var(--muted)',
  },
  tag: {
    red:'background:rgba(224,82,82,.2);color:#f07070', blue:'background:rgba(59,143,232,.2);color:var(--blue)',
    purple:'background:rgba(124,95,224,.2);color:var(--purple)', amber:'background:rgba(232,160,48,.2);color:var(--amber)',
    green:'background:rgba(45,184,130,.2);color:var(--green)', muted:'background:rgba(255,255,255,.08);color:var(--muted)',
  },
};
const badgeStyle = k => STYLE.badge[k] || STYLE.badge.muted;
const pillStyle  = k => STYLE.pill[k]  || STYLE.pill.muted;
const trendStyle = k => STYLE.trend[k] || STYLE.trend.flat;
const tagStyle   = k => STYLE.tag[k]   || STYLE.tag.muted;

/* ── Legend helpers — used across multiple sections ── */
const legItem = (cls, color, label) =>
  `<span class="leg-item"><span class="${cls}" style="background:${color}"></span>${esc(label)}</span>`;
const legSeg = (color, label, value) =>
  `${legItem('leg-sq', color, label)} – ${esc(String(value))}`;

/* ── Shared chart dataset formatters — used by initCharts ── */
const lineDS = ds => ({
  label:ds.label, data:ds.data,
  borderColor:          safeCH(ds.color_key),
  backgroundColor:      ds.fill ? getCSSAlpha(ds.color_key, '.07') : 'transparent',
  tension:.35, borderWidth:2, pointRadius:3,
  pointBackgroundColor: safeCH(ds.color_key), fill:!!ds.fill
});

/* ── Chart lifecycle — track instances for theme-switch teardown ── */
const chartInstances = [];
const _origMakeChart = (id, type, data, extraOpts) =>
  new Chart(document.getElementById(id), {
    type, data,
    options: { ...CHART_DEFAULTS, ...(extraOpts || {}) }
  });
function makeChart(id, type, data, extraOpts) {
  const c = _origMakeChart(id, type, data, extraOpts);
  chartInstances.push(c);
  return c;
}
function destroyAllCharts() {
  chartInstances.splice(0).forEach(c => c.destroy());
}

let _chartsData = null;

function watchTheme() {
  const obs = new MutationObserver(() => { destroyAllCharts(); initCharts(_chartsData); });
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
}
const makeDoughnut = (id, data) =>
  makeChart(id, 'doughnut', data, { cutout:'68%' });

const makeBar = (id, data, extraOpts) =>
  makeChart(id, 'bar', data, {
    ...extraOpts,
    scales: {
      x:{ grid:{display:false}, ticks:{color:getTickColor(),font:{...TICK_FONT,size:9},maxRotation:30} },
      y:{ grid:{color:getGridColor()}, ticks:{color:getTickColor(),font:TICK_FONT}, beginAtZero:true },
      ...(extraOpts?.scales || {})
    }
  });

/* ── Theme toggle ── */
function toggleTheme() {
  const html = document.documentElement;
  const isLight = html.getAttribute('data-theme') === 'light';
  html.setAttribute('data-theme', isLight ? 'dark' : 'light');
  localStorage.setItem('snow-theme', isLight ? 'dark' : 'light');
}

/* ── Font size control – uses CSS zoom since all font-sizes are in px ── */
function changeFontSize(delta) {
  const cur  = parseFloat(document.body.style.zoom) || 1;
  const next = Math.min(Math.max(+(cur + delta * 0.05).toFixed(3), 0.7), 1.5);
  document.body.style.zoom = next;
  localStorage.setItem('snow-font-size', next);
}

/* ── Print dashboard – switch to light mode, expand sections, restore via afterprint ── */
function printDashboard() {
  const html = document.documentElement;
  const wasLight = html.getAttribute('data-theme') === 'light';

  const collapsedBodies = document.querySelectorAll('.sec-body.collapsed');
  const closedToggles  = document.querySelectorAll('.sec-hdr .toggle:not(.open)');

  collapsedBodies.forEach(b => b.classList.remove('collapsed'));
  closedToggles.forEach(t  => t.classList.add('open'));

  html.setAttribute('data-theme', 'light');

  function restore() {
    collapsedBodies.forEach(b => b.classList.add('collapsed'));
    closedToggles.forEach(t  => t.classList.remove('open'));
    if (!wasLight) html.setAttribute('data-theme', 'dark');
    window.removeEventListener('afterprint', restore);
  }

  window.addEventListener('afterprint', restore);
  window.print();
}

function toggleSection(id) {
  const body   = document.getElementById('sb-' + id);
  const toggle = document.getElementById('st-' + id);
  if (!body || !toggle) return;
  const isOpen = !body.classList.contains('collapsed');
  body.classList.toggle('collapsed', isOpen);
  toggle.classList.toggle('open', !isOpen);
  toggle.setAttribute('aria-expanded', String(!isOpen));
}

/* ── Section wrapper ── */
function buildSection(sec, bodyHTML) {
  const badge = sec.badge
    ? `<span class="sec-badge" style="${badgeStyle(sec.badge_color)}">${esc(sec.badge)}</span>`
    : '';
  return `
  <div class="section">
    <div class="sec-hdr" data-section="${esc(sec.id)}">
      <div class="sec-hdr-left">
        <span class="sec-icon" aria-hidden="true">${esc(sec.icon)}</span>
        <span class="sec-title">${esc(sec.title)}</span>
        ${badge}
      </div>
      <span class="sec-toggle ${sec.open ? 'open' : ''}" id="st-${esc(sec.id)}" role="button" aria-expanded="${sec.open}" tabindex="0">▾</span>
    </div>
    <div class="sec-body ${sec.open ? '' : 'collapsed'}" id="sb-${esc(sec.id)}">
      <div class="sec-body-inner">${bodyHTML}</div>
    </div>
  </div>`;
}

/* ═══════════════════════════════════════════════════════════════
   RENDER FUNCTIONS — read exclusively from JSON objects
═══════════════════════════════════════════════════════════════ */

function renderHeader(meta) {
  return `
  <header class="masthead">
    <div class="masthead-brand">
      <div class="masthead-title">${esc(meta.dashboard_title)}</div>
      <div class="masthead-sub">${esc(meta.portfolio)} &nbsp;·&nbsp; ${esc(meta.prepared_by)}</div>
    </div>
    <div class="masthead-right">
      <div class="masthead-updated">${esc(meta.data_as_of_label)} ${esc(meta.data_as_of)}</div>
      <div class="masthead-pill">${esc(meta.week_label)} · ${esc(meta.week_range)}</div>
      <div class="toolbar">
        <select id="view-filter" class="tool-select" aria-label="Filter view" title="Filter view">
          <option value="all">All items</option>
          <option value="critical">Interventions: critical only</option>
        </select>
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

function renderKPIs(kpis) {
  const tiles = kpis.map(k => {
    const sym  = deltaSymbol(k.delta_dir);
    const dcls = k.delta_dir === 'flat' ? 'var(--muted)'
      : (k.invert_delta
          ? (k.delta_dir === 'down' ? 'var(--red)'   : 'var(--green)')
          : (k.delta_dir === 'up'   ? 'var(--red)'   : 'var(--green)'));
    return `
    <div class="kpi">
      <div class="kpi-label">${esc(k.label)}</div>
      <div class="kpi-value" style="color:${safeC(k.color)}">${esc(k.value)}</div>
      <div class="kpi-sub"   style="color:${dcls}">${sym} ${esc(String(k.delta_val))} ${esc(k.delta_label)}</div>
      <div class="kpi-bar"><div class="kpi-fill" style="width:${Number(k.bar_pct)||0}%;background:${safeC(k.color)}"></div></div>
    </div>`;
  }).join('');
  return `<div class="kpi-strip">${tiles}</div>`;
}

function renderSnow(snow, sec) {
  const cards = snow.types.map(t => {
    const stats = t.stats.map(s => `
      <div class="snow-stat">
        <span class="ss-val" style="color:${safeC(s.color)}">${esc(String(s.value))}</span>
        <span class="ss-lbl">${esc(s.label)}</span>
      </div>`).join('');
    const b = t.button;
    const btn = `<a href="${esc(b.url)}" target="_blank" rel="noopener" class="snow-btn btn-${esc(b.color)}">${icon(b.icon)} ${esc(b.label)}</a>`;
    return `
    <div class="snow-card">
      <div class="snow-card-hdr">
        <div class="snow-card-lbl">
          <span class="rag rag-${esc(t.rag)}" data-cb="${esc(t.rag).charAt(0).toUpperCase()}"></span>
          ${esc(t.label)}
          <span class="type-pill" style="${pillStyle(t.pill_color)}">${esc(t.pill)}</span>
        </div>
        <span class="trend-chip" style="${trendStyle(t.trend_color)}">${esc(t.trend_label)}</span>
      </div>
      <div class="snow-stats">${stats}</div>
      <div class="snow-links">${btn}</div>
    </div>`;
  }).join('');
  return buildSection(sec, `<div class="snow-cards">${cards}</div>`);
}

function renderCharts(charts, sec) {
  const body = `
    <div class="g2" style="border-bottom:1px solid var(--border)">
      <div class="panel span2">
        <div class="panel-title">${esc(charts.incident_trend_8w.title)} <small>${esc(charts.incident_trend_8w.subtitle)}</small></div>
        <div class="chart-wrap" style="height:150px">
          <canvas id="ch-trend" role="img" aria-label="${esc(charts.incident_trend_8w.title)}"></canvas>
        </div>
        <div class="legend">
          ${charts.incident_trend_8w.datasets.map(d => legItem('leg-ln', safeC(d.color_key), d.label)).join('')}
        </div>
      </div>
    </div>
    <div class="g4" style="border-bottom:1px solid var(--border)">
      <div class="panel">
        <div class="panel-title">${esc(charts.incident_by_priority.title)} <small>${esc(charts.incident_by_priority.subtitle)}</small></div>
        <div class="chart-wrap" style="height:130px">
          <canvas id="ch-pridnt" role="img" aria-label="${esc(charts.incident_by_priority.title)}"></canvas>
        </div>
        <div class="legend">
          ${charts.incident_by_priority.segments.map(s => legSeg(safeC(s.color_key), s.label, s.value)).join('')}
        </div>
      </div>
      <div class="panel">
        <div class="panel-title">${esc(charts.sr_by_category.title)} <small>${esc(charts.sr_by_category.subtitle)}</small></div>
        <div class="chart-wrap" style="height:170px">
          <canvas id="ch-srbar" role="img" aria-label="${esc(charts.sr_by_category.title)}"></canvas>
        </div>
        ${(charts.sr_by_category.legend || []).length
          ? `<div class="legend">${charts.sr_by_category.legend.map(l => legItem('leg-sq', safeC(l.color_key), l.label)).join('')}</div>`
          : ''}
      </div>
      <div class="panel">
        <div class="panel-title">${esc(charts.rfac_pipeline.title)} <small>${esc(charts.rfac_pipeline.subtitle)}</small></div>
        <div class="chart-wrap" style="height:130px">
          <canvas id="ch-rfac" role="img" aria-label="${esc(charts.rfac_pipeline.title)}"></canvas>
        </div>
        <div class="legend">
          ${charts.rfac_pipeline.segments.map(s => legSeg(safeC(s.color_key), s.label, s.value)).join('')}
        </div>
      </div>
      <div class="panel">
        <div class="panel-title">${esc(charts.sla_by_type.title)} <small>${esc(charts.sla_by_type.target_label || 'target:')} ${esc(String(charts.sla_by_type.target_pct))}%</small></div>
        ${charts.sla_by_type.meters.map(m => `
          <div class="sla-row">
            <div class="sla-lbl">${esc(m.label)}</div>
            <div style="position:relative;flex:1;">
              <div class="sla-track"><div class="sla-fill" style="width:${Number(m.pct)||0}%;background:${safeC(m.color_key)}"></div></div>
              <div style="position:absolute;top:-2px;left:${Number(charts.sla_by_type.target_pct)||0}%;transform:translateX(-50%);width:2px;height:9px;background:rgba(255,255,255,0.28);border-radius:1px;" title="Target: ${esc(String(charts.sla_by_type.target_pct))}%"></div>
            </div>
            <div class="sla-val" style="color:${safeC(m.color_key)}">${m.pct!=null ? esc(String(m.pct))+'%' : '—'}</div>
          </div>`).join('')}
        <div class="callout">${esc(charts.sla_by_type.callout)}</div>
      </div>
    </div>
    <div class="g2">
      <div class="panel">
        <div class="panel-title">${esc(charts.prb_aging.title)} <small>${esc(charts.prb_aging.subtitle)}</small></div>
        <div class="chart-wrap" style="height:160px">
          <canvas id="ch-prbage" role="img" aria-label="${esc(charts.prb_aging.title)}"></canvas>
        </div>
          ${(charts.prb_aging.legend || []).length
          ? `<div class="legend">${charts.prb_aging.legend.map(l => legItem('leg-sq', safeC(l.color_key), l.label)).join('')}</div>`
          : ''}
      </div>
      <div class="panel">
        <div class="panel-title">${esc(charts.incidents_by_module.title)} <small>${esc(charts.incidents_by_module.subtitle)}</small></div>
        <div class="chart-wrap" style="height:160px">
          <canvas id="ch-module" role="img" aria-label="${esc(charts.incidents_by_module.title)}"></canvas>
        </div>
          ${(charts.incidents_by_module.legend || []).length
          ? `<div class="legend">${charts.incidents_by_module.legend.map(l => legItem('leg-sq', safeC(l.color_key), l.label)).join('')}</div>`
          : ''}
      </div>
    </div>`;
  return buildSection(sec, body);
}

function renderCommentary(cmt, sec) {
  const cols = cmt.columns.map((col, ci) => {
    const items = col.items.map(item => `
      <div class="cmt-item">
        <span class="cmt-tag" style="${tagStyle(item.tag_color)}">${esc(item.tag)}</span>
        <div class="cmt-text">${trust(item.text)}</div>
      </div>`).join('');
    return `
    <div class="cmt-col">
      <div class="cmt-col-hdr" style="color:${safeC(col.title_color)}">
        <span aria-hidden="true">${esc(col.icon)}</span> ${esc(col.title)}
      </div>
      <div class="cmt-col-inner" id="cmt-scroll-${ci}">${items}</div>
    </div>`;
  }).join('');

  const body = `
    <div class="cmt-cols">${cols}</div>
    <div class="cmt-footer">
      <div class="cmt-meta">${esc(cmt.author_icon || '')} &nbsp;${esc(cmt.author)} &nbsp;·&nbsp; ${esc(cmt.updated_label || 'Updated:')} ${esc(cmt.updated)}</div>
      <div class="cmt-note">${esc(cmt.template_note)}</div>
    </div>`;
  return buildSection(sec, body);
}

function renderWoW(wow, rfac, charts, sec) {
  const curWeekIdx = wow.weeks.indexOf(wow.current_week);

  const headerCells = wow.weeks.map(w =>
    `<th class="${w === wow.current_week ? 'cur-col' : ''}">${esc(String(w))}${w === wow.current_week ? ` ${esc(wow.current_week_marker)}` : ''}</th>`
  ).join('');

  const rows = wow.rows.map(row => {
    const cells = row.values.map((v, i) => {
      const isCur = i === curWeekIdx;
      let delta = '';
      if (i > 0) {
        const raw  = row.raw_values || row.values;
        const prev = parseFloat(raw[i-1]);
        const cur  = parseFloat(raw[i]);
        if (!isNaN(prev) && !isNaN(cur) && cur !== prev) {
          const diff = cur - prev;
          const up   = diff > 0;
          const bad  = row.invert_delta ? !up : up;
          const dCol = bad ? 'var(--red)' : 'var(--green)';
          const sym  = up ? '▲' : '▼';
          const abs  = Math.abs(diff);
          const unit = esc(row.delta_unit || '');
          delta = `<span class="w-delta" style="color:${dCol}">${sym}${abs}${unit}</span>`;
        } else if (!isNaN(prev) && !isNaN(cur)) {
          delta = `<span class="w-delta" style="color:var(--muted)">—</span>`;
        }
      }
      return `<td class="${isCur ? 'cur-col' : ''}">${esc(String(v))}${delta}</td>`;
    }).join('');
    return `<tr><td class="row-hdr">${esc(row.label)}</td>${cells}</tr>`;
  }).join('');

  const body = `
    <div class="wow-scorecards-grid">
      <div class="panel">
        <div class="panel-title">${esc(wow.title)} <small>${esc(wow.subtitle)}</small></div>
        <table class="data-table">
          <thead><tr><th>${esc(wow.row_header_label || 'Type')}</th>${headerCells}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="callout">${esc(wow.callout)}</div>
      </div>
      ${renderRfacScorecard(rfac)}
    </div>
    <div style="display:flex;flex-direction:column;gap:1px;background:var(--border)">
      <div class="panel">
        <div class="panel-title">${esc(charts.wow_volume.title)} <small>${esc(charts.wow_volume.subtitle)}</small></div>
        <div class="chart-wrap" style="height:130px">
          <canvas id="ch-wow" role="img" aria-label="${esc(charts.wow_volume.title)}"></canvas>
        </div>
        <div class="legend">
          ${charts.wow_volume.datasets.map(d => legItem('leg-sq', safeC(d.color_key), d.label)).join('')}
        </div>
      </div>
      <div class="panel">
        <div class="panel-title">${esc(charts.wow_sla_trend.title)} <small>${esc(charts.wow_sla_trend.subtitle || '')} · ${esc(String(charts.wow_sla_trend.target_pct))}${esc(charts.wow_sla_trend.target_label || '% target')}</small></div>
        <div class="chart-wrap" style="height:110px">
          <canvas id="ch-slawow" role="img" aria-label="${esc(charts.wow_sla_trend.title)}"></canvas>
        </div>
        <div class="legend">
          ${charts.wow_sla_trend.datasets.map(d => legItem('leg-ln', safeC(d.color_key), d.label)).join('')}
          <span class="leg-item"><span class="leg-ln" style="background:var(--text3);border-top:1px dashed var(--text3);height:0"></span>${esc(String(charts.wow_sla_trend.target_pct))}${esc(charts.wow_sla_trend.target_label || '% target')}</span>
        </div>
      </div>
    </div>`;
  return buildSection(sec, body);
}

function renderRfacScorecard(rfac) {
  const lastIdx = rfac.weeks.indexOf(rfac.current_week);
  const curIdx  = lastIdx >= 0 ? lastIdx : rfac.weeks.length - 1;

  /* Header row — final week gets cur-col class */
  const headerCells = rfac.weeks.map((w, i) =>
    `<th class="${i === curIdx ? 'cur-col' : ''}">${esc(String(w))}${i === curIdx ? ` ${esc(rfac.current_week_marker || '← now')}` : ''}</th>`
  ).join('');

  /* Data rows — WoW delta computed dynamically from history[] values */
  const rows = rfac.rows.map(row => {
    const historyCells = row.history.map((val, i) => {
      const isActive = i === curIdx;
      const classes  = isActive ? `cur-col highlight-${esc(row.status)}` : '';

      let delta = '';
      if (i > 0) {
        const prev = parseFloat(row.history[i - 1]);
        const cur  = parseFloat(val);
        if (!isNaN(prev) && !isNaN(cur) && cur !== prev) {
          const diff = cur - prev;
          const up   = diff > 0;
          /* invert_delta=true means rising is good (e.g. Closed/Completed) */
          const bad  = row.invert_delta ? !up : up;
          const dCol = bad ? 'var(--red)' : 'var(--green)';
          const sym  = up ? '▲' : '▼';
          delta = `<span class="rfac-delta" style="color:${dCol}">${sym}${Math.abs(diff)}</span>`;
        } else if (!isNaN(prev) && !isNaN(cur)) {
          delta = `<span class="rfac-delta" style="color:var(--muted)">—</span>`;
        }
      }

      return `<td class="${classes}">${esc(String(val))}${delta}</td>`;
    }).join('');

    return `
      <tr>
        <td class="row-hdr">${esc(row.metric)}</td>
        ${historyCells}
      </tr>`;
  }).join('');

  return `
    <div class="panel">
      <div class="panel-title">${esc(rfac.title)} <small>${esc(rfac.subtitle)}</small></div>
      <table class="data-table">
        <thead>
          <tr>
            <th>${esc(rfac.row_header_label || 'Change Phase')}</th>
            ${headerCells}
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="callout">${esc(rfac.callout)}</div>
    </div>`;
}

function renderIntervention(intv, sec) {
  const count   = intv.items.length;
  const dynSec  = Object.assign({}, sec, { badge: `${count} ${intv.open_suffix}` });

  const cards = intv.items.map(item => {
    const isAmber   = String(item.severity).toLowerCase() === 'amber';
    const metaChips = (item.meta || []).map(m => `<span class="meta-chip">${esc(m)}</span>`).join('');
    return `
    <div class="int-card">
      <div class="int-item ${isAmber ? 'amber' : ''}">
        <div class="int-item-hdr">
          <div class="int-item-title">${esc(item.title)}</div>
          <span class="esc-badge ${isAmber ? 'esc-amber' : 'esc-red'}">${esc(item.badge_label)}</span>
        </div>
        <div class="int-meta">${metaChips}</div>
        <div class="int-body">${trust(item.body)}</div>
        <div class="int-ask">
          <strong>${esc(intv.decision_label || 'Decision required')}</strong>
          ${trust(item.decision)}
        </div>
        <div class="int-footer">
          <div class="owner-row">
            <div class="avatar" aria-hidden="true">${esc(item.avatar)}</div>
            ${esc(intv.raised_by_label)} ${esc(item.raised_by)}
          </div>
          <span class="age-chip age-${esc(item.age_color)}">${esc(item.age_label)}</span>
        </div>
      </div>
    </div>`;
  }).join('');

  const body = `
    <div class="int-banner">
      <div class="int-banner-info">
        <span class="int-banner-icon" aria-hidden="true">${esc(intv.banner_icon)}</span>
        <div>
          <div class="int-banner-title">${count} ${esc(intv.banner_title)}</div>
          <div class="int-banner-sub">${esc(intv.banner_sub)}</div>
        </div>
      </div>
      <div class="int-count">${count} ${esc(intv.open_suffix)}</div>
    </div>
    <div class="int-cards" id="int-cards-scroll">${cards}</div>`;
  return buildSection(dynSec, body);
}

function renderFooter(footer) {
  const ragItems = footer.rag_legend.map(r =>
    `<span class="fr-item"><span class="rag rag-${esc(r.color)}" data-cb="${esc(r.color).charAt(0).toUpperCase()}" style="margin-right:4px"></span>${esc(r.label)}</span>`
  ).join('');
  const autoLabel = footer.auto_generated_label
    ? `<span class="fr-item" style="margin-left:auto;opacity:.5">${esc(footer.auto_generated_label)}</span>`
    : '';
  return `<footer class="footer"><div class="footer-rag">${ragItems}${autoLabel}</div></footer>`;
}

/* ── Interactive data filter ── */
function applyDataFilter(mode) {
  document.querySelectorAll('.int-card').forEach(el => {
    if (mode === 'critical') {
      el.setAttribute('data-filter', 'critical');
    } else {
      el.removeAttribute('data-filter');
    }
  });
}

/* ═══════════════════════════════════════════════════
   CHART INITIALISER
═══════════════════════════════════════════════════ */
function initCharts(charts) {
  /* Shared doughnut dataset config */
  const donutDS = (segments) => ({
    data: segments.map(s => s.value),
    backgroundColor: segments.map(s => safeCH(s.color_key)),
    borderColor: safeCH('muted'), borderWidth:3, hoverOffset:6
  });

  const gridC = getGridColor();
  const tickC = getTickColor();

  const tasks = [
    /* Incident 8-week trend */
    () => makeChart('ch-trend', 'line',
      { labels:charts.incident_trend_8w.labels, datasets:charts.incident_trend_8w.datasets.map(lineDS) },
      { scales:{
        x:{ grid:{display:false}, ticks:{color:tickC,font:TICK_FONT} },
        y:{ grid:{color:gridC}, ticks:{color:tickC,font:TICK_FONT}, beginAtZero:true }
      }}
    ),

    /* Priority doughnut */
    () => {
      const pd = charts.incident_by_priority;
      makeDoughnut('ch-pridnt', { labels:pd.segments.map(s => s.label), datasets:[donutDS(pd.segments)] });
    },

    /* SR by category */
    () => {
      const sr = charts.sr_by_category;
      makeBar('ch-srbar',
        { labels:sr.labels, datasets:[{ data:sr.data, backgroundColor:getCSSAlpha(sr.color_key,'.55'), borderColor:safeCH(sr.color_key), borderWidth:1, borderRadius:3 }] }
      );
    },

    /* RFAC pipeline doughnut */
    () => {
      const rfc = charts.rfac_pipeline;
      makeDoughnut('ch-rfac', { labels:rfc.segments.map(s => s.label), datasets:[donutDS(rfc.segments)] });
    },

    /* PRB aging horizontal bar */
    () => {
      const prb = charts.prb_aging;
      makeChart('ch-prbage', 'bar',
        { labels:prb.records.map(r => r.id), datasets:[{ data:prb.records.map(r => r.days), backgroundColor:prb.records.map(r => safeCH(r.color_key)), borderColor:'transparent', borderRadius:3 }] },
        { indexAxis:'y', scales:{
          x:{ grid:{color:gridC}, ticks:{color:tickC,font:TICK_FONT}, title:{display:true,text:prb.axis_label,color:tickC,font:TICK_FONT} },
          y:{ grid:{display:false}, ticks:{color:tickC,font:{family:"'DM Mono',monospace",size:9}} }
        }}
      );
    },

    /* Incidents by module */
    () => {
      const mod = charts.incidents_by_module;
      makeBar('ch-module',
        { labels:mod.labels, datasets:[{ data:mod.data, backgroundColor:getCSSAlpha(mod.color_key,'.55'), borderColor:safeCH(mod.color_key), borderWidth:1, borderRadius:3 }] }
      );
    },

    /* WoW volume grouped bar */
    () => {
      const wv = charts.wow_volume;
      const ci = wv.current_week_index;
      makeChart('ch-wow', 'bar', {
        labels:wv.labels,
        datasets:wv.datasets.map(ds => ({
          label:ds.label, data:ds.data,
          backgroundColor: ds.data.map((_,i) => getCSSAlpha(ds.color_key, i===ci ? '.9' : '.45')),
          borderColor: safeCH(ds.color_key), borderWidth:1, borderRadius:3, barPercentage:.4
        }))
      }, {
        scales:{
          x:{ grid:{display:false}, ticks:{color:tickC,font:TICK_FONT} },
          y:{ grid:{color:gridC}, ticks:{color:tickC,font:TICK_FONT}, beginAtZero:true }
        }
      });
    },

    /* SLA trend line */
    () => {
      const ws = charts.wow_sla_trend;
      makeChart('ch-slawow', 'line', {
        labels:ws.labels,
        datasets:[
          ...ws.datasets.map(ds => ({
            label:ds.label, data:ds.data,
            borderColor: safeCH(ds.color_key), pointBackgroundColor: safeCH(ds.color_key),
            tension:.3, borderWidth:2, pointRadius:3, fill:false
          })),
          { label:`${ws.target_pct}% Target`, data:ws.labels.map(() => ws.target_pct),
            borderColor:hexToRgba(getCSSColor('text3'),'.4'), borderDash:[4,4], borderWidth:1, pointRadius:0, fill:false }
        ]
      }, {
        scales:{
          x:{ grid:{display:false}, ticks:{color:tickC,font:TICK_FONT} },
          y:{ grid:{color:gridC}, ticks:{color:tickC,font:TICK_FONT,callback:v => v+'%'},
              min:ws.y_min, max:ws.y_max }
        }
      });
    },
  ];

  tasks.forEach((fn, i) => setTimeout(fn, i * 30));
}

/* ═══════════════════════════════════════════════════
   DATA VALIDATION ENGINE
═══════════════════════════════════════════════════ */
const VALID_RAG = ['red','amber','green'];
const VALID_DELTA_DIR = ['up','down','flat'];
const VALID_COLOR_KEYS = ['red','amber','green','blue','purple','muted'];
const VALID_SEVERITY = ['red','amber'];
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const isValidDate = s => ISO_DATE_RE.test(s) && !isNaN(new Date(s+'T00:00:00').getTime());

function validateData(data) {
  const errors=[], warnings=[];
  const issue = (type,section,item,msg) =>
    (type==='error'?errors:warnings).push({type,section,item,msg});

  if (typeof data !== 'object' || data === null) {
    issue('error','Root','','Data is not a valid JSON object.');
    return { errors, warnings };
  }

  /* Meta */
  const meta = data.meta;
  if (!meta || typeof meta !== 'object') {
    issue('error','meta','','Section "meta" is missing or not an object.');
  } else {
    ['dashboard_title','portfolio','prepared_by','week_label','week_range','data_as_of'].forEach(k => {
      if (!String(meta[k]??'').trim()) issue('error','meta',k,`"${k}" is empty or missing.`);
    });
    if (meta.lastUpdated && meta.lastUpdated !== null && !isValidDate(meta.lastUpdated) && isNaN(new Date(meta.lastUpdated).getTime()))
      issue('warning','meta','lastUpdated','Not a valid ISO 8601 date.');
  }

  /* Sections */
  if (!data.sections || typeof data.sections !== 'object') {
    issue('error','sections','','Section "sections" is missing or not an object.');
  }

  /* KPIs */
  if (Array.isArray(data.kpis)) {
    data.kpis.forEach((k,i) => {
      const ctx = `kpi[${i}]`;
      if (!String(k.label??'').trim()) issue('error','kpis',ctx,'label is empty.');
      if (!String(k.value??'').trim()) issue('error','kpis',ctx,'value is empty.');
      const bp = Number(k.bar_pct);
      if (isNaN(bp) || bp < 0 || bp > 100) issue('error','kpis',ctx,`bar_pct "${k.bar_pct}" is not in 0–100 range.`);
      if (k.delta_dir && !VALID_DELTA_DIR.includes(k.delta_dir)) issue('error','kpis',ctx,`delta_dir "${k.delta_dir}" invalid. Use up/down/flat.`);
      if (k.color && !VALID_COLOR_KEYS.includes(k.color)) issue('warning','kpis',ctx,`color "${k.color}" unrecognised.`);
    });
  } else {
    issue('error','kpis','','"kpis" is not an array.');
  }

  /* Snow links — check rag values */
  if (data.snow_links?.types) {
    data.snow_links.types.forEach((t,i) => {
      if (t.rag && !VALID_RAG.includes(t.rag)) issue('error','snow_links',`type[${i}]`,`rag "${t.rag}" invalid. Use red/amber/green.`);
    });
  }

  /* Commentary */
  if (data.commentary?.columns) {
    data.commentary.columns.forEach((col,i) => {
      if (!String(col.title??'').trim()) issue('warning','commentary',`column[${i}]`,'title is empty.');
      (col.items||[]).forEach((item,j) => {
        if (!String(item.text??'').trim()) issue('warning','commentary',`column[${i}].item[${j}]`,'text is empty.');
      });
    });
  }

  /* Charts — validate segments and data arrays */
  if (data.charts) {
    const ch = data.charts;
    if (ch.rfac_pipeline?.segments) {
      ch.rfac_pipeline.segments.forEach((s,i) => {
        if (s.color_key && !VALID_COLOR_KEYS.includes(s.color_key)) issue('warning','charts',`rfac_pipeline.segments[${i}]`,`color_key "${s.color_key}" unrecognised.`);
      });
    }
  }

  return { errors, warnings };
}

/* ── Silent auto-refresh with fingerprint comparison ── */
let _lastFingerprint = null;

function captureScrollPositions() {
  const state = {};
  const scrollEls = document.querySelectorAll('.int-cards, .cmt-col-inner');
  scrollEls.forEach(el => {
    if (el.id) state[el.id] = { top: el.scrollTop, left: el.scrollLeft };
  });
  return state;
}
function restoreScrollPositions(state) {
  Object.entries(state).forEach(([id, pos]) => {
    const el = document.getElementById(id);
    if (el) { el.scrollTop = pos.top; el.scrollLeft = pos.left; }
  });
}

async function silentRefresh(data) {
  try {
    const res = await fetch(DATA_FILE, { cache:'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const fresh = await res.json();
    const { errors } = validateData(fresh);
    if (errors.length > 0) return;
    const fingerprint = fresh.meta?.lastUpdated ?? null;
    if (fingerprint === _lastFingerprint) return;
    _lastFingerprint = fingerprint;

    const helpOpen = document.getElementById('help-panel')?.classList.contains('open') ?? false;
    const scrollState = captureScrollPositions();

    /* Re-render */
    const S = fresh.sections;
    Object.keys(S).forEach(k => {
      if (S[k] !== null && typeof S[k] === 'object') S[k].id = k;
    });
    const app = document.getElementById('app');
    app.innerHTML =
      renderHeader(fresh.meta) +
      renderKPIs(fresh.kpis) +
      renderSnow(fresh.snow_links, S.snow) +
      renderCharts(fresh.charts, S.charts) +
      renderCommentary(fresh.commentary, S.commentary) +
      renderWoW(fresh.wow_scorecard, fresh.rfac_scorecard, fresh.charts, S.wow) +
      renderIntervention(fresh.intervention, S.intervention) +
      renderFooter(fresh.footer);

    const masthead = app.querySelector('.masthead');
    const helpPanel = document.getElementById('help-panel');
    if (masthead && helpPanel) masthead.after(helpPanel);

    restoreScrollPositions(scrollState);
    applyDataFilter(document.getElementById('view-filter')?.value || 'all');

    if (helpOpen) {
      document.getElementById('help-panel').classList.add('open');
      document.getElementById('help-toggle').textContent = '✕';
      document.getElementById('help-toggle').setAttribute('aria-expanded', 'true');
    }

    destroyAllCharts();
    initCharts(fresh.charts);
    _chartsData = fresh.charts;
  } catch (e) { console.warn('[silentRefresh]', e); }
}

/* ═══════════════════════════════════════════════════
   BOOT
═══════════════════════════════════════════════════ */
async function boot() {
  try {
    /* Portable build: window.__SNOW_DATA__ is injected by Launcher.bat option 2 */
    /* PORTABLE_FETCH_BLOCK_START */
    const res  = await fetch(DATA_FILE);
    if (!res.ok) throw new Error(`HTTP ${res.status} — could not load ${DATA_FILE}`);
    const data = await res.json();
    /* PORTABLE_FETCH_BLOCK_END */

    const S = data.sections;
    Object.keys(S).forEach(k => {
      if (S[k] !== null && typeof S[k] === 'object') S[k].id = k;
    });

    const app = document.getElementById('app');
    app.innerHTML =
      renderHeader(data.meta) +
      renderKPIs(data.kpis) +
      renderSnow(data.snow_links, S.snow) +
      renderCharts(data.charts, S.charts) +
      renderCommentary(data.commentary, S.commentary) +
      renderWoW(data.wow_scorecard, data.rfac_scorecard, data.charts, S.wow) +
      renderIntervention(data.intervention, S.intervention) +
      renderFooter(data.footer);

    const masthead  = app.querySelector('.masthead');
    const helpPanel = document.getElementById('help-panel');
    if (masthead && helpPanel) masthead.after(helpPanel);

    app.style.visibility = 'visible';
    const loader = document.getElementById('loader');
    loader.classList.add('fade');
    setTimeout(() => loader.remove(), 450);

    document.title = `${data.meta.week_label} · ${data.meta.dashboard_title}`;

    /* Help toggle */
    const helpToggle = document.getElementById('help-toggle');
    helpToggle.addEventListener('click', () => {
      const isOpen = helpPanel.classList.toggle('open');
      helpToggle.textContent = isOpen ? '✕' : '?';
      helpToggle.setAttribute('aria-expanded', String(isOpen));
    });

    /* Section toggle via delegation */
    document.getElementById('app').addEventListener('click', (e) => {
      const hdr = e.target.closest('.sec-hdr');
      if (hdr && hdr.dataset.section) toggleSection(hdr.dataset.section);
    });

    /* Toolbar delegation — #app persists across silentRefresh innerHTML replacement */
    document.getElementById('app').addEventListener('click', (e) => {
      const btn = e.target.closest('button, [role="button"]');
      if (!btn) return;
      if (btn.id === 'btn-toggle-theme') toggleTheme();
      else if (btn.id === 'btn-font-down') changeFontSize(-1);
      else if (btn.id === 'btn-font-up') changeFontSize(1);
      else if (btn.id === 'btn-print') printDashboard();
    });
    document.getElementById('app').addEventListener('change', (e) => {
      if (e.target.id === 'view-filter') applyDataFilter(e.target.value);
    });

    /* Restore saved preferences */
    const savedTheme = localStorage.getItem('snow-theme');
    if (savedTheme === 'light') document.documentElement.setAttribute('data-theme', 'light');
    const savedFontSize = localStorage.getItem('snow-font-size');
    if (savedFontSize) document.body.style.zoom = savedFontSize;

    initCharts(data.charts);
    _chartsData = data.charts;
    watchTheme();

    /* Auto-refresh: poll every 5 minutes, only re-render when lastUpdated changes */
    _lastFingerprint = data.meta?.lastUpdated ?? null;
    setInterval(() => silentRefresh(data), 300000);

  } catch (err) {
    const loader = document.getElementById('loader');
    if (loader) loader.style.display = 'none';
    const errDiv = document.createElement('div');
    errDiv.style.cssText = 'padding:48px;text-align:center;font-family:var(--mono);';
    errDiv.innerHTML = `
      <p style="color:var(--red);font-size:13px;margin-bottom:10px">⚠ Failed to load dashboard data</p>
      <p style="color:var(--text3);font-size:11px;margin-bottom:18px">${esc(err.message)}</p>
      <p style="color:var(--text3);font-size:10px;line-height:2">
        Launch via a local server:<br>
        <code style="color:var(--green)">python -m http.server 8080</code><br>
        then open <strong>http://localhost:8080/snow_dashboard.html</strong><br><br>
        Or use <strong>Launcher.bat → option 1</strong>.
      </p>`;
    document.body.appendChild(errDiv);
  }
}

boot();