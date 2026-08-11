# SAP CRM · ServiceNow Weekly IT Operations Dashboard

**Version:** 3.1 &nbsp;|&nbsp; **Schema:** `snow_weekly.json v1.0.0` / `snow_config.json v4.0.0`
**Prepared by:** IT Portfolio Management Office &nbsp;|&nbsp; **Audience:** IT Portfolio Managers, IT Leadership

---

## 1. Product Overview

The SAP CRM ServiceNow Weekly IT Operations Dashboard is a **local-first, zero-backend executive reporting application** that renders a fully interactive, print-ready weekly operations brief from a single JSON data file. It is designed to be operated by a non-developer IT Portfolio Manager without any build toolchain, cloud subscription, or database dependency.

The application produces consistent, high-fidelity output across every modern browser and is deployable as either a **live served instance** (via a local Python HTTP server) or a **fully self-contained portable HTML file** compiled by the bundled `Launcher.bat` utility. Both modes render identically.

---

## 2. Architectural Pillars

### 2.1 Zero-Infrastructure Footprint

The dashboard requires no installed runtime beyond Python 3 (standard on all managed corporate workstations) and a modern web browser. There is no Node.js dependency, no package manager, no transpilation step, and no deployment pipeline.

The application surface consists of a static HTML shell (`snow_dashboard.html`), a CSS design system (`snow_dashboard.css` and `fonts.css`), a JavaScript renderer (`snow_dashboard.js`), a weekly data file (`snow_weekly.json`), and a configuration file (`snow_config.json`). An optional browser-based editor (`snow_editor.html`) provides a GUI for editing the data file.

External dependencies, including **Chart.js 4.4.1** and **Google Fonts (Sora, DM Mono)**, are loaded from CDNs (`cdnjs.cloudflare.com`, `fonts.googleapis.com`) when served in live mode. In **portable build mode**, all external references — Chart.js, fonts, and stylesheets — are inlined into a single self-contained HTML file. No internet connection is required to open the portable build.

### 2.2 Dual-File State Engine

All content visible to the user — KPI values, chart data, commentary bullets, intervention escalations, week-on-week scorecard rows, section labels, and navigation URLs — is declared in two JSON files:

| File | Purpose | Edit Cadence |
|---|---|---|
| `public/data/snow_weekly.json` | Weekly KPI values, chart data, commentary, WoW scorecard, intervention items | **Weekly** |
| `public/data/snow_config.json` | Thresholds, bar maxes, state/priority maps, valid values, stat/chart display metadata | **Quarterly** or on ServiceNow field change |

The HTML template (`snow_dashboard.html`) and JavaScript renderer (`js/snow_dashboard.js`) are **durable, zero-edit assets**. They must never be modified as part of a weekly update cycle.

The renderer boots asynchronously via `boot()`, fetches both JSON files over the local HTTP server, and constructs the entire DOM programmatically via template-literal render functions (`renderHeader`, `renderKPIs`, `renderSnow`, `renderCharts`, `renderCommentary`, `renderWoW`, `renderIntervention`, `renderFooter`). No data is hardcoded in the HTML.

For weekly editing, an optional browser-based editor (`snow_editor.html`) provides a form-driven GUI that reads `snow_config.json` for field validation, allowed values, and state/priority maps. It generates validated JSON output for the Data Steward to save.

### 2.3 Portable Compilation Engine

`Launcher.bat` (Windows) and `Launcher.sh` (macOS / Linux) embed build engines that produce a portable, fully self-contained HTML file in the `portable/` directory. The compiler:

