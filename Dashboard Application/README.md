# Dashboard Application Suite

**Maintained by:** IT Portfolio Management Office  
**Confidentiality:** Internal – Restricted  
**Last Updated:** June 2026

---

## Overview

The Dashboard Application Suite is a collection of three **zero-infrastructure, browser-based reporting tools** used to communicate IT portfolio health to leadership. All three applications share the same design philosophy: static HTML/CSS/JS shells that never change, driven entirely by JSON data files that are updated on a routine cadence.

None of the applications require a database, cloud subscription, Node.js, or a deployment pipeline. They run locally on any managed workstation with Python 3 and a modern browser.

---

## The Three Applications

| # | Application | Cadence | Audience | Domain |
|---|---|---|---|---|
| 1 | **Change the Business (CTB)** | Weekly | IT Leadership / Workstream Teams | RAG portfolio status for active change programmes |
| 2 | **Monthly Governance (OpsReview)** | Monthly | Operations Managers / Service Owners / IT Leadership | Service management metrics: incidents, SRs, RFACs, problems |
| 3 | **Run the Business (RTB)** | Weekly | IT Portfolio Managers / IT Leadership | ServiceNow weekly KPIs, SLA breach tracking, intervention log |

---

## Repository Structure

```
Dashboard Application/
├── Launcher.bat                          ← Root launcher — unified entry point for all three apps
│
├── Change the Business/                  ← CTB Portfolio Dashboard (v1.1)
│   ├── public/
│   │   ├── dashboard.html                ← Dashboard renderer (never edit)
│   │   ├── ctb_editor.html               ← GUI editor for ctb_data.json
│   │   ├── css/dashboard.css
│   │   ├── js/
│   │   │   ├── dashboard.js
│   │   │   └── utils.js                  ← Shared utilities (esc, safeUrl, daysUntil)
│   │   └── data/
│   │       ├── ctb_data.json             ★ Weekly edit target — all portfolio data
│   │       └── ctb_data.schema.json      ← JSON Schema for VS Code validation
│   ├── portable/                         ← Auto-generated portable builds
│   ├── scripts/
│   │   ├── Launcher.bat
│   │   └── launcher.sh
│   └── docs/
│       ├── README.md
│       ├── DATA_GOVERNANCE.md
│       ├── EXECUTIVE_CHEATSHEET.html
│       ├── RELEASE_NOTES.md
│       ├── SECURITY_POLICY.md
│       └── SUPPORT_ESCALATION.md
│
├── Monthly Governance/                   ← OpsReview Dashboard (v2.0)
│   ├── public/
│   │   ├── dashboard.html                ← Dashboard renderer (never edit)
│   │   ├── editor.html                   ← GUI editor / XLSX importer
│   │   ├── css/
│   │   │   ├── ops_dashboard.css
│   │   │   ├── fonts.css
│   │   │   └── fonts/                    ← DM Sans & DM Mono woff2 (bundled offline)
│   │   ├── js/
│   │   │   ├── ops_dashboard.js
│   │   │   ├── ops_editor.js
│   │   │   ├── chart.umd.js              ← Chart.js (bundled offline)
│   │   │   └── xlsx.full.min.js          ← SheetJS (bundled offline)
│   │   └── data/
│   │       ├── ops_data.json             ★ Monthly edit target — all ops metrics
│   │       ├── dashboard_config.json     ← UI labels, tab definitions, column headers
│   │       └── opsreview_config.json     ← Thresholds, module list, state/priority maps
│   ├── schema/ops_data_schema.json
│   ├── Sampledata/                       ← Reference XLSX templates for SNOW exports
│   ├── scripts/
│   │   ├── Launcher.bat
│   │   ├── launcher.sh
│   │   └── validate_data.js
│   └── Docs/
│       ├── README.md
│       ├── data_governance.md
│       ├── executive_cheat_sheet.html
│       ├── release_notes.md
│       ├── security_policy.md
│       └── support_escalation.md
│
└── Run the Business/                     ← ServiceNow Weekly Dashboard (v3.1)
    ├── public/
    │   ├── snow_dashboard.html           ← Dashboard renderer (never edit)
    │   ├── snow_editor.html              ← GUI editor / XLSX importer
    │   ├── css/
    │   │   ├── snow_dashboard.css
    │   │   ├── fonts.css
    │   │   └── fonts/                    ← DM Sans & DM Mono woff2 (bundled offline)
    │   ├── js/
    │   │   ├── snow_dashboard.js
    │   │   └── chart.umd.js              ← Chart.js (bundled offline)
    │   └── data/
    │       ├── snow_weekly.json          ★ Weekly edit target — KPIs, charts, commentary
    │       ├── snow_config.json          ← Thresholds, field maps, display metadata
    │       └── snow_weekly.schema.json
    ├── portable/                         ← Auto-generated portable builds
    ├── Sampledata/                       ← Reference XLSX templates for SNOW exports
    ├── scripts/
    │   ├── Launcher.bat
    │   └── Launcher.sh
    └── docs/
        ├── README.md
        ├── DATA_GOVERNANCE.md
        ├── EXECUTIVE_CHEATSHEET.html
        ├── RELEASE_NOTES.md
        ├── SECURITY_POLICY.md
        └── SUPPORT_ESCALATION.md
```

