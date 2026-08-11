# OpsReview Dashboard — Release Notes

> **Document Type:** Release History & Change Log
> **Classification:** Internal – Restricted
> **Maintained by:** TCS Operations Team

---

## How to Read This Document

Each release entry covers one version of the OpsReview system. Entries are listed newest-first. Sub-sections use the following labels:

- **New** — net-new features or capabilities.
- **Improved** — enhancements to existing functionality.
- **Fixed** — bug fixes.
- **Breaking** — changes that require action from administrators or data preparers.
- **Config** — changes to configuration file structure that may require updates to `opsreview_config.json` or `dashboard_config.json`.
- **Security** — security-relevant changes.

---

## Release: Dashboard v4.0 / Editor v2.0

**Release Date:** 2026-06-01
**Reporting Period:** May 2026 (CW22)
**Schema Version:** 1

### Summary

This is a major release consolidating the dashboard rendering engine and the editor into a stable, config-driven architecture. All user-visible strings are now sourced from `dashboard_config.json` — no hard-coded labels remain in the JavaScript. The editor has been rewritten as a seven-step guided workflow with undo support and inline pre-flight validation.

---

### Dashboard (v4.0)

#### New

- **Config-driven rendering.** Every label, tab name, chart title, table header, and column key is now read from `dashboard_config.json`. The dashboard JavaScript contains no hard-coded display strings. Update labels without touching code.
- **Seven-tab navigation.** Tabs are defined in `dashboard_config.json → tabs[]`. Adding or reordering tabs requires only a config change.
- **Per-module SLA threshold override.** Individual modules can declare a `slaThreshold` object in `ops_data.json` to override the global RAG thresholds for SLA metrics. Accommodates modules with different contractual SLA levels.
- **Pulse / Key Flag banner.** A prominent, coloured banner at the top of the dashboard renders the `pulse.keyFlag` string from `ops_data.json`. Use it to call out the period's most important headline.
- **RFaC and PRB aging sections** per module in the SAP and Non-SAP module detail panels.
- **Portable build support.** The launcher's build script (PowerShell/.sh) inlines all assets — CSS, JS, fonts (Base64-encoded WOFF2), and data — into a single portable `.html` file. Portable builds detect the embedded data via `window.__OPS_DATA__` and skip all `fetch()` calls.
- **Auto-refresh in server mode.** The dashboard polls for data changes every 5 minutes and re-renders automatically when `ops_data.json` changes. The current scroll position is preserved across refreshes.
- **Dark / Light theme toggle** with `localStorage` persistence.
- **Font-size controls** (A– / A+) with `localStorage` persistence.
- **Print support.** Print-optimised CSS ensures tables and charts lay out cleanly when printing or saving to PDF.
- **Keyboard and screen-reader accessibility.** All tabs have `role="tab"` and `aria-selected` attributes. A skip-link is provided for keyboard users. Colour-coded values always include numeric readouts.

#### Improved

- RAG threshold evaluation is centralised in `getThresholdColor()`. Adding new threshold types requires only a new key in `ragThresholds` and a corresponding call.
- Chart instances are tracked in `chartInstances{}` and destroyed before re-creation on tab switch, preventing canvas memory leaks.
- The `deepMerge()` utility ensures chart option overrides compose cleanly without clobbering default axis or tooltip settings.

#### Security

- All data-derived strings pass through `esc()` before `innerHTML` assignment.
- The `trust()` allowlist function restricts rich-text fields to `<strong>`, `<em>`, `<b>`, `<i>`, `<br>` only. Attributes and `javascript:` URIs are stripped.
- CSP meta tag added to both `dashboard.html` and `editor.html`.
- Cache-Control headers (`no-store, no-cache, must-revalidate`) added to both HTML files to prevent stale data in the browser cache.

---

### Editor (v2.0)

#### New

- **Seven-step guided workflow** with a persistent sidebar navigation: Welcome → Configuration → Import Data → KPI Preview → Meta & Pulse → Manual Data → Export JSON.
- **XLSX batch import.** Drag-and-drop or file-picker upload for four ServiceNow XLSX exports (INC, SR, RFaC, PRB). Badge counters in the top bar show parsed record counts after import.
- **Calculation engine.** Computes per-module KPIs: totals, INC/SR splits, resolved count, net flow, SLA compliance, MTTR, reopen rate, first-fix rate, breach/near-miss counts, escalation rate, priority distribution, age distribution, RFaC/PRB aging, and 6-month MoM trend arrays.
- **KPI Preview tab.** Tabular view of all calculated metrics per module with RAG colour coding. Supports manual overrides per field.
- **Load Previous JSON.** Imports a prior period's `ops_data.json` to carry forward historical trend arrays and manual sections.
- **Manual data sections** with add/remove/edit support for: Action Items, Escalations, Appreciations, Service Offers, Projects, Continuous Improvement.
- **Undo support (Ctrl+Z)** for manual data entry.
- **Pre-flight validation panel** in the Export tab. Runs all structural checks and displays a pass/fail list before allowing download.
- **Config Lock toggle.** Prevents accidental changes to configuration parameters during data entry.
- **Download Config / Upload Config** buttons. Save and restore `opsreview_config.json` without leaving the editor.
- **Copy JSON to clipboard** button on the export preview panel.
- **Drop zones** for XLSX file import with visual feedback.