1. Reads `snow_dashboard.html`, `snow_weekly.json`, `snow_dashboard.css`, `snow_dashboard.js`, `fonts.css`, and `chart.umd.js` as raw UTF-8 text.
2. Validates `snow_weekly.json` by invoking `ConvertFrom-Json` (PowerShell) or `jq` (Shell) — halting with a non-zero exit code if the JSON contains a syntax error.
3. Injects the full JSON payload as `window.__SNOW_DATA__ = { ... }` into a `<script>` block immediately before `</head>`.
4. Replaces the `<link rel="stylesheet" href="css/snow_dashboard.css">` tag with an inline `<style>` block.
5. Reads `fonts.css`, resolves each `url(fonts/*.woff2)` reference into a base64 `data:font/woff2;base64,...` URI, and inlines the entire stylesheet as a `<style>` block — eliminating the Google Fonts network dependency.
6. Reads `chart.umd.js` and inlines it as a `<script>` block — eliminating the Chart.js CDN dependency.
7. Replaces the `<script src="js/snow_dashboard.js">` tag with an inline `<script>` block, patching the `fetch()` call (delimited by `/* PORTABLE_FETCH_BLOCK_START */` … `/* PORTABLE_FETCH_BLOCK_END */`) with a direct assignment: `const data = window.__SNOW_DATA__;`.
8. Patches the Content-Security-Policy `<meta>` tag to allow `'unsafe-inline'` for scripts (required for the embedded inline blocks).
9. Writes the result to `portable/SNOW_Weekly_Dashboard_Portable_YYYY-CWNN.html` using UTF-8 without BOM. The resulting file is typically ~580 KB and requires zero network access.

### 2.4 Content Security Policy & XSS Mitigation

**Content Security Policy.** The HTML template declares a `<meta http-equiv="Content-Security-Policy">` tag that restricts resource loading:

| Directive | Live Mode | Portable Build Mode |
|---|---|---|
| `default-src` | `'self'` | `'self'` |
| `script-src` | `'self' https://cdnjs.cloudflare.com` | `'self' 'unsafe-inline'` |
| `style-src` | `'self' https://fonts.googleapis.com https://cdnjs.cloudflare.com` | `'self' 'unsafe-inline'` |
| `font-src` | `'self' https://fonts.gstatic.com` | `'self' data:` |
| `img-src` | `'self' data:` | `'self' data:` |
| `connect-src` | `'self'` | `'self'` |

In portable build mode, the CSP is patched to allow `'unsafe-inline'` for scripts and styles (both are inlined) and `data:` for fonts (woff2 files are base64-embedded).

**XSS Mitigation.** The renderer applies two distinct sanitisation strategies to user-authored content from the JSON file:

- **`esc(s)`** — HTML-escapes all five dangerous characters (`&`, `<`, `>`, `"`, `'`) for plain text fields (labels, values, titles).
- **`trust(s)`** — A bespoke allowlist tokeniser for fields that intentionally contain formatting HTML (`<strong>`, `<em>`, `<b>`, `<i>`, `<br>`). It splits the string on allowed tags via regex, HTML-escapes all non-tag segments, and reconstructs safe markup without invoking the DOM parser, eliminating any XSS vector.

All URL fields rendered as `href` attributes are also passed through `esc()`. No `innerHTML` assignment is made with unsanitised external input.

### 2.5 Theme, Zoom, and Print System

**Theme:** The application supports dark (default) and light modes via a `data-theme` attribute on `<html>`. Switching is handled by `toggleTheme()`, which writes the preference to `localStorage` under the key `snow-theme`. A `MutationObserver` watches for `data-theme` attribute changes and triggers a full Chart.js teardown-and-reinitialisation cycle so chart colours always match the active theme.

**Zoom:** `changeFontSize(delta)` adjusts `document.body.style.zoom` in increments of `±0.05`, clamped to the range `[0.70, 1.50]`. The resulting zoom factor is persisted to `localStorage` under the key `snow-font-size` and restored on next boot.

**Print:** `printDashboard()` temporarily expands all collapsed sections, switches to light mode, calls `window.print()`, and restores the original state via the `afterprint` event listener. Print CSS in `snow_dashboard.css` suppresses the toolbar, help button, and scrollable panel overflow to produce clean paginated output.

### 2.6 Snow Editor — Configuration-Driven Data Editing