---

## Quick Start

### Prerequisites

| Requirement | Minimum | Check |
|---|---|---|
| Python | 3.6+ | `python --version` |
| Browser | Chrome 90+ / Edge 90+ / Firefox 88+ / Safari 15+ | — |
| PowerShell (Windows, for portable builds) | 5.1+ | `$PSVersionTable.PSVersion` |

### Launching an Application (Windows — Recommended)

1. Double-click **`Launcher.bat`** in the `Dashboard Application/` root folder.
2. Select the application you want (`1`, `2`, or `3`).
3. The selected app's sub-menu opens, offering:
   - **Launch Dashboard** — starts the Python HTTP server and opens the browser
   - **Build Portable** — compiles a single self-contained HTML file for distribution
   - **Open Editor** — opens the GUI editor for data entry without touching JSON
4. To stop the server, press **Ctrl+C** in the terminal window.

### Launching an Application (Mac / Linux)

```bash
# From the application's own subfolder, e.g. Change the Business:
chmod +x scripts/launcher.sh
./scripts/launcher.sh
```

### Why a Local HTTP Server?

The dashboards load their data files via `fetch()`, which browsers block on the `file://` protocol. You must serve the files over HTTP (`http://localhost:PORT/…`) for the dashboards to function. All three launchers handle this automatically.

---

## Design Principles Shared Across All Three Apps

**Template stability.** The HTML renderer files (`dashboard.html`, `snow_dashboard.html`) are permanent, zero-edit assets. All weekly or monthly updates flow exclusively through the JSON data files. This ensures reproducible output and prevents accidental breakage of the rendered layout.

**Dual-mode deployment.** Every application supports two operating modes:

- **Live mode** — Served by a local Python HTTP server. Auto-refreshes on a timer (every 5 minutes for CTB and RTB). Suitable for live reviews and in-room presentation.
- **Portable mode** — A single self-contained HTML file with all CSS, fonts (base64-embedded), JavaScript, and data inlined. No server required. Distributable by email or Teams. Produced by the Launcher's build option.

**Offline-first.** All external dependencies (Chart.js, SheetJS, DM Sans / DM Mono fonts) are bundled within each application. No CDN calls are made in portable mode. The CTB dashboard additionally uses a system font stack, making it fully air-gap compatible even in live mode.

**Non-technical editing.** Each application ships a companion browser-based GUI editor that reads configuration and validation rules from the JSON config file. Data Stewards can update all content through the editor without ever touching raw JSON or a text editor.

**XSS mitigation.** All user-authored JSON content is sanitised before DOM insertion using `esc()` for plain text fields and a bespoke allowlist tokeniser (`trust()`) for fields that intentionally include limited formatting HTML. No unsanitised string is ever passed to `innerHTML`.

