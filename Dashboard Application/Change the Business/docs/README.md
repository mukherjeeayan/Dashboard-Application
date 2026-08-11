# CTB Portfolio Dashboard
### SAP CRM · Change-the-Business Portfolio Status System

> **Version:** v1.1 · **Audience:** IT Leadership (Confidential–Internal)
> **Maintainer:** SAP CRM Team · **Stack:** Vanilla HTML/CSS/JS + JSON · No build tools, no dependencies
> **Last updated:** CW21 · 28 May 2026

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [File Structure](#2-file-structure)
3. [Quick Start](#3-quick-start)
4. [The Launcher](#4-the-launcher)
5. [Dashboard Sections Explained](#5-dashboard-sections-explained)
6. [The Data File (public/data/ctb_data.json)](#6-the-data-file-publicdatactb_datajson)
7. [The GUI Editor (public/ctb_editor.html)](#7-the-gui-editor-publicctb_editorhtml)
8. [Allowed Field Values — Complete Reference](#8-allowed-field-values--complete-reference)
9. [Data Validation](#9-data-validation)
10. [Portable Build](#10-portable-build)
11. [Auto-Refresh & Live Indicator](#11-auto-refresh--live-indicator)
12. [Accessibility & Colour-Blind Support](#12-accessibility--colour-blind-support)
13. [Frequently Asked Questions](#13-frequently-asked-questions)
14. [Troubleshooting](#14-troubleshooting)

---

## 1. Product Overview

The CTB Portfolio Dashboard is a **zero-dependency, browser-based portfolio status reporting tool** built for the SAP CRM Change-the-Business programme. It provides IT leadership with a single-screen view of all active projects across five dimensions: schedule, budget, scope, quality, and overall health.

The current portfolio tracks five workstreams: **E-Invoicing OFR**, **OSTE Mercoline OFR**, **Asset Care**, **CDS After Repair**, and **Loaner Improvement**.

### Key Design Principles

- **Data-only updates.** All content lives in `public/data/ctb_data.json`. The HTML files are never edited.
- **No installation required.** Runs on any machine with a modern browser and Python 3 (for the live server), or as a completely standalone portable HTML file that needs nothing at all.
- **Two modes of use:** Live mode (served by Python, auto-refreshes every 5 minutes) and Portable mode (a single self-contained HTML file, shareable by email or Teams).
- **Built-in validation.** The dashboard checks the data file for structural errors on every load and shows actionable fix instructions before rendering.
- **Non-technical editing.** A companion GUI editor (`public/ctb_editor.html`) allows updates without touching JSON directly.
- **Air-gap / offline compatible.** All fonts use the system stack — no external CDN calls. A strict Content Security Policy (CSP) is enforced via meta header.
- **Accessibility controls.** Dark/light theme toggle, A−/A+ font size adjustment (7 steps, session-persistent), and a Print/PDF export button are all available from the masthead.

---

## 2. File Structure

```
Change the Business/
├── 📁 public/                          ← Web server root
│   ├── dashboard.html
│   ├── ctb_editor.html
│   ├── 📁 css/
│   │   └── dashboard.css
│   ├── 📁 js/
│   │   ├── utils.js                    ← Shared utilities (esc, safeUrl, daysUntil)
│   │   └── dashboard.js
│   └── 📁 data/
│       ├── ctb_data.json               ← Single source of truth for all portfolio data
│       └── ctb_data.schema.json        ← JSON Schema for VS Code auto-complete & validation
├── 📁 scripts/
│   ├── Launcher.bat                    ← All-in-one Windows launcher script
│   └── launcher.sh                     ← All-in-one Mac/Linux launcher script
├── 📁 portable/                        ← NEW: build output goes here
│   └── CTB_Dashboard_Portable_*.html   ← Self-contained portable file (generated)
├── .editorconfig                       ← Editor settings (2-space indent, LF line endings)
├── eslint.config.js                    ← ESLint recommended rules for JS files
└── 📁 docs/
    ├── README.md                       ← This file (full technical documentation)
    ├── RELEASE_NOTES.md                ← Delivered capabilities, constraints, and roadmap
    ├── SECURITY_POLICY.md              ← Data classification and distribution rules
    ├── DATA_GOVERNANCE.md              ← Weekly update workflow and data stewardship guide
    └── SUPPORT_ESCALATION.md           ← Incident response and troubleshooting matrix
```


### Role of Each File

| File | Purpose | Edit? |
|---|---|---|
| `public/data/ctb_data.json` | All portfolio content: projects, risks, milestones, decisions, meta, _instructions | ✅ Yes — primary way to update |
| `public/data/ctb_data.schema.json` | JSON Schema for VS Code auto-complete & inline validation | ❌ Never edit — must stay in sync with data structure |
| `public/ctb_editor.html` | GUI for editing `public/data/ctb_data.json` without touching raw JSON | ✅ Open in browser to use |
| `public/dashboard.html` | Renders the dashboard by reading `public/data/ctb_data.json` | ❌ Never edit |
| `public/js/utils.js` | Shared utility functions `esc()`, `safeUrl()`, `daysUntil()` used by CTB and RTB | ❌ Edit only when adding a new shared util |
| `scripts/Launcher.bat` | Starts the Python server or builds a portable file (Windows) | ❌ Never edit |
| `scripts/launcher.sh` | Starts the Python server or builds a portable file (Mac/Linux) | ❌ Never edit |
| `.editorconfig` | Editor settings (2-space indent, LF endings, UTF-8) | ❌ Never edit |
| `eslint.config.js` | ESLint configuration for JS linting | ❌ Edit only when adding new lint rules |
| `portable/` | Build output folder — contains generated portable HTML files | ❌ Auto-generated |
| `EXECUTIVE_CHEATSHEET.html` | One-page visual guide to reading the dashboard — share with executive recipients | ❌ Never edit |
| `RELEASE_NOTES.md` | Delivered capabilities, known constraints, and indicative roadmap | ❌ Reference only |
| `SECURITY_POLICY.md` | Data classification, permitted distribution channels, incident reporting | ❌ Reference only |
| `DATA_GOVERNANCE.md` | Friday cut-off workflow, archiving strategy, concurrent editing protocol | ❌ Reference only |
| `SUPPORT_ESCALATION.md` | Incident scenarios, self-service diagnostics, escalation contacts | ❌ Reference only |

---

## 3. Quick Start

### Requirements

- **Python 3** on your system PATH. Verify with `python --version`
- **A modern browser** (Chrome, Edge, Firefox, Safari — any recent version)

### Steps (Windows — Recommended)

1. Double-click `scripts/Launcher.bat`.
2. Choose **option 1** (Launch Dashboard).
3. Your browser opens automatically at `http://localhost:8080/public/dashboard.html` (or the next available port up to 8120 if 8080 is busy).
4. Edit `public/data/ctb_data.json` (or use `public/ctb_editor.html`) whenever data changes.
5. The dashboard auto-refreshes every 5 minutes — no need to manually reload.
6. Press **Ctrl+C once** in the Launcher window to stop the server and return to the menu.

### Steps (Mac / Linux — Recommended)

1. Open a terminal in the project root.
2. Make the script executable (first time only): `chmod +x scripts/launcher.sh`
3. Run: `./scripts/launcher.sh`
4. Choose **option 1** (Launch Dashboard).
5. Your browser opens automatically at `http://localhost:8080/public/dashboard.html`.
6. Press **Ctrl+C once** to stop the server and return to the menu.

### Manual Start (Any Platform)

```bash
cd /path/to/your/dashboard/folder
python3 -m http.server 8080
```

Then open: `http://localhost:8080/public/dashboard.html`

### VS Code Alternative

Install the **Live Server** extension → right-click `public/dashboard.html` → **Open with Live Server**.

> ⚠️ **Why can't I just double-click `public/dashboard.html`?** Browsers block local file access (`file://` protocol) for security. You must serve the files over a local HTTP server. The Launcher handles this automatically.

---

## 4. The Launcher

The Launcher is a menu-driven script that starts the Python live server or builds a portable file. Two versions are provided for cross-platform support:

| Platform | File |
|---|---|
| **Windows** | `scripts/Launcher.bat` (double-click to run) |
| **Mac / Linux** | `scripts/launcher.sh` (run via terminal: `./scripts/launcher.sh`) |

`Launcher.bat` embeds a PowerShell engine for the portable build. `launcher.sh` embeds a Python build script directly.

Both present the same menu options:

### Menu Options

| Option | What It Does |
|---|---|
| **1 — Launch Dashboard** | Starts a Python HTTP server, scanning from port 8080 up to 8120 to find an available port, then opens the dashboard in your browser automatically after 2 seconds. |
| **2 — Build Portable** | Runs the PowerShell build engine to produce a self-contained HTML file with the JSON data baked in. |
| **3 — Build then Launch** | Builds the portable file first, then — if the build succeeds — launches the live server. Useful for producing an archive snapshot and running live simultaneously. |
| **N — Exit** | Closes the Launcher cleanly. |

### How the Portable Build Works (Technical)

The embedded build engine (PowerShell in `Launcher.bat`, Python in `launcher.sh`) performs these steps in order:

1. **Reads** `public/dashboard.html`, `public/data/ctb_data.json`, `public/js/dashboard.js`, and `public/css/dashboard.css` as UTF-8 text.
2. **Validates** the JSON — exits with an actionable error if invalid.
3. **Injects** the JSON as a global JavaScript variable (`window.__CTB_DATA__`) inside a `<script>` block, inserted before `</head>`.
4. **Replaces** the `fetch('data/ctb_data.json')` call in the dashboard script with `const data = window.__CTB_DATA__`, so no HTTP request is needed.
5. **Embeds** the external CSS and JS files inline. The `utils.js` script tag is removed (its functions are already inlined with `dashboard.js`).
6. **Disables** the 5-minute `setInterval` auto-refresh (not meaningful when data is baked in).
7. **Creates** the `portable/` folder if it does not exist, then writes the output as a date-stamped file: `portable/CTB_Dashboard_Portable_YYYY-CWNN.html` (e.g. `portable/CTB_Dashboard_Portable_2026-CW20.html`), UTF-8 without BOM.

The output file is fully self-contained — it can be opened by double-click in any browser, emailed, or shared via Teams with no server required.

---

## 5. Dashboard Sections Explained

The dashboard is divided into five labelled sections (A through E), rendered in a responsive grid layout.

---

### Section A — The Pulse (Portfolio Delivery Health)

The top band of the dashboard. It contains three elements:

#### Global Portfolio RAG Card
A computed health indicator driven exclusively by `rag.overall` on each project. It shows:
- A coloured orb (GREEN / AMBER / RED) representing the worst active project status.
- A summary label such as "3 of 4 Active On Track · 1 At Risk".
- A count strip showing project counts by status. Only states with at least one project are shown — an all-green portfolio shows only the GREEN count, not empty AMBER / RED / HOLD cells.

> HOLD projects are **excluded** from the global RAG calculation. They do not pull the portfolio colour.

#### Individual Project Scorecards
A scrollable horizontal strip of cards, one per project. Each card shows:
- Project name and current phase/sub-phase.
- Five coloured dots: Schedule (SCH), Budget (BDG), Scope (SCP), Quality (QLT), and Overall.
- A left-edge accent bar coloured by `rag.overall`.
- Complete projects are dimmed (reduced opacity).

#### Key Flag Banner
A highlighted gold banner shown below the scorecards when `pulse.keyFlag` is set in the data file. Used for headline announcements such as gate approvals or kickoff confirmations. Hidden automatically when the field is empty or absent.

---

### Section B — Project Matrix

A tabular view of all active projects for side-by-side comparison. Columns:

| Column | Source Field | Notes |
|---|---|---|
| Project / Initiative | `name` | Row is dimmed if `projectStatus = "complete"` |
| Phase | `phase` + `subPhase` | Sub-phase shown below the phase badge |
| Schedule | `scheduleVariance` + `scheduleStatus` | e.g. `+2d AT RISK` as a coloured pill |
| SCH · BDG · SCP · QLT | `rag.schedule/budget/scope/quality` | Four small coloured dots with colourblind labels |
| RAG | `rag.overall` | Larger dot — the single source of truth for overall health |
| Next Milestone | `nextMilestone` | Free-text, truncated with ellipsis |
| Deep Dive | `deepDiveUrl` | Link button to MS Teams Planner or any URL; label customisable via `deepDiveLabel` |

The table scrolls vertically when there are more projects than fit in the panel height.

#### Filter Bar

A search and filter bar sits above the matrix. It provides two ways to narrow the project list:

- **Text search:** Type any part of a project name to instantly hide non-matching rows. A clear (✕) button appears when text is entered.
- **RAG chip filters:** Click the **Green**, **Amber**, **Red**, or **Hold** buttons to show only projects with that overall RAG status. Click **All** to reset.

A result count is displayed when a filter is active. Filters reset automatically on silent refresh if the data has changed. The filter bar is hidden in print/PDF output.

---

### Section C — Upcoming Milestones

A scrollable chronological list of portfolio milestones. Each entry shows:
- A date box (day and month, e.g. "21 MAY").
- A colour-coded type badge: MILESTONE (blue), REVIEW (amber), GO/NO-GO (red), APPROVAL (green), DECISION (gold).
- A description line.

Milestones are sorted by date automatically — the order in `public/data/ctb_data.json` does not matter. **Upcoming milestones are displayed first**, sorted with the nearest date at the top. Past milestones appear below in a separate "Past" section (dimmed), so they remain visible for reference without cluttering the upcoming view.

---

### Section D — Executive Decisions / C-Suite Asks

A panel of open actions requiring executive input or approval. Each item shows:
- An emoji icon, headline ask, and context paragraph.
- A **due date badge** that pulses red automatically when due within 7 days, and shows a solid "OVERDUE" badge when past due.
- A **project tag** linking the ask to its originating project (linked via `projectId`).

---

### Section E — Cross-Project Risks & Dependencies

A full-height panel listing all active risks and watchpoints. Each entry shows:
- A level badge: HIGH (red), MED (amber), LOW (green), DEP (blue), ESC (bright red), WATCH (gold).
- A title and full description.
- Project tag chips for each affected project listed in `affectedProjects`.

---

### Masthead (Header)

Always visible at the top. Contains:
- Report title, confidentiality sub-label, and portfolio owner (from `meta`).
- A period pill (e.g. "May 2026 / CW21") and a last-updated timestamp.
- A LIVE indicator dot: pulsing green when data loaded successfully; grey/STALE if the last auto-refresh failed.
- A **?** help toggle button that expands an in-page reference panel with allowed values, JSON examples, and quick-start steps. The content is generated at render time from the `_instructions` block in `ctb_data.json` — editing allowed values there automatically updates the help panel. No hardcoded HTML duplication.
- A **⎙ Print / Export** button that triggers the browser's print dialog, producing a clean PDF or paper output (filter bar, help panel, and interactive controls are hidden in print view).
- A **☀ Dark/Light theme toggle** that switches between the default dark theme and a light theme. The preference is saved to `localStorage` and persists across sessions.
- **A− / A+ font size controls** that scale the entire dashboard through seven zoom steps (82% to 122%). The selected size is saved to `localStorage`.

> **Keyboard shortcut:** Press `/` (slash) or `Ctrl+F` at any time to jump focus to the filter search box — no need to reach for the mouse during executive reviews.
>
> **Session persistence:** Theme and font size preferences are stored in `localStorage`. They persist across browser restarts and new tabs (unlike `sessionStorage`, which resets on every new tab).

---

## 6. The Data File (public/data/ctb_data.json)

`public/data/ctb_data.json` is the **only file you need to edit** to update the dashboard. It has seven top-level keys:

```
public/data/ctb_data.json
├── _instructions   (powers the in-app help panel — edit allowed values here)
├── meta            (report title, period, dates, confidentiality label)
├── pulse           (the key flag announcement banner)
├── projects        (array of project objects)
├── risks           (array of risk/dependency objects)
├── milestones      (array of milestone objects)
└── decisions       (array of executive ask objects)
```

> The `_instructions` block is the single source of truth for the help panel content. Unlike earlier versions where the help panel HTML was hardcoded in `dashboard.html`, the dashboard now reads `_instructions` at render time and generates the help panel dynamically. Allowed values, field descriptions, and important notes only need updating in one place.

> A companion [`ctb_data.schema.json`](public/data/ctb_data.schema.json) file provides JSON Schema validation. VS Code users get auto-complete, value suggestions, and red underlines on invalid data while editing — before the dashboard ever loads. Reference it with `"$schema": "./ctb_data.schema.json"` at the top of the data file.

---

### 6.1 `meta` — Report Metadata

```json
"meta": {
  "reportTitle": "SAP CRM · Change-the-Business Portfolio",
  "period": "May 2026 / CW21",
  "reportDate": "23 May 2026",
  "lastUpdated": "2026-05-23T09:00:00",
  "confidentiality": "IT Leadership · Confidential-Internal review only",
  "portfolioOwner": "SAP CRM Team"
}
```

| Field | Displayed In | Format |
|---|---|---|
| `reportTitle` | Masthead title | Free text |
| `period` | Masthead pill | Free text (e.g. "May 2026 / CW20") |
| `reportDate` | Masthead | Human-readable date |
| `lastUpdated` | Masthead timestamp | ISO 8601 (`YYYY-MM-DDTHH:MM:SS`) |
| `confidentiality` | Masthead sub-label | Free text |
| `portfolioOwner` | Masthead | Free text |

---

### 6.2 `pulse` — Key Flag

```json
"pulse": {
  "keyFlag": "E-Invoicing OFR and Asset Care kickoffs completed 21 May 2026. Mercoline OFR go-live targeting 3 Jun 2026."
}
```

Set `keyFlag` to a non-empty string to show the gold announcement banner below the scorecards. Remove the text or set it to `""` to hide the banner.

---

### 6.3 `projects` — Project Array

Each project object:

```json
{
  "id": "einvoicing",
  "name": "E-Invoicing OFR",
  "phase": "EXPLORE",
  "subPhase": "Fit-to-standard workshops",
  "scheduleVariance": "+0d",
  "scheduleStatus": "ON TRACK",
  "rag": {
    "schedule": "GREEN",
    "budget": "GREEN",
    "scope": "GREEN",
    "quality": "GREEN",
    "overall": "GREEN"
  },
  "nextMilestone": "Fit-to-standard workshops ongoing",
  "comment": "Kickoff completed 21 May 2026. Fit-to-standard workshops underway.",
  "deepDiveUrl": "https://teams.microsoft.com/..."
}
```

| Field | Required | Notes |
|---|---|---|
| `id` | ✅ | Unique identifier, lowercase, no spaces. Used by `decisions[].projectId` to link asks to projects. |
| `name` | ✅ | Display name shown in all panels. |
| `phase` | ✅ | One of the six SAP Activate phases. See [Section 8](#8-allowed-field-values--complete-reference). |
| `subPhase` | Recommended | Must correspond to the chosen `phase`. |
| `scheduleVariance` | Recommended | e.g. `"+0d"`, `"+5d"`, `"-2d"`. Displayed alongside `scheduleStatus`. |
| `scheduleStatus` | Recommended | Controls the Schedule column pill only — independent from `rag.overall`. |
| `projectStatus` | Optional | Omit for active projects. Set `"complete"` to dim the row. `"hold"` is auto-inferred from `rag.overall = "HOLD"`. |
| `rag.schedule/budget/scope/quality` | ✅ | Per-dimension RAG dots shown in the matrix. |
| `rag.overall` | ✅ | **Master health field.** Drives global RAG, pulse counts, scorecard accent colour, and the Overall dot. |
| `nextMilestone` | Recommended | Short free-text description of the next key date. |
| `comment` | Recommended | Status narrative shown as a tooltip or supplementary note. |
| `deepDiveUrl` | Optional | URL to MS Teams Planner, SharePoint, or any resource. Rendered as a link button. |
| `deepDiveLabel` | Optional | Custom label for the Deep Dive button (e.g. `"M365"`, `"Planner"`). Defaults to `"Open"` if omitted. |

> **Critical distinction — `rag.overall` vs `scheduleStatus`:** These control two completely separate things. `rag.overall` is the single source of truth for portfolio health and all computed counts. `scheduleStatus` only controls the pill text in the Schedule column. A project can be `AT RISK` on schedule but `GREEN` overall if budget, scope, and quality are healthy — both fields must be set independently.

---

### 6.4 `risks` — Risk and Dependency Array

```json
{
  "level": "DEP",
  "title": "Loaner Improvement — CPI & ACE Dev Dependency",
  "description": "Full description of the risk, its cause, and impact.",
  "affectedProjects": ["loaner"],
  "depOwner": "BUSINESS"
}
```

> **Note on `affectedProjects`:** Use the project's **`id`** (e.g. `"loaner"`), not its display name. The dashboard resolves the id to the display name automatically. Using display names still works (backward compatibility) but triggers a validation warning, because a project rename would silently break the link.

> **Note on `depOwner`:** Optional. Only applicable to `DEP`-level risks. Accepted values: `"BUSINESS"` or `"IT"`. Renders a coloured badge alongside the DEP badge so leadership can immediately see who owns the dependency. Omit for all other risk levels — the field is ignored if the level is not `DEP`.

| Field | Required | Notes |
|---|---|---|
| `level` | ✅ | Controls badge colour. See [Section 8](#8-allowed-field-values--complete-reference). |
| `title` | ✅ | Bold headline for the risk. |
| `description` | Recommended | Full narrative. |
| `affectedProjects` | Recommended | Array of project **ids** (the `id` field, not the display name) shown as tag chips. Example: `["loaner", "cdsrepair"]`. Display names are accepted for backward compatibility but trigger a validation warning. |
| `depOwner` | Optional | `"BUSINESS"` or `"IT"`. Displays a coloured owner badge alongside DEP-level risks only. Ignored for all other risk levels. |

---

### 6.5 `milestones` — Milestone Array

```json
{
  "date": "2026-06-03",
  "type": "MILESTONE",
  "description": "Mercoline OFR business go-live"
}
```

| Field | Required | Notes |
|---|---|---|
| `date` | ✅ | `YYYY-MM-DD` format. Milestones sort chronologically — order in the array is irrelevant. |
| `type` | ✅ | Controls badge colour. See [Section 8](#8-allowed-field-values--complete-reference). |
| `description` | ✅ | Displayed as the milestone label. |

---

### 6.6 `decisions` — Executive Ask Array

```json
{
  "icon": "📌",
  "ask": "Short action headline",
  "context": "Why this matters and impact if delayed.",
  "dueDate": "2026-05-29",
  "dueDateLabel": "Due 29 May 2026",
  "projectId": "loaner"
}
```

| Field | Required | Notes |
|---|---|---|
| `icon` | Optional | Emoji displayed beside the ask. |
| `ask` | ✅ | Bold headline — the action required. |
| `context` | Recommended | Supporting narrative. |
| `dueDate` | Recommended | `YYYY-MM-DD`. Powers the urgency logic: pulses red within 7 days, shows OVERDUE badge when past. |
| `dueDateLabel` | Recommended | Human-readable label (e.g. `"Due 29 May 2026"`). |
| `projectId` | ✅ | Must match the `id` of an existing project. Renders a project tag on the ask card. |

---

## 7. The GUI Editor (public/ctb_editor.html)

`public/ctb_editor.html` is a standalone browser-based editor that provides a form-driven interface for updating `public/data/ctb_data.json` without touching raw JSON.

> ⚠️ **Import your data file first.** When you open the editor, it displays an amber warning banner: *"You are editing example / seed data. Import your current public/data/ctb_data.json first."* Always click **Import JSON** and select your current `public/data/ctb_data.json` before making changes. If you skip this step and download, you will overwrite your real data with the editor's example data. The banner dismisses automatically once you import, or you can dismiss it manually.

### How to Use

1. Open `public/ctb_editor.html` in your browser (double-click works — no server needed).
2. Click **Import JSON** in the toolbar and select your current `public/data/ctb_data.json`. The amber seed-data warning banner will clear once the import succeeds.
3. Use the left sidebar to navigate between sections: Meta, Pulse, Projects, Milestones, Risks, Decisions.
4. Click the **pencil icon** next to any field to edit it inline. Constrained fields (phase, scheduleStatus, RAG values, risk level, milestone type) are presented as dropdowns to prevent invalid entries.
5. Add new items (milestones, risks, decisions) using the **+ Add** buttons.
6. Delete items using the **trash icon**. Note: deleting a project also removes any decisions linked to that project — a toast message confirms how many were removed.
7. Click **Preview JSON** to see the full resulting JSON with syntax highlighting before downloading.
8. Click **Download JSON** to save the updated `public/data/ctb_data.json` to your machine.
9. Replace your existing `public/data/ctb_data.json` with the downloaded file and refresh the dashboard.

### Editor Panels

| Panel | What You Can Edit |
|---|---|
| **Meta** | Report title, period, report date, last updated timestamp, confidentiality label, portfolio owner |
| **Pulse** | Key flag announcement text |
| **Projects** | All fields per project — expand a project card to edit. RAG values use a 5-cell grid of dropdowns (Schedule, Budget, Scope, Quality, Overall). Phase and sub-phase are linked dropdowns. Note: `deepDiveLabel` is not editable in the GUI editor; set it directly in `public/data/ctb_data.json`. |
| **Milestones** | Date (calendar picker), type (dropdown), description. Add/delete entries. |
| **Risks** | Level (dropdown), title, description, affected projects (checkbox selection from the project list, linked by id), and — for DEP-level risks — a `depOwner` selector (BUSINESS / IT) that appears automatically when the level is set to DEP. Add/delete entries. |
| **Decisions** | Icon, ask, context, due date (calendar picker), project link (dropdown). The due date label is auto-generated. Add/delete entries. |

> The editor maintains an in-memory copy of the data. Nothing is saved until you click **Download JSON**. The downloaded file must be manually moved to replace `public/data/ctb_data.json` in the dashboard folder.

---

## 8. Allowed Field Values — Complete Reference

### RAG Values (applies to `rag.schedule`, `rag.budget`, `rag.scope`, `rag.quality`, `rag.overall`)

| Value | Meaning | Visual |
|---|---|---|
| `GREEN` | On Track | Green dot |
| `AMBER` | At Risk | Amber dot |
| `RED` | Off Track | Red dot |
| `HOLD` | On Hold | Grey dot — excluded from global RAG |

Values are **case-insensitive** in the data file (the dashboard normalises them). Invalid values default to AMBER with a console warning.

---

### `scheduleStatus` Values (Schedule column pill only)

| Value | Pill Style |
|---|---|
| `ON TRACK` | Green |
| `AT RISK` | Amber |
| `DELAYED` | Red |
| `ON HOLD` | Grey |

---

### `projectStatus` Values

| Value | Effect |
|---|---|
| *(omitted)* | Auto-inferred: HOLD rag → On Hold; otherwise → active |
| `active` | Normal display |
| `complete` | Row and scorecard card are dimmed |
| `hold` | Treated as on hold (same as `rag.overall = "HOLD"`) |

Only set this field manually when you need to mark a project `"complete"`. Do not add it to active projects.

---

### `phase` Values (SAP Activate methodology)

`DISCOVER` · `PREPARE` · `EXPLORE` · `REALIZE` · `DEPLOY` · `RUN`

---

### `subPhase` Values (must match the parent `phase`)

| Phase | Sub-Phase Options |
|---|---|
| DISCOVER | `Solution exploration` · `Trial & prototyping` · `Value & roadmap definition` |
| PREPARE | `Project initiation` · `Team enablement` · `System provisioning` · `Scoping & planning` |
| EXPLORE | `Fit-to-standard workshops` · `Fit-gap analysis` · `Requirements gathering` |
| REALIZE | `Solution configuration` · `Development & extensions` · `Sprint cycles` · `Testing (SIT/UAT)` · `Data migration setup` |
| DEPLOY | `Cutover planning` · `Dress rehearsals` · `End-user training` · `Go-live execution` |
| RUN | `Hypercare support` · `System monitoring` · `Continuous improvement` |

---

### `risk.level` Values

| Value | Badge Style | Use For |
|---|---|---|
| `HIGH` | Red | Critical risks requiring immediate action |
| `MED` | Amber | Significant risks under active management |
| `LOW` | Green | Minor risks, monitoring only |
| `DEP` | Blue | External or cross-team dependencies |
| `ESC` | Bright red | Escalated items already raised to leadership |
| `WATCH` | Gold | Items being monitored with no immediate action needed |

---

### `milestone.type` Values

| Value | Badge Colour |
|---|---|
| `MILESTONE` | Blue |
| `REVIEW` | Amber |
| `GO/NO-GO` | Red |
| `APPROVAL` | Green |
| `DECISION` | Gold |

---

## 9. Data Validation

Every time the dashboard loads (and on every 5-minute silent refresh), it runs a structural validation pass over `public/data/ctb_data.json`. This catches problems before they cause rendering failures.

### Validation Rules Checked

**Projects:**
- Each project must have an `id` and a `name`.
- `phase` must be one of the six valid SAP Activate values.
- All five RAG fields (`schedule`, `budget`, `scope`, `quality`, `overall`) must be valid RAG values.
- `scheduleStatus` must be a valid status value.
- `deepDiveUrl`, if present, must be a valid URL.

**Risks:**
- Must have a `level` (valid risk level) and a `title`.
- `affectedProjects` entries should match the `id` of an existing project. Using a display name triggers a validation warning (backward compatible but fragile — a project rename silently breaks the link).

**Milestones:**
- Must have a `date` in `YYYY-MM-DD` format.
- Must have a `type` matching one of the five valid types.

**Decisions:**
- Must have an `ask` field.
- `dueDate`, if present, must be in `YYYY-MM-DD` format.
- `projectId` must match the `id` of an existing project.

### Validation Outcomes

| Outcome | Dashboard Behaviour |
|---|---|
| **Errors found** | Validation screen is shown. Dashboard does not render. Fix all errors and press F5. |
| **Warnings only** | Dashboard renders normally. Validation summary is shown first with a "Load Anyway" button. |
| **No issues** | Dashboard renders immediately. |

Each issue in the validation screen includes a "How to fix" tip with the exact field name, expected values, and an example correction.

---

## 10. Portable Build

The portable build creates a `portable/CTB_Dashboard_Portable_YYYY-CWNN.html` file that is 100% self-contained.

### When to Use the Portable Build

- Sharing a **snapshot** of the current portfolio status with stakeholders who do not have access to the shared folder.
- Distributing via **email or Teams** to recipients who do not have Python.
- Archiving a **weekly record** of portfolio health (the date-stamped filename in `portable/` serves as a version identifier, e.g. `portable/CTB_Dashboard_Portable_2026-CW21.html`).

### Portable File Behaviour vs Live Mode

| Feature | Live Mode | Portable Mode |
|---|---|---|
| Data source | Reads `public/data/ctb_data.json` on disk | JSON baked into the HTML |
| Auto-refresh | Every 5 minutes | Disabled |
| LIVE indicator | Pulsing green | Grey / disabled |
| Server required | Yes (Python) | No |
| Shareable | No (requires folder access) | Yes (single file) |
| Data up to date | Always current | Snapshot at build time |

---

## 11. Auto-Refresh & Live Indicator

In live mode, the dashboard silently re-fetches `public/data/ctb_data.json` every **5 minutes** without any visible page reload. On each refresh:

- If the fetch succeeds and the JSON is valid, the dashboard compares a fingerprint of the new data against the previously loaded data. If the data is **unchanged**, the render is skipped entirely — no visual disruption and no unnecessary DOM work. The LIVE indicator timestamp updates regardless.
- If the data **has changed**, all panels are re-rendered with the latest data and active filters are reset.
- If the fetch fails (e.g. the Python server was stopped) or the JSON contains errors, the indicator switches to a grey **STALE** label. The previously rendered data remains visible.
- Silent refresh only fires when the app shell is visible — it skips automatically if the validation or error screen is showing.
- **User state is preserved across refreshes.** Scroll position in the project matrix and risks panel (both vertical and horizontal) is saved and restored so the view does not jump. The help panel's open/closed state and its ARIA state are also preserved.

This means you can update `public/data/ctb_data.json` and the dashboard will pick up the changes within 5 minutes, with no manual action required.

---

## 12. Accessibility & Colour-Blind Support

The dashboard includes several features for users with colour vision deficiencies:

- **Letter labels inside dots.** Every RAG dot carries an embedded letter: **G** (Green), **A** (Amber), **R** (Red), **H** (Hold). These are rendered via CSS `::after` pseudo-elements and are always visible without requiring a hover or focus.
- **Semantic colour names** are used throughout — status is never conveyed by colour alone.
- **ARIA attributes** on the help toggle button (`aria-expanded`, `aria-label`).
- **Smooth scrolling** and `prefers-reduced-motion` compatible animations (fade-up on load).
- **Tooltip titles** on all RAG dots providing text alternatives.

---

## 13. Frequently Asked Questions

**Q: How do I add a new project?**
Add a new object to the `projects` array in `public/data/ctb_data.json`. Give it a unique `id` (lowercase, no spaces), fill in all required fields, and save. The dashboard will pick it up on the next load or auto-refresh. Use the GUI editor for a guided experience.

**Q: How do I mark a project as complete?**
Add `"projectStatus": "complete"` to the project object. The row in the matrix and the scorecard card will be dimmed automatically.

**Q: How do I put a project on hold?**
Set `"rag": { "overall": "HOLD" }` — the dashboard infers the on-hold status from this. Alternatively, set `"projectStatus": "hold"` explicitly. HOLD projects are excluded from the global RAG calculation.

**Q: What if I need a port other than 8080?**
The Launcher automatically scans ports 8080–8120 and uses the first available one, so port conflicts are handled without manual intervention. If you need a specific port, run the Python server manually: `python -m http.server 9090`, then open `http://localhost:9090/public/dashboard.html`.

**Q: Can I add custom RAG values (e.g. BLUE)?**
No. The dashboard only recognises `GREEN`, `AMBER`, `RED`, and `HOLD`. Invalid values default to `AMBER` with a console warning.

**Q: How do I remove the Key Flag banner?**
Set `"keyFlag": ""` or delete the field from the `pulse` object in `public/data/ctb_data.json`.

**Q: Can I link a decision to multiple projects?**
No — each decision item has a single `projectId`. If an ask spans multiple projects, create a separate decision entry for each, or describe both in the `context` field.

**Q: How is the global portfolio RAG calculated?**
The dashboard takes the worst `rag.overall` value across all active (non-HOLD) projects. If any project is RED, the global RAG is RED. If none are RED but at least one is AMBER, the global RAG is AMBER. All GREEN → global RAG is GREEN.

**Q: The editor is showing example data — what should I do?**
When you first open `public/ctb_editor.html`, it loads example seed data and shows an amber warning banner at the top: *"You are editing example / seed data. Import your current public/data/ctb_data.json first."* Click **Import JSON** and select your real `public/data/ctb_data.json` file. The banner clears automatically. If you download without importing, your live data file will be replaced with example data.

**Q: I deleted a project in the editor and some decisions disappeared — is that expected?**
Yes. When you delete a project, any decision items that were linked to it via `projectId` are automatically removed from the decisions list as well. A toast message at the bottom of the screen confirms how many decisions were removed. This prevents orphaned decision items that reference a project that no longer exists from reaching the dashboard validator.

**Q: What happens if `public/data/ctb_data.json` has a syntax error?**
The dashboard shows a validation screen with the specific error detail and instructions for using JSONLint to locate and fix the problem. The Build function in the Launcher also validates the JSON before attempting to embed it, and exits with a clear error message if the file is malformed.

---

## 14. Troubleshooting

### "Cannot Load public/data/ctb_data.json" error screen

You opened `public/dashboard.html` by double-clicking it from File Explorer. Browsers block local file access. Use the Launcher or run `python -m http.server 8080` from the dashboard folder.

### Dashboard shows "STALE" indicator

The Python server was stopped or restarted, or there was a network issue on the last auto-refresh. Refresh the page manually (F5) after the server is running again.

### Python not found

1. Download Python 3 from [python.org/downloads](https://www.python.org/downloads/).
2. During installation, check **"Add Python to PATH"**.
3. Restart the Launcher.

### Build fails with "Marker not found"

The batch file may have been partially copied or truncated. Re-download the original `scripts/Launcher.bat` and ensure all content below the `::PS1_START` line is intact.

### Build fails with "fetch() pattern was not found"

The `public/dashboard.html` file has been modified and the `fetch('data/ctb_data.json')` block no longer matches the expected pattern. Restore the original `public/dashboard.html`.

### JSON validation error on load

Open `public/data/ctb_data.json` in a text editor and paste its contents into [jsonlint.com](https://jsonlint.com). Common causes:
- Missing comma between two objects in an array.
- Extra comma after the last item in an array or object.
- Unclosed `{` or `[` bracket.
- Unescaped special characters inside string values.

### Scorecard cards overflow their container on small screens

The dashboard is responsive down to approximately 780px viewport width. Below this, the pulse row and bottom row stack vertically. The scorecard strip is horizontally scrollable on any screen size.

---

*CTB Portfolio Dashboard — Internal Reference Documentation*
*SAP CRM Team · IT Leadership · Confidential-Internal*
*v1.0 · Last updated: CW21 · 24 May 2026*
