/* ═══════════════════════════════════════════════════════
   UTILITIES
═══════════════════════════════════════════════════════ */
const $ = id => document.getElementById(id);

/* Normalize and validate RAG values (case-insensitive, HOLD supported) */
function normalizeRag(val) {
  if (!val) return 'AMBER';
  const v = String(val).trim().toUpperCase();
  const valid = ['GREEN','AMBER','RED','HOLD'];
  if (valid.includes(v)) return v;
  console.warn(`⚠ Invalid RAG value: "${val}" — defaulting to AMBER`);
  return 'AMBER';
}

/* colourblind letter for a RAG value */
const cbLabel = { GREEN:'G', AMBER:'A', RED:'R', HOLD:'H' };

/* Resolve projectStatus: explicit field takes priority, else infer from rag.overall */
function projectStatus(p) {
  const s = String(p.projectStatus ?? '').toLowerCase();
  if (['active','hold','complete'].includes(s)) return s;
  const rag = normalizeRag(p.rag?.overall);
  if (rag === 'HOLD') return 'hold';
  return 'active';
}

/* ═══════════════════════════════════════════════════════
   COMPUTE PULSE — driven by rag.overall, not scheduleStatus
═══════════════════════════════════════════════════════ */
function computePulse(projects) {
  const ragPriority = { RED:3, AMBER:2, GREEN:1, HOLD:0 };
  let onTrack=0, atRisk=0, offTrack=0, onHold=0;
  let worstRag='GREEN', worstPriority=0;

  projects.forEach(p => {
    const overall = normalizeRag(p.rag?.overall);
    if      (overall==='GREEN') onTrack++;
    else if (overall==='AMBER') atRisk++;
    else if (overall==='RED')   offTrack++;
    else if (overall==='HOLD')  onHold++;

    if (overall !== 'HOLD') {
      const pri = ragPriority[overall] ?? 1;
      if (pri > worstPriority) { worstPriority=pri; worstRag=overall; }
    }
  });

  const total       = projects.length;
  const activeTotal = onTrack + atRisk + offTrack;
  let summary = '';
  if (offTrack > 0) {
    summary = `${offTrack} Project${offTrack!==1?'s':''} Off Track`;
    if (onHold > 0) summary += ` · ${onHold} On Hold`;
  } else if (atRisk > 0) {
    summary = `${onTrack} of ${activeTotal} Active On Track · ${atRisk} At Risk`;
    if (onHold > 0) summary += ` · ${onHold} On Hold`;
  } else if (onHold > 0) {
    summary = `${onTrack} Active On Track · ${onHold} On Hold`;
  } else {
    summary = `${total} of ${total} Projects On Track`;
  }

  return { globalRag:worstRag, ragSummary:summary, counts:{onTrack,atRisk,offTrack,onHold} };
}

/* ═══════════════════════════════════════════════════════
   DATE HELPERS
═══════════════════════════════════════════════════════ */
function parseDate(iso) {
  const d   = new Date(iso + 'T00:00:00');
  const day = d.getDate().toString();
  const mon = d.toLocaleString('en-GB',{month:'short'}).toUpperCase()
              + ' ' + String(d.getFullYear()).slice(2);
  return { day, mon };
}

function fmtUpdated(iso) {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return 'Invalid date';
    return 'Updated ' + d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})
           + ' · ' + d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
  } catch { return 'Invalid date'; }
}

function fmtRefreshTime() {
  return new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
}

/* ═══════════════════════════════════════════════════════
   RENDER — META  (Phase 3.2: portfolioOwner now rendered)
═══════════════════════════════════════════════════════ */
function renderMeta(meta) {
  $('meta-title').textContent   = meta.reportTitle      ?? 'CTB Portfolio Status';
  $('meta-sub').textContent     = meta.confidentiality  ?? '';
  $('meta-period').textContent  = meta.period           ?? '';
  $('meta-updated').textContent = meta.lastUpdated ? fmtUpdated(meta.lastUpdated) : '';
  document.title = meta.reportTitle ?? 'CTB Dashboard';

  // Phase 3.2 — render portfolioOwner in masthead
  const ownerEl = $('meta-owner');
  if (ownerEl) ownerEl.textContent = meta.portfolioOwner ? `Owner: ${meta.portfolioOwner}` : '';
}

/* ═══════════════════════════════════════════════════════
   RENDER — PULSE
   Phase 1: flag-banner shown via .visible class (no inline style)
═══════════════════════════════════════════════════════ */
function renderPulse(pulse) {
  const rag = (pulse.globalRag ?? 'GREEN').toUpperCase();
  const orbEl = $('rag-orb');
  if (!orbEl) return;
  orbEl.className = 'rag-orb';
  orbEl.classList.add(rag);
  const ragValEl = $('rag-value');
  ragValEl.className = 'rag-value';
  ragValEl.classList.add(rag);
  ragValEl.textContent = rag;
  $('rag-sub').textContent   = pulse.ragSummary ?? '';

  const c = pulse.counts ?? {};
  const counts = [
    { dot:'GREEN', num:c.onTrack ??0, lbl:'On Track'  },
    { dot:'AMBER', num:c.atRisk  ??0, lbl:'At Risk'   },
    { dot:'RED',   num:c.offTrack??0, lbl:'Off Track' },
    { dot:'HOLD',  num:c.onHold  ??0, lbl:'On Hold'   },
  ];
  $('rag-counts').innerHTML = counts.map(x => `
    <div class="count-cell">
      <div class="count-dot ${x.dot}"></div>
      <div class="count-num">${x.num}</div>
      <div class="count-lbl">${esc(x.lbl)}</div>
    </div>`).join('');

  // Phase 2.1 — .visible class toggles the banner; no inline style
  const banner = $('flag-banner');
  if (pulse.keyFlag) {
    banner.classList.add('visible');
    $('flag-text').textContent = pulse.keyFlag;
  } else {
    banner.classList.remove('visible');
  }
}

/* ═══════════════════════════════════════════════════════
   RENDER — SCORECARD
   Phase 3.3: projectStatus field; complete projects dimmed
   Phase 4.3: colourblind data-cb labels on dots
═══════════════════════════════════════════════════════ */
function buildCardHtml(p) {
  const overall = normalizeRag(p.rag?.overall ?? 'GREEN');
  const status  = projectStatus(p);
  const dots = [
    { lbl:'SCH', val:normalizeRag(p.rag?.schedule) },
    { lbl:'BDG', val:normalizeRag(p.rag?.budget)   },
    { lbl:'SCP', val:normalizeRag(p.rag?.scope)     },
    { lbl:'QLT', val:normalizeRag(p.rag?.quality)   },
  ];
  const statusBadge = status !== 'active'
    ? `<span class="proj-status-badge ${status}">${status.toUpperCase()}</span>` : '';
  return `
    <div class="sc-card${status==='complete' ? ' status-complete' : ''}"
      data-name="${esc(p.name)}"
      data-rag="${overall}"
      data-phase="${esc(p.phase ?? '')}">
      <div class="sc-accent ${overall}"></div>
      <div class="sc-name">${esc(p.name)}${statusBadge}</div>
      <div class="sc-phase">${esc(p.phase)}${p.subPhase ? ' · ' + esc(p.subPhase) : ''}</div>
      <div class="sc-dots">
        ${dots.map(d => `
          <div class="sc-dot-wrap" title="${d.lbl}">
            <div class="sc-dot ${d.val}" data-cb="${cbLabel[d.val]??''}"></div>
            <div class="sc-dot-lbl">${d.lbl}</div>
          </div>`).join('')}
      </div>
    </div>`;
}