`snow_editor.html` is a browser-based GUI for editing `snow_weekly.json` without a text editor. It reads `snow_config.json` for validation rules and display metadata, and provides:

- **Form-driven editing** — Tabbed panels for meta, KPIs, ServiceNow cards, charts, WoW scorecard, intervention, and commentary
- **Config-driven stats display** — Stat cards are generated dynamically from the `stats_display` block in `snow_config.json`, which declares labels, colors, RAG linkage, zero-value fallback colors, and suffixes per stat type (incidents, service_requests, rfac, problems)
- **Config-driven chart display** — Chart segments are generated from the `chart_display` block, mapping state buckets to chart labels and colors
- **Expanded state maps** — `snow_config.json` assigns colour-coded buckets for RFAC breakdown (Assess, Scheduled, Implement, Review), SR breakdown (On Hold), and PRB breakdown (Investigating, Pending Change) — all rendered in the editor's stats/chart preview
- **CSV/Excel import** — Upload weekly ServiceNow exports; the editor parses columns against `FIXED_MAPPINGS` and `valid_values` from config
- **Download template** — Generates sample XLSX files with the correct column headers for each ticket type (Incidents, Service Requests, RFAC, Problems), including the **SLA Breached** column for Problems
- **Drag-and-drop config upload** — Drop a modified `snow_config.json` to update validation rules in real time
- **JSON preview & export** — Validated JSON output ready to save as `snow_weekly.json`

The editor is opened via **Launcher option 4** or by navigating directly to `http://localhost:<PORT>/snow_editor.html` in live server mode.

---

## 3. File Structure & Maintenance Matrix

```
snow-dashboard/
│
├── public/                          ← Web root (served by Python HTTP server)
│   ├── snow_dashboard.html          ← Static shell — NEVER edit after deploy
│   ├── snow_editor.html             ← Browser-based editor — reads config for validation
│   ├── css/
│   │   ├── snow_dashboard.css       ← Design system — edit only for visual fixes
│   │   └── fonts.css                ← Google Fonts @font-face declarations (inlined in portable)
│   ├── js/
│   │   ├── snow_dashboard.js        ← Headless renderer v3.1 — NEVER edit for data
│   │   └── chart.umd.js             ← Chart.js 4.4.1 local copy (inlined in portable)
│   └── data/
│       ├── snow_weekly.json         ← ★ WEEKLY EDIT TARGET — all data lives here
│       └── snow_config.json         ← Field mappings, thresholds, display metadata
│
├── scripts/
│   ├── Launcher.bat                 ← Windows launcher + embedded PowerShell compiler
│   └── Launcher.sh                  ← macOS/Linux launcher + embedded Shell compiler
│
├── Sampledata/                      ← Reference XLSX templates for data import
│   ├── incidents.xlsx
│   ├── service_requests.xlsx
│   ├── problems.xlsx                ← Includes "SLA Breached" column
│   └── rfac.xlsx
│
├── portable/                        ← Compiler output (auto-created on first build)
│   └── SNOW_Weekly_Dashboard_Portable_YYYY-CWNN.html
│
└── docs/                            ← This documentation suite
    ├── README.md
    ├── DATA_GOVERNANCE.md
    ├── EXECUTIVE_CHEATSHEET.html
    ├── RELEASE_NOTES.md
    ├── SECURITY_POLICY.md
    └── SUPPORT_ESCALATION.md
```

