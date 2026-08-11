/**
 * ops_data.json validation script.
 * Usage: node scripts/validate_data.js [path/to/ops_data.json]
 * Requires: node (no npm dependencies — basic structural validation only)
 */
const fs = require('fs');
const path = require('path');

const dataPath = process.argv[2] || path.join(__dirname, '..', 'public', 'data', 'ops_data.json');

let exitCode = 0;

function check(condition, msg) {
  if (!condition) {
    console.error('  FAIL: ' + msg);
    exitCode = 1;
  } else {
    console.log('  PASS: ' + msg);
  }
}

try {
  console.log('Validating: ' + dataPath + '\n');
  const raw = fs.readFileSync(dataPath, 'utf-8');
  let data;
  try { data = JSON.parse(raw); } catch (e) { console.error('  FAIL: Invalid JSON — ' + e.message); process.exit(1); }

  // Schema version
  check(data.schemaVersion === 1, 'schemaVersion is 1');
  check(typeof data.meta === 'object' && data.meta !== null, 'meta object exists');
  check(typeof data.meta.title === 'string' && data.meta.title.length > 0, 'meta.title is non-empty string');
  check(typeof data.meta.period === 'string' && data.meta.period.length > 0, 'meta.period is non-empty string');
  check(typeof data.meta.reportDate === 'string', 'meta.reportDate exists');

  // Global
  check(typeof data.global === 'object' && data.global !== null, 'global object exists');
  check(typeof data.global.domains === 'object', 'global.domains exists');

  // Months
  check(Array.isArray(data.months) && data.months.length >= 1, 'months is non-empty array');
  check(Array.isArray(data.monthsFull) && data.monthsFull.length === data.months.length, 'monthsFull matches months length');

  // Modules
  check(Array.isArray(data.modules) && data.modules.length > 0, 'modules is non-empty array');
  const validDomains = ['SAP', 'NonERP'];
  const moduleIds = {};
  data.modules.forEach(function(m, i) {
    check(typeof m.id === 'string' && m.id.length > 0, 'modules[' + i + '].id is non-empty string');
    check(typeof m.name === 'string', 'modules[' + i + '].name exists');
    check(validDomains.indexOf(m.domain) !== -1, 'modules[' + i + '].domain (' + m.id + ') is SAP or NonERP');
    check(!moduleIds[m.id], 'modules[' + i + '].id "' + m.id + '" is unique');
    moduleIds[m.id] = true;
    check(typeof m.total === 'number', 'modules[' + i + '].total (' + m.id + ') is number');
    if (m.mom) check(Array.isArray(m.mom) && m.mom.length === data.months.length, 'modules[' + i + '].mom (' + m.id + ') length matches months');
    if (m.respSlaMom) check(Array.isArray(m.respSlaMom) && m.respSlaMom.length === data.months.length, 'modules[' + i + '].respSlaMom length matches months');
    if (m.resolSlaMom) check(Array.isArray(m.resolSlaMom) && m.resolSlaMom.length === data.months.length, 'modules[' + i + '].resolSlaMom length matches months');
    if (m.priorityMeta) check(Array.isArray(m.priorityMeta), 'modules[' + i + '].priorityMeta is array');
    if (m.ageMeta) check(Array.isArray(m.ageMeta), 'modules[' + i + '].ageMeta is array');
  });

  // RFAC
  if (data.rfac) {
    check(typeof data.rfac === 'object', 'rfac exists');
    Object.keys(data.rfac).forEach(function(k) {
      var r = data.rfac[k];
      check(typeof r.openCount === 'number', 'rfac.' + k + '.openCount is number');
      check(typeof r.under8wPct === 'number', 'rfac.' + k + '.under8wPct is number');
      check(typeof r.under12wPct === 'number', 'rfac.' + k + '.under12wPct is number');
    });
  }

  // PRB
  if (data.prb) {
    check(typeof data.prb === 'object', 'prb exists');
    Object.keys(data.prb).forEach(function(k) {
      var p = data.prb[k];
      check(typeof p.openCount === 'number', 'prb.' + k + '.openCount is number');
    });
  }

  // Manual sections (if present, validate shape)
  if (data.actionItems) {
    check(Array.isArray(data.actionItems), 'actionItems is array');
    data.actionItems.forEach(function(ai, i) {
      check(ai.action && ai.owner && ai.dueDate && ai.status, 'actionItems[' + i + '] has required fields');
    });
  }
  if (data.escalations) {
    check(Array.isArray(data.escalations), 'escalations is array');
    data.escalations.forEach(function(e, i) {
      check(e.issue && e.responsible && e.dueDate && e.status, 'escalations[' + i + '] has required fields');
    });
  }
  if (data.projects) {
    check(Array.isArray(data.projects), 'projects is array');
    data.projects.forEach(function(p, i) {
      check(p.name && p.ragOverall && p.status, 'projects[' + i + '] has required fields (name, ragOverall, status)');
    });
  }
  if (data.headcount) {
    check(typeof data.headcount.sapAMS === 'number', 'headcount.sapAMS is number');
    check(typeof data.headcount.nsAMS === 'number', 'headcount.nsAMS is number');
  }

  console.log('\n' + (exitCode === 0 ? 'All checks passed.' : 'Some checks failed.'));
  process.exit(exitCode);

} catch (e) {
  console.error('Validation error: ' + e.message);
  process.exit(1);
}