function renderScorecard(projects) {
  const strip = $('scorecard-strip');
  if (!strip) return;
  strip.innerHTML = projects.map(buildCardHtml).join('');
}

/* ═══════════════════════════════════════════════════════
   RENDER — MATRIX
   Phase 2.8: workstream count respects hold split
   Phase 3.1: affectedProjects resolved by id → name
   Phase 3.3: complete rows dimmed
   Phase 4.3: colourblind data-cb on rag-dot and overall-dot
   Phase 2 fix: safeUrl for deepDiveUrl; normalizeRag replaces ragClass
═══════════════════════════════════════════════════════ */
function renderMatrix(projects) {
  const holdCount   = projects.filter(p => normalizeRag(p.rag?.overall)==='HOLD').length;
  let countLabel    = `${projects.length} WORKSTREAM${projects.length!==1?'S':''}`;
  if (holdCount > 0) countLabel += ` · ${holdCount} ON HOLD`;
  const mc = $('matrix-count');
  if (mc) mc.textContent = countLabel;

  const mb = $('matrix-body');
  if (mb) mb.innerHTML = projects.map(buildProjectRow).join('');
}

function statusKey(s) {
  if (!s) return 'ON-TRACK';
  const u = s.toUpperCase().replace(/\s+/g,'-');
  return (u==='ON-HOLD'||u==='HOLD') ? 'ON-HOLD' : u;
}

function buildProjectRow(p) {
  const sk      = statusKey(p.scheduleStatus);
  const overall = normalizeRag(p.rag?.overall ?? 'GREEN');
  const status  = projectStatus(p);
  const dots    = ['schedule','budget','scope','quality'].map(k => {
    const v = normalizeRag(p.rag?.[k] ?? 'GREEN');
    return `<div class="rag-dot ${v}" title="${k.charAt(0).toUpperCase()+k.slice(1)}" data-cb="${cbLabel[v]??''}"></div>`;
  }).join('');

  return `<tr class="${status==='complete' ? 'matrix-row-complete' : ''}"
    data-name="${esc(p.name)}"
    data-rag="${overall}"
    data-phase="${esc(p.phase ?? '')}"
    data-comment="${esc(p.comment ?? '')}">
    <td class="proj-name-cell">
      <div class="proj-name">${esc(p.name)}${status!=='active'?`<span class="proj-status-badge ${status}">${status.toUpperCase()}</span>`:''}</div>
      <div class="proj-note">${esc(p.comment)}</div>
    </td>
    <td><span class="phase-tag">${esc(p.phase)}${p.subPhase ? ' · ' + esc(p.subPhase) : ''}</span></td>
    <td>
      <span class="sched-tag ${sk}">
        ${esc(p.scheduleVariance??'')} ${esc(p.scheduleStatus??'')}
      </span>
    </td>
    <td><div class="rag-dots-row">${dots}</div></td>
    <td><div class="overall-dot ${overall}" data-cb="${cbLabel[overall]??''}"></div></td>
    <td><span class="milestone-cell" title="${esc(p.nextMilestone)}">${esc(p.nextMilestone)}</span></td>
    <td><a class="dive-link" href="${safeUrl(p.deepDiveUrl??'#')}" target="_blank" rel="noopener" aria-label="Open deep dive for ${esc(p.name)}">↗ ${esc(p.deepDiveLabel ?? 'Open')}</a></td>
  </tr>`;
}

/* ═══════════════════════════════════════════════════════
   RENDER — RISKS
   affectedProjects: supports both project id and project name (backward compat)
   Validator now warns when names are used instead of ids.
═══════════════════════════════════════════════════════ */
function buildRiskItemHtml(r, projectsById, projectsByName) {
  const level = (r.level??'MED').toUpperCase();
  const affected = (r.affectedProjects??[]).map(ref => {
    const proj = projectsById[ref] ?? (projectsByName ?? {})[ref] ?? null;
    const name = proj?.name ?? ref;
    return `<span class="risk-tag">${esc(name)}</span>`;
  }).join('');
  const depOwner = level === 'DEP' && r.depOwner
    ? String(r.depOwner).toUpperCase()
    : null;
  const depOwnerBadge = depOwner
    ? `<div class="dep-owner-badge ${depOwner}" title="Dependency owned by: ${depOwner}">${depOwner}</div>`
    : '';
  return `
    <div class="risk-item">
      <div class="risk-badge-col">
        <div class="risk-badge ${level}">${level}</div>${depOwnerBadge}
      </div>
      <div class="risk-body">
        <div class="risk-title">${esc(r.title)}</div>
        <div class="risk-desc">${esc(r.description)}</div>
        ${affected ? `<div class="risk-tags">${affected}</div>` : ''}
      </div>
    </div>`;
}

function renderRisks(risks, projectsById) {
  const rc = $('risk-count');
  if (rc) rc.textContent = risks.length + ' ITEM' + (risks.length !== 1 ? 'S' : '');
  const severityOrder = { HIGH:1, ESC:2, MED:3, DEP:4, WATCH:5, LOW:6 };
  const sorted = [...risks].sort((a,b) =>
    (severityOrder[(a.level??'MED').toUpperCase()]??99) -
    (severityOrder[(b.level??'MED').toUpperCase()]??99));

  const projectsByName = {};
  Object.values(projectsById).forEach(p => { if (p.name) projectsByName[p.name] = p; });

  const rb = $('risks-body');
  if (rb) rb.innerHTML = sorted.map(r => buildRiskItemHtml(r, projectsById, projectsByName)).join('');
}

/* ═══════════════════════════════════════════════════════
   RENDER — MILESTONES
   Phase 1/4.4: past vs upcoming separator; count header = future only
═══════════════════════════════════════════════════════ */
function buildMilestoneItemHtml(m, isPast) {
  const pd        = parseDate(m.date);
  const tc        = milestoneTypeClass(m.type);
  const typeLabel = (isPast ? 'PASSED · ' : '') + esc(m.type ?? '').toUpperCase();
  return `
    <div class="milestone-item${isPast ? ' past' : ''}">
      <div class="milestone-date-box">
        <div class="mdate-day">${esc(pd.day)}</div>
        <div class="mdate-mon">${esc(pd.mon)}</div>
      </div>
      <div class="milestone-info">
        <div class="milestone-type ${tc}">${typeLabel}</div>
        <div class="milestone-desc">${esc(m.description)}</div>
      </div>
    </div>`;
}