| Asset Path | Responsible Team | Maintenance Lifecycle | Technical Scope Notes |
|---|---|---|---|
| `public/snow_dashboard.html` | IT Portfolio Engineering | Release-gated; version-tagged | Static shell. Declares `<link>` and `<script>` tags resolved at runtime. Contains SVG icon sprite and static `#help-panel` HTML. Portable builder replaces both external references with inline equivalents. |
| `public/css/snow_dashboard.css` | IT Portfolio Engineering | Release-gated; version-tagged | Full design system. Uses CSS Custom Properties (`--red`, `--amber`, `--green`, `--blue`, `--purple`, `--muted`, `--navy*`, `--text*`, `--border`). Defines `[data-theme="light"]` overrides. Contains `.no-print` rules and `@media print` layout. |
| `public/js/snow_dashboard.js` | IT Portfolio Engineering | Release-gated; version-tagged | Headless renderer. Contains `boot()`, all `render*()` functions, `initCharts()`, `toggleTheme()`, `changeFontSize()`, `printDashboard()`, XSS sanitisers (`esc`, `trust`), and Chart.js lifecycle management. The `PORTABLE_FETCH_BLOCK_START/END` markers delimit the code region patched by the compiler. |
| `public/data/snow_weekly.json` | IT Portfolio Management Office | **Weekly** — every reporting cycle | ★ Primary weekly data target. Contains `meta`, `kpis`, `snow_links`, `charts`, `wow_scorecard`, `rfac_scorecard`, `intervention`, `commentary`, `sections`, and `footer` blocks. Schema version `1.0.0`. |
| `public/data/snow_config.json` | IT Portfolio Engineering | Quarterly or on ServiceNow field change | Declares `thresholds`, `bar_maxes`, `state_maps` (including expanded RFAC/SR/PRB buckets), `priority_maps`, `category_maps`, `snow_urls`, `valid_values`, `stats_display`, and `chart_display`. Used by the editor for validation and display metadata. Schema version `4.0.0`. |
| `public/snow_editor.html` | IT Portfolio Engineering | Release-gated | Browser-based editor GUI. Reads `snow_config.json` for form validation, state maps, and display metadata. Generates validated `snow_weekly.json` output. Supports CSV/Excel import and config upload. |
| `scripts/Launcher.bat` | IT Portfolio Engineering | Release-gated | Windows Batch + embedded PowerShell compiler. Port-iterates 8080–8120. Extracts PowerShell from post-`::PS1_START` section at runtime. Offers menu options: 1=Launch, 2=Build, 3=Build+Launch, 4=Editor. |
| `scripts/Launcher.sh` | IT Portfolio Engineering | Release-gated | macOS/Linux Shell launcher. Mirrors Launcher.bat logic. Builds portable HTML using embedded Shell compiler. |
| `Sampledata/*.xlsx` | IT Portfolio Management Office | Updated when template columns change | Reference XLSX files for weekly CSV/Excel export. Problems template includes **SLA Breached** column. |
| `portable/*.html` | IT Portfolio Management Office | Generated weekly by Launcher option 2 or 3 | Self-contained single-file build. Distributed to stakeholders who cannot run a local server. Contains inlined JSON, CSS, and JS. Filename is date-stamped: `SNOW_Weekly_Dashboard_Portable_YYYY-CWNN.html`. |
| `docs/` | IT Portfolio Engineering | Updated on architecture change | This documentation suite. Six files covering product overview, data governance, executive reference, release notes, security policy, and support escalation. |

---

## 4. Quick Start

### 4.1 Prerequisites

| Requirement | Minimum Version | Check Command |
|---|---|---|
| Python | 3.6+ | `python --version` |
| Modern Browser | Chrome 90+, Edge 90+, Firefox 88+, Safari 15+ | — |
| Windows (for Launcher) | Windows 10+ | — |
| PowerShell | 5.1+ | `$PSVersionTable.PSVersion` |

### 4.2 Launch (Live Server Mode)

1. Double-click `scripts/Launcher.bat`.
2. Enter `1` and press Enter.
3. The launcher iterates ports 8080–8120 until a free port is found, then starts `python -m http.server <PORT>` with `public/` as the working directory.
4. A browser tab opens automatically at `http://localhost:<PORT>/snow_dashboard.html` after a 2-second delay.
5. To open the **editor**, navigate to `http://localhost:<PORT>/snow_editor.html` or select **option 4** from the Launcher menu (opens directly from the file system).
6. To stop the server, press **Ctrl+C once** in the terminal window.

### 4.3 Build Portable (Offline Distribution)

