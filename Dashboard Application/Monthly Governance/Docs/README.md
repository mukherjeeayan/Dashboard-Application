# OpsReview Dashboard — README

> **Version:** 2.0 (Dashboard v4.0 / Editor v2.0)
> **Confidentiality:** Internal – Restricted
> **Maintained by:** TCS Operations Team

---

## Table of Contents

1. [What Is OpsReview?](#1-what-is-opsreview)
2. [System Architecture](#2-system-architecture)
3. [Project File Structure](#3-project-file-structure)
4. [Prerequisites](#4-prerequisites)
5. [Quick Start](#5-quick-start)
6. [Two Operating Modes](#6-two-operating-modes)
7. [The Editor — Step-by-Step Workflow](#7-the-editor--step-by-step-workflow)
8. [The Dashboard — Tabs & Panels](#8-the-dashboard--tabs--panels)
9. [Configuration Files Explained](#9-configuration-files-explained)
10. [Data Files Explained](#10-data-files-explained)
11. [Building a Portable Dashboard](#11-building-a-portable-dashboard)
12. [Auto-Refresh Behaviour](#12-auto-refresh-behaviour)
13. [Theme & Accessibility](#13-theme--accessibility)
14. [Frequently Asked Questions](#14-frequently-asked-questions)

---

## 1. What Is OpsReview?

OpsReview is a **monthly governance dashboard** designed for IT operations teams managing SAP and Non-ERP application portfolios. It provides a single-pane view of:

- Ticket volume, incident vs. service-request split, SLA compliance, and trend data across up to 20 application modules.
- Quality metrics: Mean Time to Resolve (MTTR), reopen rates, first-fix rates, SLA near-misses, and breach counts.
- Change management health: Request for Change (RFaC) aging and Problem Record (PRB) aging.
- Action items, leadership escalations, appreciations, and service offers.
- Active project scorecards with RAG status and continuous improvement (CI) initiatives.
- Headcount and FTE capacity utilisation.

The application consists of two browser-based HTML tools that require **no server installation**, **no Node.js runtime**, and **no internet connection** once deployed:

| Tool | File | Purpose |
|---|---|---|
| **Editor** | `public/editor.html` | Data preparation — ingests ServiceNow XLSX exports and produces `ops_data.json` |
| **Dashboard** | `public/dashboard.html` | Presentation — reads `ops_data.json` and renders the interactive review |

---

## 2. System Architecture

```
ServiceNow XLSX Exports
        │
        ▼
  [ Editor (editor.html) ]
  • Reads 4 XLSX files (INC, SR, RFaC, PRB)
  • Calculates KPIs per module
  • Accepts manual data (actions, projects, CI…)
  • Validates and exports ops_data.json
        │
        ▼
  public/data/ops_data.json   ◄──── single source of truth
        │
        ▼
  [ Dashboard (dashboard.html) ]
  • Reads ops_data.json + dashboard_config.json + opsreview_config.json
  • Renders 7 interactive tabs with charts and tables
  • Can be packaged as a single portable .html file
```

All rendering is done client-side in the browser. No backend, no database, no API calls leave the machine.

---

## 3. Project File Structure

```
project-root/
├── public/                        ← files served to the browser
│   ├── dashboard.html             ← the dashboard viewer
│   ├── editor.html                ← the data-preparation editor
│   ├── css/
│   │   ├── fonts.css              ← @font-face declarations for DM Sans & DM Mono
│   │   ├── ops_dashboard.css      ← all visual styling (dark/light theme)
│   │   └── fonts/
│   │       ├── DM_Sans.woff2
│   │       ├── DM_Mono_400.woff2
│   │       └── DM_Mono_500.woff2
│   ├── js/
│   │   ├── ops_dashboard.js       ← dashboard runtime (v4.0)
│   │   ├── ops_editor.js          ← editor runtime (v2.0)
│   │   ├── chart.umd.js           ← Chart.js (bundled, offline)
│   │   └── xlsx.full.min.js       ← SheetJS (bundled, offline)
│   └── data/
│       ├── ops_data.json          ← *** primary data file (updated each period) ***
│       ├── dashboard_config.json  ← UI labels, tab definitions, column headers
│       └── opsreview_config.json  ← thresholds, module list, state/priority maps
│
├── scripts/
│   ├── Launcher.bat               ← Windows launcher (server + portable build)
│   ├── launcher.sh                ← Unix/macOS launcher
│   └── validate_data.js           ← Node.js JSON validation script
│
├── portable/                      ← auto-generated single-file builds
│   └── OpsReview_Dashboard_Portable_<YYYY-CWnn>.html
│
├── ops_data_schema.json           ← JSON Schema (draft-07) for ops_data.json
└── package.json
```

---

## 4. Prerequisites

| Requirement | Notes |
|---|---|
| **Modern browser** | Chrome 90+, Edge 90+, Firefox 88+, Safari 15+ |
| **Python 3** | Required only to run the live server (the dashboard and editor do not need it) |
| **No Node.js needed** | The editor and dashboard run entirely in the browser |
| **Node.js (optional)** | Only needed to run `node scripts/validate_data.js` |

The Editor (`editor.html`) can be opened as a local file directly — no server required. The Dashboard (`dashboard.html`) **must** be served from a local HTTP server or opened as a portable build, because browsers block `fetch()` calls to the local filesystem from `file://` URLs.

---

## 5. Quick Start

### Windows

1. Double-click `scripts/Launcher.bat`.
2. Choose `1` to open the Editor, or `2` to launch the Dashboard in your browser.
3. To create a portable single-file dashboard, choose `3` or `4` (build + launch).

### macOS / Linux

```bash
chmod +x scripts/launcher.sh
./scripts/launcher.sh
```

Then choose from the same menu options.

### Manual (any OS)

```bash
# Serve the public directory on port 8080
python -m http.server 8080 -d public

# Open in browser
http://localhost:8080/dashboard.html
http://localhost:8080/editor.html
```

---

## 6. Two Operating Modes

### Server Mode (Live Dashboard)

The launcher starts a Python HTTP server on the first available port between 8080 and 8120. The browser opens `dashboard.html` automatically. In this mode:

- The dashboard polls for changes to `ops_data.json` every **5 minutes** and re-renders automatically if the file has changed.
- All three data files (`ops_data.json`, `dashboard_config.json`, `opsreview_config.json`) are fetched fresh on every reload.

### Portable Mode (Self-Contained HTML)

The build script inlines all CSS, JavaScript, fonts (as Base64-encoded WOFF2), and JSON data directly into a single `.html` file placed in the `portable/` directory. This file:

- Opens in any browser with no server, no internet, no external files.
- Is named `OpsReview_Dashboard_Portable_YYYY-CWnn.html` (calendar-week stamped).
- Does **not** auto-refresh (data is baked in at build time).
- Is safe to email or archive.

---

## 7. The Editor — Step-by-Step Workflow

Open `public/editor.html` directly in your browser (no server needed).

### Step 1 — Configure Parameters

Review and adjust the configuration that drives calculations:

- **RAG Thresholds** — define Green/Amber/Red cut-offs for SLA %, MTTR, reopen rate, first-fix rate, and FTE load.
- **SLA Targets** — response SLA target % and resolution SLA target %.
- **State Mappings** — which ServiceNow states count as "Resolved", "Open", or "Closed".
- **Priority Mappings** — how text priorities (e.g. "1 — Critical") map to numeric values 1–4.
- **FTE Defaults** — default headcount for SAP AMS, SAP Projects, Non-ERP AMS, Non-ERP Projects pools.
- **Module Definitions & Assignment Mappings** — which ServiceNow assignment group maps to which module ID.

You can download the current config as `opsreview_config.json` and upload a saved config from a previous period. Use **Config Lock** to prevent accidental changes during data entry.

### Step 2 — (Optional) Load Previous JSON

If you want to carry forward manual data from last month (action items, projects, CI initiatives), use the **Load Previous JSON** button in the top bar. The editor will pre-populate all manual sections from that file, which you can then edit.

### Step 3 — Import XLSX Data

Upload the four ServiceNow data exports. Drag-and-drop or click to browse:

| File Slot | Contents |
|---|---|
| **Incidents (INC)** | All incident tickets for the report period |
| **Service Requests (SR)** | All service-request tickets for the report period |
| **RFaC (Changes)** | All Request for Change records |
| **Problems (PRB)** | All Problem Records |

The XLSX files must contain at minimum: ticket number, assignment group, state, priority, created date, resolved date, and SLA compliance fields. Column names are matched by the editor's parsing logic against the field mappings in `opsreview_config.json`.

After uploading, click **Calculate Operations Metrics**. The engine will:

- Assign each ticket to a module based on its assignment group.
- Calculate totals, INC/SR splits, resolved counts, net flow, SLA compliance, MTTR, reopen rate, first-fix rate, breach counts, near-miss counts, and escalation rates.
- Build 6-month month-over-month (MoM) trend arrays for each metric.
- Compute priority and age distribution percentages.
- Aggregate RFaC and PRB aging metrics per module.

### Step 4 — KPI Preview

Review the calculated KPIs in a table. Each module row shows all key metrics with colour coding using the configured RAG thresholds. You can apply manual overrides here for any individual metric that needs correction.

### Step 5 — Meta & Pulse

Fill in the report header fields:

- **Title** — dashboard title (e.g. "Operations Review")
- **Period** — reporting period label (e.g. "May 2026 (CW22)")
- **Portfolio Owner** — team or person name
- **Confidentiality** — label shown in the dashboard header
- **Report Date** — ISO date of the report
- **Pulse Flag** — a brief highlight sentence displayed prominently at the top of the dashboard (e.g. "SAP CRM SLA improved 4pp this month")
- **Headcount** — FTE counts for SAP AMS, SAP Projects, Non-ERP AMS, Non-ERP Projects

### Step 6 — Manual Data

Enter or update the sections that cannot be derived from XLSX data:

- **Action Items** — owner, due date, status, next steps for each open action.
- **Escalations** — leadership escalation issues requiring intervention.
- **Appreciations / Kudos** — positive feedback received per module.
- **Service Offers / CCRs** — commercial change requests in flight.
- **Projects** — active project scorecards with RAG, status phase, and narrative.
- **Continuous Improvement** — automation or process initiatives with effort saved and lead.

All manual sections support undo (Ctrl+Z).

### Step 7 — Export JSON

The export panel runs a pre-flight validation check covering:

- Schema version presence.
- Non-empty required fields (title, period, report date).
- Module array integrity.
- MoM array lengths matching the months array.
- Action item and escalation field completeness.

If all checks pass, click **Save JSON & Download** to download `ops_data.json`. Copy this file to `public/data/ops_data.json` to update the live dashboard.

---

## 8. The Dashboard — Tabs & Panels

The dashboard has **seven tabs** accessible from the top navigation bar.

### Overview Tab

- Four headline KPI cards: SAP Total Volume, SAP SLA Composite, Non-ERP Total Volume, Non-ERP SLA Composite. Each card shows the current value and the month-over-month delta with an up/down indicator.
- **6-Month Volume Trend** chart — line chart comparing SAP and Non-ERP ticket volumes over the lookback window.
- **Open Backlog Growth Trend** chart — shows how the open backlog has changed month over month across both domains.

### SAP Modules Tab

Sub-tabs for each SAP module (CRM, SCM, Auth OEKG, Auth OSTE, FICO OEKG, FICO OSTE, SuccessFactors, Integration, MDG, BODS/BOIS, BW, Cognos/Qlik). Selecting a module shows:

- KPI strip: Received vs Baseline, INC/SR split, Resolved & Net Flow, Response SLA %, Resolution SLA %, MTTR.
- Month-over-month volume trend chart (6 months, with baseline overlay).
- Priority distribution donut chart.
- Age distribution donut chart.
- SLA compliance meters (response and resolution).
- RFaC aging table.
- PRB aging table.
- Operational notes.

### Non-SAP Modules Tab

Identical layout to SAP Modules, but for Non-ERP modules: ACE, CPQ, Democenter, Corp Sol, HR, IAM, M365, SerNow.

### Quality & MTTR Tab

- **MTTR Comparison** bar chart — all modules side by side, coloured by RAG threshold.
- **Reopen Rate Comparison** bar chart — all modules side by side.
- Quality integrity table: per-module Reopen Rate, First-Fix Rate, SLA Near-Misses, SLA Breaches, and MTTR — all colour-coded.

### Action Items Tab

- Active Action Log table — all open and in-progress action items.
- Leadership Escalations table — escalation issues with responsible leads and target dates.
- Appreciations & Kudos section.
- Service Offers & CCRs section.

### Projects & CI Tab

- Active project scorecards — each project shows its RAG overall, track, planned go-live, current status phase, and a narrative update.
- Continuous Improvement table — track, initiative, status, effort saved, planned deploy date, and lead.

### Headcount Tab

- FTE summary cards for SAP AMS, SAP Projects, Non-ERP AMS, Non-ERP Projects.
- Tickets per FTE bar chart — coloured green/amber/red against the configured FTE load thresholds.

---

## 9. Configuration Files Explained

### `opsreview_config.json`

Controls the **calculation engine** in the editor and the **RAG threshold colours** in the dashboard.

| Section | Purpose |
|---|---|
| `general` | Report title, period, portfolio owner, lookback months |
| `ragThresholds` | Green/amber cut-offs for SLA, MTTR, reopen rate, first-fix rate, FTE load |
| `thresholds` | SLA targets, age warning days, RFaC/PRB aging targets |
| `stateMappings` | Which ServiceNow states are "resolved", "open", or "closed" |
| `priorityMappings` | Text-to-numeric priority translation |
| `validValues` | Allowed values for state fields (used by editor validation) |
| `fteDefaults` | Default FTE pool sizes |
| `modules` | Module list with id, name, domain |
| `mappings` | Assignment group → module ID mapping |
| `baselines` | Monthly baseline ticket count per module |
| `priorityBuckets` / `ageBuckets` | How to group priorities and ages in charts |
| `ticketTypePrefixes` | Prefix patterns to identify INC vs SR tickets |

### `dashboard_config.json`

Controls all **UI text, tab definitions, and chart configurations**. The dashboard renders no hard-coded strings — everything visible comes from this file. Edit it to relabel tabs, change column headers, or add/remove overview cards without touching JavaScript.

### `ops_data.json`

The **primary data payload** updated each reporting period by the Editor. Contains all calculated KPIs, trend arrays, and manually entered narrative content. Full schema is documented in `ops_data_schema.json`.

---

## 10. Data Files Explained

### `ops_data.json` — Key Sections

| Section | Description |
|---|---|
| `schemaVersion` | Must be `1`. Used for future migration support. |
| `meta` | Report title, period, owner, confidentiality, dates |
| `pulse` | Optional key-flag highlight sentence |
| `global` | Aggregate totals and SLA composites for SAP and NonERP domains |
| `months` | Short labels for the 6-month lookback window (e.g. `["Dec", "Jan", …]`) |
| `monthsFull` | ISO year-month strings (e.g. `["2025-12", "2026-01", …]`) |
| `modules[]` | Array of per-module KPI objects (see schema for all fields) |
| `rfac{}` | RFaC aging data keyed by module ID |
| `prb{}` | PRB aging data keyed by module ID |
| `actionItems[]` | Action log entries |
| `escalations[]` | Leadership escalation entries |
| `appreciations[]` | Kudos/appreciation entries |
| `serviceOffers[]` | CCR/service offer entries |
| `projects[]` | Project scorecard entries |
| `continuousImprovement[]` | CI initiative entries |
| `headcount` | FTE counts for the four pools |

### MoM Trend Array Convention

All `*Mom` arrays (e.g. `mom`, `incMom`, `backlogMom`, `respSlaMom`) contain **6 elements**, oldest-first, most-recent-last. To update for a new month:

1. Remove the first (oldest) element.
2. Append the new month's value at the end.

Example: `[6, 8, 7, 9, 11, 10]` → new month is 12 → `[8, 7, 9, 11, 10, 12]`.

---

## 11. Building a Portable Dashboard

From `scripts/Launcher.bat` (or `launcher.sh`), choose option **3** (Build) or **4** (Build then Launch).

The build process:

1. Reads `public/dashboard.html`.
2. Inlines `ops_data.json`, `dashboard_config.json`, and `opsreview_config.json` as `window.__OPS_DATA__`, `window.__OPS_CONFIG__`, and `window.__OPS_OVERRIDE__` globals.
3. Inlines `ops_dashboard.css` as a `<style>` block.
4. Reads all `.woff2` font files, Base64-encodes them, and replaces the file references in `fonts.css` with data URIs.
5. Inlines `chart.umd.js` and `ops_dashboard.js` as `<script>` blocks.
6. Writes the result to `portable/OpsReview_Dashboard_Portable_YYYY-CWnn.html`.

The output file is fully self-contained and typically 1–3 MB depending on chart library size.

---

## 12. Auto-Refresh Behaviour

When running in server mode, the dashboard checks for data changes every **5 minutes** (300,000 ms). It computes a lightweight hash of the three JSON files and re-renders only if the hash has changed. This means you can update `ops_data.json` mid-session and the dashboard will pick up the changes automatically without a manual browser refresh.

Portable builds do not auto-refresh — data is static.

---

## 13. Theme & Accessibility

- **Dark / Light toggle** — click the moon/sun icon in the dashboard toolbar. Preference is persisted to `localStorage`.
- **Font size** — use the A– / A+ buttons to decrease or increase text size. Preference is persisted.
- **Print** — click the print icon to trigger the browser print dialog. The dashboard has print-specific CSS to optimise layout.
- **Keyboard navigation** — all tabs are navigable by keyboard. A "Skip to main content" link is provided at the top of the page for screen-reader users.
- **Colour coding** — RAG colours (green/amber/red) are supplemented by numeric values so colour is never the only indicator.

---

## 14. Frequently Asked Questions

**Q: The dashboard shows "Failed to Load Dashboard Data".**
A: You opened `dashboard.html` directly as a `file://` URL. Use the launcher to start a Python server, or use a portable build.

**Q: My XLSX data is not being picked up by the editor.**
A: Check that the assignment group column in your ServiceNow export matches one of the keys in `opsreview_config.json → mappings`. Column name matching is case-sensitive. Review the badge counts at the top of the editor after import to confirm how many rows were parsed.

**Q: I need to add a new module.**
A: Add an entry to `modules[]` and `mappings{}` in `opsreview_config.json` (editor config), then re-run calculations. The module ID must be a unique lowercase camelCase string with no spaces.

**Q: The trend charts show only zeros for one module.**
A: The `mom`, `respSlaMom`, and `resolSlaMom` arrays for that module were not populated. Load previous JSON to carry forward historical data, or manually enter the arrays in `ops_data.json`.

**Q: How do I change the dashboard title or tab labels?**
A: Edit `public/data/dashboard_config.json`. No code changes are needed.

**Q: The portable build is missing fonts.**
A: Confirm that `.woff2` files exist in `public/css/fonts/` and that their filenames match the references in `public/css/fonts.css`.

**Q: How do I validate `ops_data.json` without opening the editor?**
A: Run `node scripts/validate_data.js public/data/ops_data.json` from the project root. This performs structural checks and reports pass/fail for each field.