function milestoneTypeClass(t) {
  const map = { 'REVIEW':'REVIEW','GO/NO-GO':'GO-NO-GO','MILESTONE':'MILESTONE',
                'APPROVAL':'APPROVAL','DECISION':'DECISION' };
  return map[(t??'').toUpperCase()] ?? 'MILESTONE';
}

function renderMilestones(milestones) {
  const today = new Date(); today.setHours(0,0,0,0);

  const parsed = milestones.map(m => ({
    m,
    dt: m.date ? new Date(m.date + 'T00:00:00') : null
  })).sort((a, b) => (a.m.date ?? '').localeCompare(b.m.date ?? ''));

  const past     = parsed.filter(x => x.dt && x.dt < today);
  const upcoming = parsed.filter(x => !x.dt || x.dt >= today);

  const mc = $('milestone-count');
  if (mc) mc.textContent = upcoming.length + ' UPCOMING';

  const upcomingHtml = upcoming.map(x => buildMilestoneItemHtml(x.m, false)).join('');
  const pastHtml     = past.map(x => buildMilestoneItemHtml(x.m, true)).join('');

  let html;
  if (upcoming.length > 0 && past.length > 0) {
    html = `<div class="milestone-separator">Upcoming</div>${upcomingHtml}`
         + `<div class="milestone-separator">Past</div>${pastHtml}`;
  } else if (upcoming.length > 0) {
    html = upcomingHtml;
  } else {
    html = `<div class="milestone-separator">Past</div>${pastHtml}`;
  }

  const mb = $('milestones-body');
  if (mb) mb.innerHTML = html;
}

/* ═══════════════════════════════════════════════════════
   RENDER — DECISIONS
   Phase 4.5: sorted by urgency — overdue first, then soonest
   Phase 1: overdue visual treatment distinct from urgent
═══════════════════════════════════════════════════════ */
function renderDecisions(decisions, projectsById) {
  projectsById = projectsById ?? {};
  // Sort: overdue (most overdue first) → urgent ≤7d → normal (soonest first) → no date last
  const sorted = [...decisions].sort((a,b) => {
    const da = a.dueDate ? daysUntil(a.dueDate) : 9999;
    const db = b.dueDate ? daysUntil(b.dueDate) : 9999;
    return da - db;
  });

  // Update action label: only show when there are decisions, urgent/overdue items get red text
  const actionLabel = $('decisions-action-label');
  if (actionLabel) {
    if (sorted.length === 0) {
      actionLabel.textContent = '';
    } else {
      const hasUrgent = sorted.some(d => {
        const days = d.dueDate ? daysUntil(d.dueDate) : null;
        return days !== null && days <= 7;
      });
      actionLabel.textContent = hasUrgent ? 'ACTION REQUIRED' : sorted.length + ' ITEM' + (sorted.length !== 1 ? 'S' : '');
      if (hasUrgent) actionLabel.classList.add('panel-meta-urgent');
      else           actionLabel.classList.remove('panel-meta-urgent');
    }
  }

  const db = $('decisions-body');
  if (db) db.innerHTML = sorted.map(d => buildDecisionItemHtml(d, projectsById)).join('');
}

function buildDecisionItemHtml(d, projectsById) {
  const days      = d.dueDate ? daysUntil(d.dueDate) : null;
  const isOverdue = days !== null && days < 0;
  const isUrgent  = days !== null && days >= 0 && days <= 7;
  const dueClass  = isOverdue ? ' overdue' : (isUrgent ? ' urgent' : '');
  const dueIcon   = isOverdue ? '⚠' : '⚡';
  const prefix    = isOverdue ? 'OVERDUE · ' : '';
  const proj      = d.projectId ? (projectsById[d.projectId] ?? null) : null;
  const projTag   = proj
    ? `<span class="decision-project">🗂 ${esc(proj.name)}</span>`
    : '';
  return `
    <div class="decision-item">
      <div class="decision-icon">${esc(d.icon??'📌')}</div>
      <div class="decision-body">
        <div class="decision-ask">${esc(d.ask)}</div>
        <div class="decision-ctx">${esc(d.context)}</div>
        <div class="decision-footer">
          <div class="decision-due${dueClass}">
            ${dueIcon} ${prefix}${esc(d.dueDateLabel??d.dueDate??'')}
          </div>${projTag}
        </div>
      </div>
    </div>`;
}

/* ═══════════════════════════════════════════════════════
   DATA VALIDATION CONSTANTS — module scope so they are
   not reallocated on every 60-second refresh cycle
═══════════════════════════════════════════════════════ */
const VALID_RAG      = ['GREEN','AMBER','RED','HOLD'];
const VALID_SCHED    = ['ON TRACK','AT RISK','DELAYED','ON HOLD'];
const VALID_PROJ_ST  = ['active','hold','complete'];
const VALID_RISK_LVL = ['HIGH','ESC','MED','DEP','WATCH','LOW'];
const VALID_MS_TYPE  = ['REVIEW','GO/NO-GO','MILESTONE','APPROVAL','DECISION'];
const VAL_DATE_RE    = /^\d{4}-\d{2}-\d{2}$/;
const isValidDate    = s => VAL_DATE_RE.test(s) && !isNaN(new Date(s+'T00:00:00').getTime());
const VALID_PHASES   = ['DISCOVER','PREPARE','EXPLORE','REALIZE','DEPLOY','RUN'];
const VALID_SUBPHASES = {
  DISCOVER: ['Solution exploration','Trial & prototyping','Value & roadmap definition'],
  PREPARE:  ['Project initiation','Team enablement','System provisioning','Scoping & planning'],
  EXPLORE:  ['Fit-to-standard workshops','Fit-gap analysis','Requirements gathering'],
  REALIZE:  ['Solution configuration','Development & extensions','Sprint cycles','Testing (SIT/UAT)','Data migration setup'],
  DEPLOY:   ['Cutover planning','Dress rehearsals','End-user training','Go-live execution'],
  RUN:      ['Hypercare support','System monitoring','Continuous improvement'],
};