**Content Security Policy.** Each application declares a `<meta>` CSP header restricting `script-src`, `style-src`, `font-src`, and `connect-src` to `'self'` in live mode. The CSP is patched to permit `'unsafe-inline'` only in portable builds (where all scripts and styles are inlined by necessity).

---

## Application Summaries

### 1 — Change the Business (CTB)

The CTB Portfolio Dashboard provides a single-screen RAG status matrix for the Change-the-Business programme. It tracks all active change the business initiatives (major and minor projects) — across five health dimensions: Schedule, Budget, Scope, Quality, and Overall Health.

Key capabilities: RAG heat map, milestone tracker, risk register, decision log, open-action pulse, GPIC gate approval status, RC Manager assignments, and SAP Activate phase indicators. A built-in data validator checks `ctb_data.json` for structural errors on every load and displays actionable fix instructions before rendering.

Accessibility controls (dark/light theme toggle, 7-step font size adjustment, print/PDF export) are available from the masthead.

For full documentation see [`Change the Business/docs/README.md`](Change%20the%20Business/docs/README.md).

---

### 2 — Monthly Governance (OpsReview)

OpsReview is a multi-tab monthly governance dashboard covering SAP and Non-ERP application portfolios. It ingests four ServiceNow XLSX exports (Incidents, Service Requests, RFACs, Problems) via its built-in editor, calculates KPIs per module, and renders a seven-tab interactive review.

Tabs cover: ticket volumes and SLA compliance, MTTR and quality metrics, RFaC and Problem Record aging, active project scorecards with RAG status, CI initiatives, headcount/FTE utilisation, action items, and leadership escalations.

The editor auto-generates XLSX column-header templates for each ticket type and supports drag-and-drop config upload for real-time validation rule updates.

For full documentation see [`Monthly Governance/Docs/README.md`](Monthly%20Governance/Docs/README.md).

---

### 3 — Run the Business (RTB)

The ServiceNow Weekly IT Operations Dashboard produces an executive-grade weekly operations brief from a single JSON data file. It renders KPI scorecard tiles, week-on-week comparison charts, an intervention escalation tracker, and a free-text commentary section.

Configuration is split across two files: `snow_weekly.json` (updated weekly by the Data Steward) and `snow_config.json` (updated quarterly or on ServiceNow field changes). The editor reads `snow_config.json` for validation and supports CSV/Excel import from ServiceNow exports with configurable column mappings.

For full documentation see [`Run the Business/docs/README.md`](Run%20the%20Business/docs/README.md).

---

## Data Steward Update Workflow

| Application | Cadence | Primary Edit Target | Tool |
|---|---|---|---|
| CTB | Weekly (Friday cut-off) | `Change the Business/public/data/ctb_data.json` | `ctb_editor.html` or VS Code |
| OpsReview | Monthly (period close) | `Monthly Governance/public/data/ops_data.json` | `editor.html` + XLSX import |
| RTB | Weekly | `Run the Business/public/data/snow_weekly.json` | `snow_editor.html` + XLSX import |

After updating the relevant data file, use the Launcher's **Build Portable** option to generate the distribution file for the current calendar week, then share via Teams or email.

---

## Security & Distribution

All three applications are classified **Internal – Restricted**. Distribution of portable HTML files or screenshots outside approved channels requires sign-off from the IT Portfolio Management Office. Refer to the `SECURITY_POLICY.md` document within each application's `docs/` folder for full data classification rules and permitted distribution channels.

---

## Documentation Index

Each application maintains its own documentation suite in its `docs/` folder:

| Document | Purpose |
|---|---|
| `README.md` | Full technical reference — architecture, file roles, field reference, FAQs |
| `DATA_GOVERNANCE.md` | Update cadence, archiving strategy, concurrent editing protocol |
| `EXECUTIVE_CHEATSHEET.html` | One-page visual guide to reading the dashboard — share with executive recipients |
| `RELEASE_NOTES.md` | Delivered capabilities, known constraints, indicative roadmap |
| `SECURITY_POLICY.md` | Data classification, permitted distribution channels, incident reporting |
| `SUPPORT_ESCALATION.md` | Incident response scenarios, self-service diagnostics, escalation contacts |