#### Config

- `opsreview_config.json` must now include `priorityBuckets`, `ageBuckets`, and `ticketTypePrefixes` arrays for the calculation engine to function correctly. See `opsreview_config.json` reference in the README for field definitions.
- The `mappings` object keys must be exact assignment group names as they appear in ServiceNow XLSX exports (case-sensitive).

---

### Launcher

#### New

- **Windows Launcher (`Launcher.bat`)** — menu-driven script with four options: Open Editor, Launch Dashboard, Build Portable, Build then Launch.
- **Unix Launcher (`launcher.sh`)** — equivalent bash script for macOS and Linux.
- **Port scanning** — automatically finds a free port in the 8080–8120 range.
- **Embedded build engine** — the PowerShell build script is embedded in the `.bat` file (after the `::PS1_START` marker) and runs without a separate `.ps1` file. The bash build engine is embedded in `launcher.sh`.

---

### Schema

- `schemaVersion: 1` is now required in `ops_data.json`. Documents without it will trigger a warning in the editor and dashboard.
- `pulse` object added at root level: `{ keyFlag: string, generatedAt: datetime }`.
- `modules[].slaThreshold` added as optional per-module override object.
- `config` sub-object added to support portable mode threshold embedding.

---

## Future Roadmap (Planned)

The following items are under consideration for future releases. They are not committed and may change:

- **Multi-period comparison view** — a new tab or overlay showing the current period alongside the previous period side-by-side for each KPI.
- **CSV export from dashboard** — download the quality metrics table or module summary as a `.csv` file directly from the dashboard.
- **Configurable lookback window** — allow the lookback from 6 months to be configurable per deployment without a code change (currently set in `opsreview_config.json → general.lookbackMonths` but not yet fully wired to all chart builders).
- **Editor redo support** — Ctrl+Y / Ctrl+Shift+Z redo stack to complement the existing undo.
- **Dark-mode portable builds** — allow the portable build to inherit the current theme preference at build time.
- **Schema version 2** — planned to add multi-domain support (more than two domains), configurable module groupings, and richer project milestone tracking.

---

## Known Issues — Current Release

| Issue | Severity | Workaround |
|---|---|---|
| Portable build on Safari may show unstyled content briefly on first load | Low | Wait 1–2 seconds; fonts render once Base64 decoding completes |
| MoM trend arrays of length < 6 show empty chart segments | Low | Pad arrays with `0` values for months with no data |
| `launcher.sh` bash build engine may garble font data URIs on macOS if `base64` produces line breaks | Medium | Use `base64 -w 0` (GNU) or `base64 -b 0` (macOS); the script uses `tr -d '\n'` to strip them |
| Very large XLSX files (> 50,000 rows) may cause the editor tab to become unresponsive for 10–30 seconds during import | Low | Pre-filter exports in ServiceNow to the relevant period and assignment groups before exporting |

---

## Versioning Policy

- **Dashboard version** (`vX.Y`) — major version increments on architecture changes or breaking schema updates; minor version on feature additions.
- **Editor version** (`vX.Y`) — versioned independently; aligned to the dashboard schema it targets.
- **Schema version** — integer, increments only on breaking changes to `ops_data.json` structure that require a migration.
- **Configuration files** — not versioned independently; changes are documented in these release notes.

---

## How to Upgrade

When a new version of `ops_dashboard.js`, `ops_editor.js`, or the HTML files is released:

1. Back up your current `public/` directory.
2. Replace the updated files in `public/js/` and/or `public/*.html`.
3. **Do not replace** `public/data/ops_data.json`, `public/data/dashboard_config.json`, or `public/data/opsreview_config.json` unless the release notes specify a breaking schema change.
4. If a schema version increment is noted, run the migration steps described in the release notes for that version before loading your existing `ops_data.json` in the new editor.
5. Rebuild any portable dashboards you have in distribution using the new launcher.