/* ═══════════════════════════════════════════════════════
   DATA VALIDATION ENGINE  (Phase 3.5)
   Runs after JSON parse, before any rendering.
   Returns { errors:[], warnings:[] }
═══════════════════════════════════════════════════════ */
function validateData(data) {
  const errors=[], warnings=[];
  const issue = (type,section,item,msg,fix) =>
    (type==='error'?errors:warnings).push({type,section,item,msg,fix});

  /* META */
  const meta = data.meta ?? {};
  if (!String(meta.reportTitle??'').trim())
    issue('error','Report Header',null,'The report title is missing.',
      'Add <code>"reportTitle"</code> in the <code>"meta"</code> section.');
  if (!String(meta.period??'').trim())
    issue('warning','Report Header',null,'Reporting period is not set — the header pill will be blank.',
      'Set <code>"period"</code>, e.g. <code>"period": "May 2026 / CW20"</code>');
  if (meta.lastUpdated && isNaN(new Date(meta.lastUpdated).getTime()))
    issue('warning','Report Header',null,`"lastUpdated" value "${meta.lastUpdated}" is not a valid date.`,
      'Use ISO 8601 format: <code>"lastUpdated": "2026-05-15T09:00:00"</code>');

  /* PROJECTS */
  const projects = data.projects;
  if (!Array.isArray(projects)||projects.length===0) {
    issue('error','Projects',null,'There are no projects — the Projects section is empty.',
      'Add at least one project object to the <code>"projects"</code> array.');
  } else {
    const seenIds = {};
    projects.forEach((p,i) => {
      const label = p.name ? `"${p.name}"` : `#${i+1}`;
      const ctx   = `Project ${label}`;
      if (p.id) {
        if (seenIds[p.id]) issue('error','Projects',ctx,
          `Two projects share the ID: "${p.id}". Every project must have a unique ID.`,
          `Change one of the duplicate <code>"id"</code> values.`);
        seenIds[p.id] = true;
      } else {
        issue('error','Projects',ctx,'This project is missing a unique ID.',
          `Add an <code>"id"</code> field, e.g. <code>"id": "einvoicing"</code>`);
      }
      if (!String(p.name??'').trim())
        issue('error','Projects',`Project #${i+1}`,'This project has no name.',
          `Add a <code>"name"</code> field.`);
      if (!p.scheduleStatus)
        issue('warning','Projects',ctx,'Schedule Status is not set — pill will be blank.',
          `Add <code>"scheduleStatus"</code>. Allowed: <code>ON TRACK · AT RISK · DELAYED · ON HOLD</code>`);
      else if (!VALID_SCHED.includes(String(p.scheduleStatus).toUpperCase()))
        issue('error','Projects',ctx,`Schedule Status has unrecognised value: "${p.scheduleStatus}".`,
          `Use one of: <code>ON TRACK · AT RISK · DELAYED · ON HOLD</code>`);
      if (p.projectStatus && !VALID_PROJ_ST.includes(String(p.projectStatus).toLowerCase()))
        issue('warning','Projects',ctx,`projectStatus has unrecognised value: "${p.projectStatus}".`,
          `Use one of: <code>active · hold · complete</code>`);
      if (!p.rag?.overall)
        issue('error','Projects',ctx,'Overall RAG is missing — scorecard and global health indicator will be wrong.',
          `Add <code>"overall"</code> inside <code>"rag"</code>. Values: <code>GREEN · AMBER · RED · HOLD</code>`);
      else if (!VALID_RAG.includes(String(p.rag.overall).toUpperCase()))
        issue('error','Projects',ctx,`Overall RAG has unrecognised value: "${p.rag.overall}".`,
          `Use: <code>GREEN · AMBER · RED · HOLD</code>`);
      ['schedule','budget','scope','quality'].forEach(k => {
        const v=p.rag?.[k];
        if (!v) issue('warning','Projects',ctx,`${k.charAt(0).toUpperCase()+k.slice(1)} RAG dot is missing — will default to Amber.`,
          `Add <code>"${k}"</code> inside <code>"rag"</code>. Values: <code>GREEN · AMBER · RED · HOLD</code>`);
        else if (!VALID_RAG.includes(String(v).toUpperCase()))
          issue('error','Projects',ctx,`${k} RAG has unrecognised value: "${v}".`,
            `Use: <code>GREEN · AMBER · RED · HOLD</code>`);
      });
      if (p.deepDiveUrl && !/^https?:\/\//i.test(String(p.deepDiveUrl).trim()))
        issue('warning','Projects',ctx,`M365 link doesn't look like a valid URL.`,
          `Make sure <code>"deepDiveUrl"</code> starts with <code>https://</code>`);

      // Phase validation
      if (!p.phase)
        issue('error','Projects',ctx,'Phase is missing.',
          `Add <code>"phase"</code>. Allowed: <code>DISCOVER · PREPARE · EXPLORE · REALIZE · DEPLOY · RUN</code>`);
      else if (!VALID_PHASES.includes(String(p.phase).toUpperCase()))
        issue('error','Projects',ctx,`Phase has unrecognised value: "${p.phase}".`,
          `Use one of: <code>DISCOVER · PREPARE · EXPLORE · REALIZE · DEPLOY · RUN</code>`);

      // Sub-phase validation
      if (!p.subPhase) {
        issue('warning','Projects',ctx,'Sub-phase is not set — only the phase will be shown.',
          `Add <code>"subPhase"</code> matching the allowed values for the project's phase.`);
      } else {
        const phaseKey = String(p.phase??'').toUpperCase();
        const allowed  = VALID_SUBPHASES[phaseKey] ?? [];
        if (allowed.length > 0 && !allowed.includes(p.subPhase))
          issue('error','Projects',ctx,`Sub-phase "${p.subPhase}" is not valid for phase "${p.phase}".`,
            `Allowed sub-phases for ${phaseKey}: <code>${allowed.join(' · ')}</code>`);
      }
    });
  }

  /* RISKS */
  const projectIdSet   = new Set((data.projects??[]).map(p=>p.id).filter(Boolean));
  const projectNameSet = new Set((data.projects??[]).map(p=>p.name).filter(Boolean));
  (data.risks??[]).forEach((r,i) => {
    const ctx = r.title ? `"${r.title}"` : `Risk #${i+1}`;
    if (!String(r.title??'').trim())
      issue('error','Risks & Dependencies',`Risk #${i+1}`,'This risk has no title.',
        'Add a <code>"title"</code> field.');
    if (!r.level)
      issue('error','Risks & Dependencies',ctx,'Severity level is missing.',
        `Add <code>"level"</code>. Values: <code>HIGH · ESC · MED · DEP · WATCH · LOW</code>`);
    else if (!VALID_RISK_LVL.includes(String(r.level).toUpperCase()))
      issue('error','Risks & Dependencies',ctx,`Severity has unrecognised value: "${r.level}".`,
        `Use: <code>HIGH · ESC · MED · DEP · WATCH · LOW</code>`);
    // depOwner validation — only meaningful when level is DEP
    if (r.depOwner) {
      const dov = String(r.depOwner).toUpperCase();
      if (!['BUSINESS','IT'].includes(dov))
        issue('error','Risks & Dependencies',ctx,
          `depOwner has unrecognised value: "${r.depOwner}". Must be BUSINESS or IT.`,
          `Set <code>"depOwner"</code> to <code>"BUSINESS"</code> or <code>"IT"</code>, or remove it entirely.`);
      if (String(r.level??'').toUpperCase() !== 'DEP')
        issue('warning','Risks & Dependencies',ctx,
          `depOwner is set but this risk's level is not DEP — the owner badge will not be shown.`,
          `Either change the level to <code>DEP</code> or remove the <code>depOwner</code> field.`);
    }
    if (!String(r.description??'').trim())
      issue('warning','Risks & Dependencies',ctx,'No description — only the title will show.',
        'Add a <code>"description"</code> field.');
    // Warn if affectedProjects uses names instead of ids — names break silently on rename
    (r.affectedProjects??[]).forEach(ref => {
      if (ref && !projectIdSet.has(ref)) {
        if (projectNameSet.has(ref)) {
          issue('warning','Risks & Dependencies',ctx,
            `affectedProjects uses project name "${ref}" instead of its id. If the project is renamed, this link will break silently.`,
            `Replace "${ref}" with the project's <code>id</code> value. Project ids: <code>${[...projectIdSet].join(' · ')}</code>`);
        } else {
          issue('error','Risks & Dependencies',ctx,
            `affectedProjects entry "${ref}" does not match any project id or name.`,
            `Use a project id: <code>${[...projectIdSet].join(' · ')}</code>`);
        }
      }
    });
  });

  /* MILESTONES */
  (data.milestones??[]).forEach((m,i) => {
    const ctx = m.description ? `"${m.description.slice(0,40)}"` : `Milestone #${i+1}`;
    if (!m.date)
      issue('error','Milestones',ctx,'No date — this milestone cannot appear on the timeline.',
        `Add <code>"date"</code> in YYYY-MM-DD format.`);
    else if (!isValidDate(m.date))
      issue('error','Milestones',ctx,`Date "${m.date}" is invalid or wrongly formatted.`,
        `Use YYYY-MM-DD format, e.g. <code>"date": "2026-06-15"</code>`);
    if (!m.type)
      issue('warning','Milestones',ctx,'No type — will show as a generic MILESTONE badge.',
        `Add <code>"type"</code>. Values: <code>MILESTONE · REVIEW · GO/NO-GO · APPROVAL · DECISION</code>`);
    else if (!VALID_MS_TYPE.includes(String(m.type).toUpperCase()))
      issue('error','Milestones',ctx,`Type has unrecognised value: "${m.type}".`,
        `Use: <code>MILESTONE · REVIEW · GO/NO-GO · APPROVAL · DECISION</code>`);
    if (!String(m.description??'').trim())
      issue('warning','Milestones',ctx,'No description — timeline entry will be blank.',
        'Add a <code>"description"</code> field.');
  });

  /* DECISIONS */
  const projectIds = [...projectIdSet];
  (data.decisions??[]).forEach((d,i) => {
    const ctx = d.ask ? `"${d.ask.slice(0,40)}"` : `Ask #${i+1}`;
    if (!String(d.ask??'').trim())
      issue('error','Executive Asks',`Ask #${i+1}`,'This executive ask has no title.',
        'Add an <code>"ask"</code> field.');
    if (!String(d.context??'').trim())
      issue('warning','Executive Asks',ctx,'No context — only the title will show.',
        'Add a <code>"context"</code> field.');
    if (d.dueDate && !isValidDate(d.dueDate))
      issue('error','Executive Asks',ctx,`Due date "${d.dueDate}" is invalid — urgency indicator won't work.`,
        `Use YYYY-MM-DD format, e.g. <code>"dueDate": "2026-06-15"</code>`);
    if (!d.projectId)
      issue('warning','Executive Asks',ctx,'No project linked — this ask will not show a project tag.',
        `Add <code>"projectId"</code> with one of the project IDs: <code>${projectIds.join(' · ')}</code>`);
    else if (!projectIds.includes(d.projectId))
      issue('error','Executive Asks',ctx,`projectId "${d.projectId}" does not match any project.`,
        `Use one of: <code>${projectIds.join(' · ')}</code>`);
  });

  return { errors, warnings };
}

/* ═══════════════════════════════════════════════════════
   VALIDATION SCREEN RENDERER
═══════════════════════════════════════════════════════ */
function showValidationScreen(errors, warnings, proceedCallback) {
  const hasErrors = errors.length > 0;
  const all       = [...errors, ...warnings];
  const sections  = {};
  all.forEach(i => { if(!sections[i.section]) sections[i.section]=[]; sections[i.section].push(i); });

  const issueCard = i => `
    <div class="val-issue ${i.type}">
      <div class="val-issue-icon">${i.type==='error'?'✕':'⚠'}</div>
      <div class="val-issue-body">
        <div class="val-issue-meta">
          <span class="val-issue-section">${esc(i.section)}</span>
          ${i.item?`<span class="val-issue-item">${esc(i.item)}</span>`:''}
        </div>
        <div class="val-issue-msg">${esc(i.msg)}</div>
        <div class="val-issue-fix">💡 <strong>How to fix:</strong> ${i.fix}</div>
      </div>
    </div>`;

  const sectionBlocks = Object.entries(sections).map(([sec,issues])=>`
    <div>
      <div class="val-section-heading">${sec} — ${issues.length} issue${issues.length!==1?'s':''}</div>
      <div class="val-issue-list">${issues.map(issueCard).join('')}</div>
    </div>`).join('');

  const chips = [
    errors.length   ? `<span class="val-chip errors">${errors.length} Error${errors.length!==1?'s':''}</span>` : '',
    warnings.length ? `<span class="val-chip warnings">${warnings.length} Warning${warnings.length!==1?'s':''}</span>` : '',
  ].join('');

  const intro = hasErrors
    ? `The dashboard <strong>cannot load</strong> until the errors below are fixed. Open <code>data/ctb_data.json</code> in any text editor, apply the fixes, save, then refresh this page (<strong>F5</strong>).`
    : `The dashboard can still load, but some information may be incomplete. Review the warnings when you have a moment. Open <code>data/ctb_data.json</code>, apply fixes, save, then refresh (<strong>F5</strong>).`;

  $('val-wrap').innerHTML = `
    <div class="val-header">
      <div class="val-title ${hasErrors?'has-errors':'has-warnings-only'}">
        ${hasErrors?`⚠ ${errors.length} error${errors.length!==1?'s':''} need fixing before the dashboard can load`
                   :`⚠ Dashboard loaded with ${warnings.length} warning${warnings.length!==1?'s':''}`}
      </div>
      <div class="val-chips">${chips}</div>
    </div>
    <div class="val-intro">${intro}</div>
    ${sectionBlocks}
    <div class="val-actions">
      ${!hasErrors?`<button class="val-btn primary" id="val-load-anyway">Load Dashboard Anyway →</button>`:''}
      <button class="val-btn secondary" id="val-reload">↺ Reload After Fixing</button>
      <span class="val-note">${hasErrors?'All errors must be fixed before the dashboard will display.':'Warnings do not prevent the dashboard from loading. Errors do.'}</span>
    </div>`;

  $('load-screen').classList.add('is-hidden');
  $('validation-screen').classList.remove('is-hidden');
  $('validation-screen').classList.add('is-shown-block');

  const btn = $('val-load-anyway');
  if (btn) btn.addEventListener('click', () => {
    $('validation-screen').classList.add('is-hidden');
    proceedCallback();
    updateRefreshIndicator(true, null);
  });
  const reloadBtn = $('val-reload');
  if (reloadBtn) reloadBtn.addEventListener('click', () => location.reload());
}

/* ═══════════════════════════════════════════════════════
   HELP PANEL — generated at render time from _instructions block
   Single source of truth: edit allowed values only in ctb_data.json
═══════════════════════════════════════════════════════ */
function renderHelpPanel(inst) {
  const panel = $('help-panel');
  if (!panel) return;
  if (!inst) { panel.innerHTML = ''; return; }

  const escH = esc;
  const subPhaseText = (inst.subPhaseValues ?? '').replace(/\. /g, '.\n');

  panel.innerHTML = `
    <h3>📋 How to Update This Dashboard</h3>
    <div class="help-grid">

      <div class="help-block">
        <h4>Quick Start</h4>
        <ul>
          <li>Open <code>public/ctb_editor.html</code> in a browser for a guided form-based editor</li>
          <li>Or open <code>data/ctb_data.json</code> directly in any text editor and edit values — do NOT change key names</li>
          <li>Save, then refresh the dashboard (F5)</li>
          <li>Double-click <code>Launcher.bat</code> to serve locally (requires Python 3)</li>
          <li>Never touch <code>public/dashboard.html</code></li>
          <li>Full docs: <code>docs/README.md</code></li>
        </ul>
      </div>

      <div class="help-block">
        <h4>Allowed Values</h4>
        <ul>
          <li><strong>RAG</strong>: ${escH(inst.ragValues ?? 'GREEN | AMBER | RED | HOLD')}</li>
          <li><strong>scheduleStatus</strong>: ${escH(inst.scheduleStatusValues ?? 'ON TRACK | AT RISK | DELAYED | ON HOLD')}</li>
          <li><strong>Phase</strong>: ${escH(inst.phaseValues ?? 'DISCOVER | PREPARE | EXPLORE | REALIZE | DEPLOY | RUN')}</li>
          <li><strong>Risk level</strong>: ${escH(inst.riskLevelValues ?? 'HIGH | MED | LOW | DEP | ESC | WATCH')}</li>
          <li><strong>Milestone type</strong>: ${escH(inst.milestoneTypeValues ?? 'REVIEW | GO/NO-GO | MILESTONE | APPROVAL | DECISION')}</li>
          <li><strong>decision projectId</strong>: ${escH(inst.decisionProjectId ?? 'Must match an existing project id')}</li>
        </ul>
        ${inst.ragOverallVsScheduleStatus ? `
        <p style="font-size:11px;color:var(--text-secondary);margin-top:8px;">${escH(inst.ragOverallVsScheduleStatus)}</p>` : ''}
        ${inst.projectStatusNote ? `
        <p style="font-size:11px;color:var(--text-secondary);margin-top:8px;">${escH(inst.projectStatusNote)}</p>` : ''}
      </div>

      <div class="help-block">
        <h4>Sub-Phases by Phase</h4>
        <p style="font-size:11px;color:var(--text-secondary);white-space:pre-wrap;">${escH(subPhaseText)}</p>
      </div>

      <div class="help-block">
        <h4>Adding a New Project</h4>
        <p>Append a new object to the <code>projects</code> array:</p>
        <pre>${escH(`{
  "id": "myproject",
  "name": "My New Project",
  "phase": "EXPLORE",
  "subPhase": "Fit-gap analysis",
  "scheduleVariance": "+2d",
  "scheduleStatus": "AT RISK",
  "rag": {
    "schedule": "AMBER",
    "budget":   "GREEN",
    "scope":    "GREEN",
    "quality":  "GREEN",
    "overall":  "AMBER"
  },
  "nextMilestone": "UAT — 1 Jul 2026",
  "comment": "Short status note.",
  "deepDiveLabel": "M365"
}`)}</pre>
      </div>

      <div class="help-block">
        <h4>Adding a Risk</h4>
        <p>Append to the <code>risks</code> array:</p>
        <pre>${escH(`{
  "level": "DEP",
  "depOwner": "BUSINESS",
  "title": "Risk short title",
  "description": "Full description.",
  "affectedProjects": ["project-id"]
}`)}</pre>
        <p style="font-size:11px;color:var(--text-secondary);margin-top:6px;">Use project <code>id</code> (not name) in <code>affectedProjects</code>.</p>
      </div>

      <div class="help-block">
        <h4>Adding a Milestone</h4>
        <pre>${escH(`{
  "date": "2026-07-01",
  "type": "MILESTONE",
  "description": "Description."
}`)}</pre>
      </div>

      <div class="help-block">
        <h4>Adding an Executive Ask</h4>
        <pre>${escH(`{
  "icon": "🔐",
  "ask": "Short action headline",
  "context": "Why this matters.",
  "projectId": "einvoicing",
  "dueDate": "2026-06-15",
  "dueDateLabel": "Due 15 Jun 2026"
}`)}</pre>
      </div>

    </div>
    ${inst.IMPORTANT ? `
    <div class="help-block" style="margin-top:14px;padding:10px 14px;background:var(--gold-muted);border:1px solid var(--gold-border);border-radius:var(--radius-sm);">
      <p style="font-size:11px;color:var(--gold-500);line-height:1.6;">💡 <strong>Important:</strong> ${escH(inst.IMPORTANT)}</p>
    </div>` : ''}`;
}

/* ═══════════════════════════════════════════════════════
   RENDER ALL  (called from loadDashboard and "Load Anyway")
═══════════════════════════════════════════════════════ */
function renderAll(data) {
  const projects = data.projects ?? [];

  // Phase 3.1 — build id-keyed lookup for risk affectedProjects resolution
  const projectsById = {};
  projects.forEach(p => { if (p.id) projectsById[p.id] = p; });

  const pulse = {
    ...computePulse(projects),
    keyFlag: data.pulse?.keyFlag ?? null
  };

  renderHelpPanel(data._instructions ?? null);
  renderMeta(data.meta ?? {});
  renderPulse(pulse);
  renderScorecard(projects);
  renderMatrix(projects);
  renderRisks(data.risks ?? [], projectsById);
  renderMilestones(data.milestones ?? []);
  renderDecisions(data.decisions ?? [], projectsById);

  const ls = $('load-screen');
  if (ls) { ls.classList.add('is-hidden'); ls.classList.remove('is-shown-block'); }
  const vs = $('validation-screen');
  if (vs) { vs.classList.add('is-hidden'); vs.classList.remove('is-shown-block'); }
  const as = $('app-shell');
  if (as) { as.classList.remove('is-hidden'); as.classList.add('is-shown-block'); }
  initFilter();
  requestAnimationFrame(updateScrollFooters);
}

/* ═══════════════════════════════════════════════════════
   REFRESH INDICATOR  (Phase 4.2 + Phase 5.1 auto-refresh)
═══════════════════════════════════════════════════════ */
function updateRefreshIndicator(ok, lastUpdated) {
  const dot   = $('refresh-dot');
  const label = $('refresh-label');
  if (!dot || !label) return;
  if (ok) {
    dot.className = 'refresh-dot';
    // Show "DATA AS OF" the meta.lastUpdated date if available, otherwise load time
    if (lastUpdated) {
      try {
        const d = new Date(lastUpdated);
        if (!isNaN(d.getTime())) {
          label.textContent = 'DATA AS OF ' + d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
          return;
        }
      } catch {}
    }
    label.textContent = 'LOADED · ' + fmtRefreshTime();
  } else {
    dot.className   = 'refresh-dot stale';
    label.textContent = 'SERVER UNREACHABLE · reload to retry';
  }
}

/* ═══════════════════════════════════════════════════════
   BOOTSTRAP  (Phase 5 — port check + auto-refresh)
═══════════════════════════════════════════════════════ */
async function loadDashboard() {
  try {
    const resp = await fetch('data/ctb_data.json', { cache:'no-cache' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status} — ${resp.statusText}`);
    const data = await resp.json();

    const { errors, warnings } = validateData(data);

    if (errors.length > 0) {
      showValidationScreen(errors, warnings, () => renderAll(data));
      return;
    }

    // Warnings alone do not block rendering — load the dashboard directly
    renderAll(data);
    updateRefreshIndicator(true, data.meta?.lastUpdated);
    _lastFingerprint = data.meta?.lastUpdated ?? null;

  } catch(err) {
    $('load-screen').classList.add('is-hidden');
    $('error-screen').classList.remove('is-hidden');
    $('error-screen').classList.add('is-shown-block');
    $('error-detail').textContent   = 'Error detail: ' + err.message;
  }
}

/* Show panel scroll footers only when the scrollable content actually overflows */
function updateScrollFooters() {
  // For each scrollable panel, find its sibling footer and toggle visibility
  ['matrix-scroll','risk-scroll'].forEach(id => {
    const el = $(id);
    if (!el) return;
    const footer = el.closest('.panel')?.querySelector('.panel-scroll-footer');
    if (footer) footer.classList.toggle('is-hidden', !(el.scrollHeight > el.clientHeight + 2));
  });
  // milestones and decisions panels
  document.querySelectorAll('.milestones-scroll, .decisions-scroll').forEach(el => {
    const footer = el.closest('.panel')?.querySelector('.panel-scroll-footer');
    if (footer) footer.classList.toggle('is-hidden', !(el.scrollHeight > el.clientHeight + 2));
  });
}


function captureScrollPositions() {
  const ids = ['matrix-scroll','risk-scroll'];
  const state = {};
  ids.forEach(id => {
    const el = $(id);
    if (el) state[id] = { top: el.scrollTop, left: el.scrollLeft };
  });
  return state;
}

/* Restore previously captured scroll positions after a re-render */
function restoreScrollPositions(state) {
  Object.entries(state).forEach(([id, pos]) => {
    const el = $(id);
    if (el) { el.scrollTop = pos.top; el.scrollLeft = pos.left; }
  });
}

/* Module-level fingerprint — avoids polluting window and is cheaper than JSON.stringify.
   data.meta.lastUpdated is the natural change signal: the editor always bumps it on save. */
let _lastFingerprint = null;
async function silentRefresh() {
  // Only silently refresh when the app shell is visible (not on validation or error screens)
  if ($('app-shell').style.display === 'none') return;
  try {
    const resp = await fetch('data/ctb_data.json', { cache:'no-cache' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    const { errors } = validateData(data);
    if (errors.length === 0) {
      const fingerprint = data.meta?.lastUpdated ?? null;
      // Skip full re-render if lastUpdated timestamp is unchanged
      if (fingerprint === _lastFingerprint) {
        updateRefreshIndicator(true, data.meta?.lastUpdated);
        return;
      }
      _lastFingerprint = fingerprint;
      // Preserve help panel open state and scroll positions across the re-render
      const helpOpen     = $('help-panel').classList.contains('open');
      const scrollState  = captureScrollPositions();
      resetFilter();
      renderAll(data);
      restoreScrollPositions(scrollState);
      // Always restore correct button text and ARIA regardless of panel state
      if (helpOpen) {
        $('help-panel').classList.add('open');
        $('help-toggle').textContent = '✕';
        $('help-toggle').setAttribute('aria-expanded', 'true');
      } else {
        $('help-toggle').textContent = '?';
        $('help-toggle').setAttribute('aria-expanded', 'false');
      }
      updateRefreshIndicator(true, data.meta?.lastUpdated);
    } else {
      updateRefreshIndicator(false);
    }
  } catch {
    updateRefreshIndicator(false);
  }
}

/* ═══════════════════════════════════════════════════════
   THEME TOGGLE  — dark (default) ↔ light
═══════════════════════════════════════════════════════ */
(function initTheme() {
  // Rehydrate last preference from localStorage so re-opens remember choice
  const saved = localStorage.getItem('ctb-theme');
  if (saved === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();

function applyThemeState() {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  const icon = $('theme-icon');
  if (icon) icon.textContent = isLight ? '🌙' : '☀';
}

/* ═══════════════════════════════════════════════════════
   FONT-SIZE CONTROL  — zoom-based, 7 steps, session-persistent
═══════════════════════════════════════════════════════ */
const ZOOM_STEPS = [0.82, 0.88, 0.94, 1.0, 1.07, 1.14, 1.22];
const ZOOM_DEFAULT = 3;
let zoomIdx = ZOOM_DEFAULT;

/* Detect zoom support once at startup.
   'zoom' in html.style is true in Chrome/Edge/Safari and Firefox 126+.
   Older Firefox ignores zoom on the root element entirely — use transform there.
   We must pick ONE path: applying both causes double-scaling in zoom-capable browsers. */
const _supportsZoom = 'zoom' in document.documentElement.style;

function setHtmlScale(factor) {
  const html = document.documentElement;
  if (_supportsZoom) {
    /* Chrome / Edge / Safari / Firefox 126+ — zoom adjusts layout AND visuals cleanly */
    html.style.zoom            = factor;
    html.style.transform       = '';
    html.style.transformOrigin = '';
    html.style.width           = '';
  } else {
    /* Older Firefox — transform-only path with width compensation to prevent overflow */
    html.style.zoom            = '';
    html.style.transform       = factor !== 1 ? `scale(${factor})` : '';
    html.style.transformOrigin = 'top left';
    html.style.width           = factor !== 1 ? `${100 / factor}%` : '';
  }
}

(function restoreZoom() {
  const saved = parseInt(localStorage.getItem('ctb-zoom') ?? ZOOM_DEFAULT, 10);
  if (!isNaN(saved) && saved >= 0 && saved < ZOOM_STEPS.length) zoomIdx = saved;
  setHtmlScale(ZOOM_STEPS[zoomIdx]);
})();

function applyZoom() {
  setHtmlScale(ZOOM_STEPS[zoomIdx]);
  localStorage.setItem('ctb-zoom', zoomIdx);
  const dec = $('font-decrease');
  const inc = $('font-increase');
  if (dec) dec.disabled = zoomIdx === 0;
  if (inc) inc.disabled = zoomIdx === ZOOM_STEPS.length - 1;
}

function toggleTheme() {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  if (isLight) {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('ctb-theme', 'dark');
  } else {
    document.documentElement.setAttribute('data-theme', 'light');
    localStorage.setItem('ctb-theme', 'light');
  }
  applyThemeState();
}

/* ═══════════════════════════════════════════════════════
   INSTANT FILTER  — search text + RAG chip
═══════════════════════════════════════════════════════ */
const filterState = { text: '', rag: 'ALL' };

function applyFilter() {
  const text = filterState.text.toLowerCase().trim();
  const rag  = filterState.rag;

  // ── Matrix rows ──
  const rows = document.querySelectorAll('#matrix-body tr[data-name]');
  let visible = 0;
  rows.forEach(row => {
    const textMatch = !text ||
      (row.dataset.name    ?? '').toLowerCase().includes(text) ||
      (row.dataset.comment ?? '').toLowerCase().includes(text) ||
      (row.dataset.phase   ?? '').toLowerCase().includes(text);
    const ragMatch  = rag === 'ALL' || (row.dataset.rag ?? '') === rag;
    const show = textMatch && ragMatch;
    row.classList.toggle('is-hidden', !show);
    if (show) visible++;
  });

  // ── Scorecard cards ──
  document.querySelectorAll('.sc-card[data-name]').forEach(card => {
    const textMatch = !text ||
      (card.dataset.name  ?? '').toLowerCase().includes(text) ||
      (card.dataset.phase ?? '').toLowerCase().includes(text);
    const ragMatch  = rag === 'ALL' || (card.dataset.rag ?? '') === rag;
    card.classList.toggle('is-hidden', !(textMatch && ragMatch));
  });

  // ── Result count + no-results message ──
  const countEl    = $('filter-result-count');
  const noResultEl = $('matrix-no-results');
  const isFiltered = text || rag !== 'ALL';

  if (countEl) {
    if (isFiltered && rows.length > 0) {
      countEl.textContent = `${visible} of ${rows.length} shown`;
    } else {
      countEl.textContent = '';
    }
  }
  if (noResultEl) {
    noResultEl.classList.toggle('is-hidden', !(isFiltered && visible === 0));
  }

  // ── Scroll footer visibility update ──
  requestAnimationFrame(updateScrollFooters);
}

let _filterInitialized = false;
let _filterDebounce = null;

function initFilter() {
  const bar = $('filter-bar');
  if (!bar || _filterInitialized) return;
  _filterInitialized = true;
  // Use event delegation — register once, survives re-renders
  bar.addEventListener('input', e => {
    const input = e.target.closest('#filter-search');
    if (!input) return;
    filterState.text = input.value;
    const clearBtn = $('filter-clear');
    if (clearBtn) clearBtn.classList.toggle('visible', filterState.text.length > 0);
    clearTimeout(_filterDebounce);
    _filterDebounce = setTimeout(applyFilter, 150);
  });
  bar.addEventListener('click', e => {
    const chip = e.target.closest('.filter-chip');
    if (chip) {
      bar.querySelectorAll('.filter-chip').forEach(c => {
        c.classList.remove('active');
        c.setAttribute('aria-pressed', 'false');
      });
      chip.classList.add('active');
      chip.setAttribute('aria-pressed', 'true');
      filterState.rag = chip.dataset.rag;
      applyFilter();
      return;
    }
    const clearBtn = e.target.closest('#filter-clear');
    if (clearBtn) {
      const input = $('filter-search');
      if (input) {
        input.value = '';
        filterState.text = '';
        clearBtn.classList.remove('visible');
        input.focus();
        applyFilter();
      }
    }
  });
}

/* Reset filter state when data re-renders (silent refresh) */
function resetFilter() {
  filterState.text = '';
  filterState.rag  = 'ALL';
  const searchInput = $('filter-search');
  const clearBtn    = $('filter-clear');
  if (searchInput) searchInput.value = '';
  if (clearBtn)    clearBtn.classList.remove('visible');
  document.querySelectorAll('.filter-chip').forEach((c, i) => {
    c.classList.toggle('active', i === 0);
    c.setAttribute('aria-pressed', i === 0 ? 'true' : 'false');
  });
}

document.addEventListener('DOMContentLoaded', () => {
  try {
    /* Apply correct icon/label for whichever theme was rehydrated from session */
    applyThemeState();

    /* Theme toggle */
    const themeToggleBtn = $('theme-toggle');
    if (themeToggleBtn) themeToggleBtn.addEventListener('click', toggleTheme);

    /* Export / Print button */
    const exportBtn = $('export-btn');
    if (exportBtn) exportBtn.addEventListener('click', () => window.print());

    /* ── Print fix: strip JS-injected zoom/transform BEFORE the print engine
       measures layout, then restore them AFTER the print dialog closes.
       Without this, html.style.zoom and html.style.transform (set by
       setHtmlScale) override the @media print rules and break the layout. ── */
    window.addEventListener('beforeprint', () => {
      const html = document.documentElement;
      html.style.zoom            = '';
      html.style.transform       = '';
      html.style.transformOrigin = '';
      html.style.width           = '';
    });
    window.addEventListener('afterprint', () => {
      applyZoom(); // restore whatever zoom the user had selected
    });

    /* Font-size controls */
    applyZoom(); // sync disabled states on load
    const fontDec = $('font-decrease');
    const fontInc = $('font-increase');
    if (fontDec) fontDec.addEventListener('click', () => { if (zoomIdx > 0) { zoomIdx--; applyZoom(); } });
    if (fontInc) fontInc.addEventListener('click', () => { if (zoomIdx < ZOOM_STEPS.length - 1) { zoomIdx++; applyZoom(); } });

    /* ARIA on help toggle */
    const helpToggle = $('help-toggle');
    const helpPanel  = $('help-panel');
    helpToggle.addEventListener('click', () => {
      const isOpen = helpPanel.classList.toggle('open');
      helpToggle.textContent    = isOpen ? '✕' : '?';
      helpToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    /* Escape key closes help panel */
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && helpPanel.classList.contains('open')) {
        helpPanel.classList.remove('open');
        helpToggle.textContent = '?';
        helpToggle.setAttribute('aria-expanded', 'false');
        helpToggle.focus();
      }
    });

    /* Slash key focuses filter search */
    document.addEventListener('keydown', e => {
      if ((e.key === '/' || (e.key === 'f' && (e.ctrlKey || e.metaKey))) &&
          !['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
        e.preventDefault();
        const fs = $('filter-search');
        if (fs) fs.focus();
      }
    });

    /* Click outside help panel to close */
    document.addEventListener('click', e => {
      if (helpPanel.classList.contains('open') &&
          !helpPanel.contains(e.target) &&
          e.target !== helpToggle) {
        helpPanel.classList.remove('open');
        helpToggle.textContent = '?';
        helpToggle.setAttribute('aria-expanded', 'false');
      }
    });

    loadDashboard();

    /* Auto-check every 5 minutes — only re-renders when data has actually changed */
    setInterval(silentRefresh, 300000);
  } catch(err) {
    // Bootstrap failure — show error screen so user is not left with a silent white page
    const es = $('error-screen');
    if (es) { es.style.display = 'block'; }
    const ed = $('error-detail');
    if (ed) ed.textContent = 'Bootstrap error: ' + err.message;
    const ls = $('load-screen');
    if (ls) ls.style.display = 'none';
  }
});