1. Double-click `scripts/Launcher.bat`.
2. Enter `2` (build only) or `3` (build then launch) and press Enter.
3. The embedded compiler validates the JSON, inlines all assets (CSS, fonts as base64 data URIs, Chart.js as inline script, and the renderer with fetch patched to a local variable), then writes the output to `portable/SNOW_Weekly_Dashboard_Portable_YYYY-CWNN.html` (~580 KB, zero network dependencies).
4. Distribute the generated file to stakeholders. It opens directly in any browser with no server.

### 4.4 Manual Server Launch (Without Launcher)

```bat
:: From a Command Prompt or PowerShell terminal:
cd path\to\snow-dashboard\public
python -m http.server 8080
:: Then open: http://localhost:8080/snow_dashboard.html
:: Or open the editor: http://localhost:8080/snow_editor.html
```

---

## 5. Portable Build — Compiler Technical Reference

The PowerShell compiler embedded in `Launcher.bat` (after `::PS1_START`) executes the following pipeline. Both `Launcher.bat` and `Launcher.sh` implement the same logical steps.

### Step 1 — Guard Checks

```powershell
if (!(Test-Path $HtmlFile)) { Write-Host "ERROR: ..."; exit 1 }
if (!(Test-Path $JsonFile))  { Write-Host "ERROR: ..."; exit 1 }
```

`Launcher.bat` checks for `snow_dashboard.html`, `snow_weekly.json`, `snow_dashboard.css`, `snow_dashboard.js`, `fonts.css`, and `chart.umd.js`. Missing any source file halts the build with exit code `1`.

### Step 2 — JSON Validation Gate

```powershell
try {
    $parsed = $json | ConvertFrom-Json -ErrorAction Stop
    Write-Host "  [OK] JSON format structure verified."
} catch {
    Write-Host "ERROR: snow_weekly.json contains a syntax error..."
    exit 1
}
```

This validation gate is **non-negotiable**. A syntactically invalid JSON file will never be embedded into a portable build. The error message includes the parser's exception detail to assist diagnosis.

### Step 3 — JSON Injection

