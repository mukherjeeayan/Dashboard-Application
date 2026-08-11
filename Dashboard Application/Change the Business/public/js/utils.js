/* ═══════════════════════════════════════════════════════
   SHARED UTILITIES — used by CTB and RTB dashboards
   Single source of truth: edit here, not in individual JS files.
═══════════════════════════════════════════════════════ */

/* Sanitise text — escapes all 5 HTML special chars incl. " and ' */
function esc(s) {
  return String(s ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

/* Allow only http:// and https:// — blocks javascript:, data:, vbscript:, and bare paths */
function safeUrl(url) {
  const s = String(url ?? '').trim();
  return /^https?:\/\//i.test(s) ? s : '#';
}

/* Days between today (midnight) and an ISO date string */
function daysUntil(iso) {
  const now = new Date(); now.setHours(0,0,0,0);
  const due = new Date(iso + 'T00:00:00');
  return Math.ceil((due - now) / 86400000);
}