```powershell
$dataScript = "<script>`n  window.__SNOW_DATA__ = " + $json + ";`n</script>`n"
$html = $html.Replace("</head>", "$dataScript</head>")
```

The full JSON string is concatenated into a `<script>` block and injected immediately before `</head>`. At runtime, the patched `boot()` function reads `window.__SNOW_DATA__` directly instead of calling `fetch()`.

### Step 4 — CSS Inline Embedding

```powershell
$cssStyleTag  = "<style>`n$css`n</style>"
$linkPattern  = '<link\s+rel="stylesheet"\s+href="css/snow_dashboard\.css"\s*/?>'
$html         = $html -replace $linkPattern, $cssStyleTag
```

The external stylesheet link is replaced with a verbatim inline `<style>` block.

### Step 5 — Font Inlining (Base64 WOFF2)

```powershell
$fontDir = Join-Path $ScriptDir "..\public\css\fonts"
Get-ChildItem $fontDir -Filter "*.woff2" | ForEach-Object {
    $bytes     = [System.IO.File]::ReadAllBytes($_.FullName)
    $b64       = [Convert]::ToBase64String($bytes)
    $dataUri   = "data:font/woff2;base64,$b64"
    $fontCssContent = $fontCssContent -replace [regex]::Escape("fonts/$fileName"), $dataUri
}
```

The compiler reads `fonts.css`, discovers each `url(fonts/*.woff2)` reference, reads the binary woff2 file, converts it to a base64 data URI, and replaces the URL in the CSS. The resulting inline `<style>` block contains no external font dependencies.

### Step 6 — Chart.js Inline Embedding

```powershell
$chartJs   = [System.IO.File]::ReadAllText((Resolve-Path $ChartJsFile), [System.Text.Encoding]::UTF8)
$chartTag  = "<script>`n$chartJs`n</script>"
$html = $html -replace '<script\s+src="js/chart\.umd\.js"\s*>\s*</script>', $chartTag
```

Chart.js 4.4.1 (~440 KB) is inlined as a `<script>` block, eliminating the CDN dependency.

### Step 7 — JS Inline Embedding with Fetch Patch

```powershell
$fetchPattern = "/\* PORTABLE_FETCH_BLOCK_START \*/.*?/\* PORTABLE_FETCH_BLOCK_END \*/"
$fetchReplace = '/* PORTABLE_FETCH_BLOCK_START */ const data = window.__SNOW_DATA__; /* PORTABLE_FETCH_BLOCK_END */'
$patchedJs    = [regex]::Replace($js, $fetchPattern, $fetchReplace,
                  [System.Text.RegularExpressions.RegexOptions]::Singleline)
```

The `Singleline` flag makes `.` match newlines, ensuring the multi-line `fetch()` / `await` block is captured and replaced in its entirety by the direct assignment.

### Step 8 — CSP Patch

```powershell
$html = $html -replace 'script-src ''self'' https://cdnjs\.cloudflare\.com',
                       "script-src 'self' 'unsafe-inline'"
```

The Content-Security-Policy `<meta>` tag is updated to allow `'unsafe-inline'` for scripts and styles, and `data:` for fonts, since all external resources are now embedded.

### Step 9 — Output Write

```powershell
$utf8NoBom  = [System.Text.UTF8Encoding]::new($false)
[System.IO.File]::WriteAllText($outputPath, $html, $utf8NoBom)
```

UTF-8 without BOM is mandatory. A BOM prefix causes subtle rendering artefacts in some browser/OS combinations and corrupts string parsing in downstream text processing tools.

---

## 6. Data Binding Specification

The following excerpt from `snow_weekly.json` illustrates how each JSON primitive maps to a rendered UI element:

```json
{
  "meta": {
    "dashboard_title": "Client IT Portfolio — Weekly IT Operations Dashboard",
    "week_label":      "W22",
    "week_range":      "25 May – 31 May 2026",
    "data_as_of":      "28 May 2026, 01:02 UTC",
    "prepared_by":     "IT Portfolio Management Office"
  },
  "kpis": [
    {
      "id":           "incidents",
      "label":        "Open Incidents",
      "value":        "118",
      "color":        "green",
      "bar_pct":      100,
      "delta_val":    14,
      "delta_dir":    "up",
      "delta_label":  "vs W21",
      "invert_delta": false
    }
  ]
}
```

| JSON Path | Rendered UI Element | Notes |
|---|---|---|
| `meta.dashboard_title` | Masthead heading text | Also set as `document.title` on boot |
| `meta.week_label` | Masthead pill — left segment | e.g. `W22` |
| `meta.week_range` | Masthead pill — right segment | e.g. `25 May – 31 May 2026` |
| `meta.data_as_of` | Masthead — "Data as of" timestamp | Prefixed by `meta.data_as_of_label` |
| `meta.prepared_by` | Masthead subtitle | Follows `meta.portfolio` |
| `kpis[n].label` | KPI tile heading | Plain text; HTML-escaped |
| `kpis[n].value` | KPI tile large value | Coloured by `kpis[n].color` |
| `kpis[n].color` | KPI value text colour + progress bar fill | Must be one of: `red`, `amber`, `green`, `blue`, `purple`, `muted` |
| `kpis[n].bar_pct` | KPI progress bar width (0–100) | Integer |
| `kpis[n].delta_val` | Delta value shown after arrow symbol | Integer |
| `kpis[n].delta_dir` | Arrow direction: `▲` `▼` `—` | `up`, `down`, or `flat` |
| `kpis[n].invert_delta` | Colour logic inversion for SLA rows | `true` = `up` renders green (improvement) |
| `snow_links.types[n].stats[m].value` | Stat value in ServiceNow navigation card | Coloured by `stats[m].color` |
| `snow_links.types[n].stats[m].rag` | Dynamic RAG colour for SLA stats | `red` · `amber` · `green`; overrides static `color` |
| `snow_links.types[n].stats[].breakdown.*` | Breakdown subtotals within a stat card | e.g. `rfac.assess`, `sr.on_hold`, `prb.investigating` — rendered when breakdown sum matches KPI total |
| `snow_links.types[n].button.url` | `href` on "View All" button | Rendered via `esc()` |
| `charts.*.datasets[n].data` | Chart data series | Array of integers or chart-specific structure |
| `charts.*.open` | Whether the charts section is expanded on load | `true` = expanded (default) |
| `charts.*.segments[n].label` | Segment label for breakdown charts | Driven by `chart_display` in config |
| `charts.*.segments[n].value` | Segment value for breakdown charts | Must sum to corresponding KPI value |
| `intervention.items[n].body` | Body text of escalation card | Rendered via `trust()` — `<strong>` allowed |
| `commentary.columns[n].items[m].text` | Commentary bullet body | Rendered via `trust()` |
| `sections.*.open` | Whether a section is expanded on load | `true` = expanded (charts defaults to `true`) |

### 6.1 Config-Driven Stats and Charts

`snow_config.json` now contains two sections that control how the editor generates stats and chart segments:

**`stats_display`** — Defines colour, label, RAG linkage, and zero-value fallback for each stat in the ServiceNow cards. For example:

```json
"stats_display": {
  "problems": {
    "open":        { "label": "Open",        "color": "red",   "zero_color": null },
    "sla_met":     { "label": "SLA Met",     "color": "green", "zero_color": null, "rag": true },
    "sla_breached":{ "label": "SLA Breached","color": "red",   "zero_color": null, "rag": true },
    "sla_pct":     { "label": "SLA %",       "color": "green", "zero_color": null,
                     "rag": true, "suffix": "%", "fallback": "—" }
  }
}
```

Fields with `"rag": true` use the RAG colour logic (thresholds from config) instead of the static `color` value. The `suffix` and `fallback` fields control display formatting (e.g., `sla_pct` shows `"100%"` or `"—"` when no data exists).

**`chart_display`** — Defines chart metadata for the charts section. For example:

```json
"chart_display": {
  "rfac_pipeline": {
    "label": "RFAC Pipeline Status",
    "type": "doughnut",
    "segments": {
      "assess":    { "label": "Assess",    "color": "#4faeff" },
      "scheduled": { "label": "Scheduled", "color": "#b57cff" },
      "implement": { "label": "Implement", "color": "#f5a623" },
      "review":    { "label": "Review",    "color": "#3dbd7e" }
    }
  }
}
```

The editor's `genStats()` and `genSegments()` helpers read these config blocks to generate the stats arrays and chart segment arrays dynamically — no JavaScript code changes are needed when adding a new stat or chart type.

### 6.2 PRB SLA Handling

The Problems section includes SLA Compliance stats. The data field `made_sla` in the problems export is mapped via `FIXED_MAPPINGS.problems` in the editor. Two display rules apply:

- **When SLA data exists:** The SLA Breached count is computed from the export, and SLA % is calculated as `(total - breached) / total * 100`.
- **When no SLA data exists:** SLA % defaults to `100` (displayed as `"100%"` with green colour), assuming full compliance. The `"—"` fallback is used only when the SLA stat itself is null in the JSON.

---

## 7. Allowed Value Reference

All colour keys, direction values, and RAG states are validated by the renderer. Using an undeclared key causes a console warning and falls back to `muted`.

| Field | Allowed Values |
|---|---|
| `color` / `color_key` / `tag_color` / `pill_color` / `badge_color` | `red` · `amber` · `green` · `blue` · `purple` · `muted` |
| `delta_dir` | `up` · `down` · `flat` |
| `rag` | `red` · `amber` · `green` |
| `severity` (intervention items) | `red` · `amber` |
| `invert_delta` | `true` · `false` |

---

*Document version 1.0 · Generated 2026-05-28 · IT Portfolio Management Office*
