# Release Notes & Known Constraints
### CTB Portfolio Dashboard — v1.1

> **Product Version:** v1.1 · May 2026
> **Development Build:** Phase 5.5 (internal iteration label)
> **Type:** Internal Tooling — IT Leadership Portfolio Reporting
> **Status:** Production (Manual Data Entry)
> **Last reviewed:** CW21 · 28 May 2026

---

## What This Release Delivers

The CTB Portfolio Dashboard v1.1 is a browser-based, zero-dependency portfolio status reporting tool for the SAP CRM Change-the-Business programme. It consolidates five active workstreams into a single, leadership-ready view updated weekly by the Portfolio Coordinator.

### What's New in v1.1

| Change | Detail |
|---|---|
| **Mac/Linux support** | New `scripts/launcher.sh` with the same menu-driven interface (Launch, Build Portable, Open Editor) |
| **Cross-session persistence** | Theme and font-size preferences moved from `sessionStorage` to `localStorage` — survives browser restarts and new tabs |
| **Dynamic help panel** | The in-app help panel is now generated at render time from `ctb_data.json`'s `_instructions` block — single source of truth for allowed values |
| **Shared utils.js** | `esc()`, `safeUrl()`, `daysUntil()` extracted to `public/js/utils.js` for reuse between CTB and RTB dashboards |
| **JSON Schema validation** | `ctb_data.schema.json` provides VS Code auto-complete and inline validation when editing `ctb_data.json` |
| **Tightened CSP** | Removed `'unsafe-inline'` from script-src and style-src — inline styles migrated to CSS utility classes for better security posture |
| **Null-guarded render functions** | All `$()` calls in render functions now check for element existence before access — no uncaught TypeError on missing DOM elements |
| **Filter debounce** | Search input debounced at 150ms — prevents excessive DOM queries on every keystroke |
| **Keyboard shortcut** | Press `/` or `Ctrl+F` to focus the filter search box |
| **Linting & formatting** | `.editorconfig` and `eslint.config.js` added for consistent code style |
| **Typo fix** | CDS After Repair risk title corrected: "scoop" → "scope" |
| **Portable build updated** | `launcher.sh` build script handles `utils.js` (removed from embedded HTML since functions are inlined with `dashboard.js`) |

### Delivered Capabilities

**Dashboard (public/dashboard.html)**

- Global portfolio RAG health indicator computed automatically from per-project `rag.overall` values — no manual calculation required.
- Individual project scorecards showing four-dimensional RAG (schedule, budget, scope, quality) in a scrollable strip.
- Project matrix table with phase, sub-phase, schedule status pill, RAG dot row, next milestone, and deep dive links. The deep dive button label is customisable via the optional `deepDiveLabel` field (defaults to "Open").
- **Project matrix filter bar:** live text search by project name plus one-click RAG chip filters (Green / Amber / Red / Hold / All). Result count displayed when a filter is active. Hidden in print output.
- Risks & dependencies panel with six severity levels (HIGH / MED / LOW / DEP / ESC / WATCH) and project tagging by id. DEP-level risks support an optional `depOwner` field (`"BUSINESS"` or `"IT"`) that renders a coloured owner badge.
- Upcoming milestones timeline sorted chronologically with colour-coded type badges. Past milestones appear in a dimmed "Past" section below the upcoming items — visible for reference without cluttering the upcoming view.
- Executive decisions panel with automated urgency detection: items due within 7 days pulse red; past-due items show a solid OVERDUE badge.
- Key Flag announcement banner driven by a single field in the data file.
- **Dark / Light theme toggle** in the masthead. Switches the entire dashboard between dark (default) and light themes. Preference is saved to `localStorage` and persists across sessions.
- **Font size controls (A− / A+)** in the masthead. Seven zoom steps from 82% to 122%. Preference is saved to `localStorage`.
- **Keyboard shortcut:** Press `/` or `Ctrl+F` to focus the search filter instantly.
- **Print / Export to PDF button (⎙)** in the masthead. Triggers the browser's native print dialog with a clean print stylesheet — filter bar, help panel, LIVE indicator, and interactive controls are suppressed in print output.
- 5-minute silent auto-refresh in live server mode — no manual page reload required. Re-render is skipped when a fingerprint comparison detects the data is unchanged, preventing unnecessary DOM updates.
- Built-in JSON data validator that shows actionable fix instructions before rendering — errors never silently produce a broken dashboard.
- Colour-blind accessibility: letter labels (G/A/R/H) embedded in all RAG dots.
- Responsive layout supporting viewport widths down to approximately 780px.
- In-page help panel with field reference, JSON examples, and quick-start instructions — generated at render time from the `_instructions` block in `ctb_data.json`, eliminating hardcoded HTML duplication.
- **Content Security Policy (CSP)** meta header restricting resource origins without `'unsafe-inline'`. All fonts use a system stack (Segoe UI / system-ui) making the dashboard fully functional in air-gapped or restricted network environments.

**GUI Editor (public/ctb_editor.html)**

- Form-based editing of all data sections without writing JSON directly.
- Constrained dropdowns for all enumerated fields (phase, sub-phase, RAG values, schedule status, risk level, milestone type).
- Calendar and time pickers for date fields.
- `depOwner` selector (BUSINESS / IT) that appears dynamically when a risk's level is set to DEP — hidden for all other levels.
- Checkbox-based project linking for risks (links by project id).
- Syntax-highlighted JSON preview before download.
- One-click download of updated `public/data/ctb_data.json`.

> **Note:** The `deepDiveLabel` field is not currently editable in the GUI editor. To set a custom button label, edit `public/data/ctb_data.json` directly and add `"deepDiveLabel": "your label"` to the project object.

**Portable Build (via scripts/Launcher.bat)**

- Self-contained single-file HTML output with JSON baked in — no server, no Python, no npm required to open.
- Date-stamped filename for easy archiving (`portable/CTB_Dashboard_Portable_YYYY-CWNN.html`, e.g. `portable/CTB_Dashboard_Portable_2026-CW21.html`).
- Auto-refresh and LIVE indicator disabled in portable mode to reflect that data is static.
- JSON validation run at build time — build fails cleanly with diagnostic output if the source data is malformed.

**Launcher (scripts/Launcher.bat and scripts/launcher.sh)**

- Menu-driven interface: launch live server, build portable, build-then-launch, or open editor (cross-platform).
- Windows: double-click `Launcher.bat`. Mac/Linux: run `./scripts/launcher.sh` from terminal.
- Automatic browser open after server start.
- Safe Ctrl+C handling — returns to menu without requiring terminal restart.
- Clear diagnostic output when Python is not found on PATH.
- Portable build in `launcher.sh` uses an embedded Python script (no external dependencies beyond Python 3).

---

## Verified Browser Compatibility

The dashboard uses standard HTML5, CSS3 (custom properties, grid, flexbox), and vanilla ES2020 JavaScript. No framework, no transpiler, no bundler.

| Browser | Version Tested | Result | Notes |
|---|---|---|---|
| Microsoft Edge | 124+ | ✅ Fully supported | Recommended for corporate environments |
| Google Chrome | 124+ | ✅ Fully supported | |
| Mozilla Firefox | 125+ | ✅ Fully supported | |
| Apple Safari | 17+ | ✅ Fully supported | macOS and iOS |
| Opera | 110+ | ✅ Fully supported | |
| Internet Explorer 11 | Any | ❌ Not supported | IE11 does not support CSS custom properties or async/await |
| Legacy Edge (EdgeHTML) | Any | ❌ Not supported | Pre-Chromium Edge retired by Microsoft |

> **Corporate standard:** If your organisation standardises on Microsoft Edge (Chromium), the dashboard will render identically for all recipients. No browser-specific CSS hacks or polyfills are present.

**CSS features in use:** `display:grid`, `display:flex`, CSS custom properties (`var(--…)`), `@keyframes`, `@media` queries, `::-webkit-scrollbar` pseudo-elements (with Firefox `scrollbar-width` fallback).

**JS features in use:** `async/await`, `fetch()`, `Array.forEach/map/filter`, template literals, optional chaining (`?.`), nullish coalescing (`??`), `RegExp`, `document.getElementById`.

---

## Known Constraints & Explicit Non-Scope

The following limitations are **by design** for this MVP phase. They are not bugs. Requests to extend the scope should be submitted as a feature request to the Dashboard Maintainer and prioritised against the roadmap.

### Data Entry is Manual

> **Data is entered by a human into `public/data/ctb_data.json` each week. There is no automatic data pull from any system.**

The dashboard does not connect to, read from, or write to:
- SAP (any module — S/4HANA, CRM, Solution Manager)
- Jira, Azure DevOps, or any issue tracking platform
- Microsoft Planner (the `deepDiveUrl` links *point to* Planner, but no data is read from it)
- SharePoint lists or Power Platform
- Any database or API

This is intentional for the MVP phase. Automated data ingestion requires API access negotiation, authentication, data mapping, and error handling that are out of scope for a lightweight reporting tool with a two-person maintenance team.

### No Write-Back Capability

The dashboard is strictly read-only. Users cannot update project status, add risks, or flag decisions from within the dashboard UI. All changes go through `public/data/ctb_data.json` via the editor or direct file edit.

### No Real-Time Collaboration

`public/data/ctb_data.json` cannot be co-authored. Only one person may edit the file at a time (see Data Governance guide). There is no conflict resolution, locking mechanism, or merge capability.

### No User Authentication

The dashboard has no login. Anyone who receives the portable file or has access to the server URL can view the content. Distribution control is the only access management mechanism (see Security Policy).

### No Notifications or Alerts

The dashboard does not send emails, Teams messages, or push notifications when:
- A project changes from GREEN to AMBER or RED.
- A decision item becomes overdue.
- The auto-refresh detects stale data.

These states are shown visually in the dashboard but generate no automated outbound communications.

### No Historical Trending

The dashboard shows only the current week's data snapshot. There are no trend arrows, week-on-week delta indicators, or historical charts. Past snapshots are available only via the archive files (see Data Governance guide) — not within the dashboard UI.

### No Mobile-Optimised Layout

The dashboard is responsive and usable on tablet-sized screens (≥780px). It is not optimised for smartphone viewports. The project matrix table, in particular, benefits from a landscape tablet or desktop display.

### No Attachment or Document Embedding

The dashboard cannot embed PDFs, Word documents, or other file types. Documents are referenced via `deepDiveUrl` links — they open in the browser or the appropriate application.

### Single Portfolio Only

The dashboard is designed to manage one portfolio (the SAP CRM CTB portfolio). Running multiple portfolios requires separate copies of all files in separate folders, each with their own `public/data/ctb_data.json`. There is no multi-portfolio aggregation view.

### Port Range 8080–8120 (Launcher)

The Launcher checks port 8080 first and increments up to 8120 until it finds an available port. The actual port used is displayed in the Launcher window and the browser is opened automatically to the correct URL. If all ports in the range are occupied, the server will fail to start with a clear diagnostic message. In this case, start the server manually on a port outside the range:
```
python -m http.server 9090
```
Then open `http://localhost:9090/public/dashboard.html`.

---

## Phase Roadmap (Indicative — Not Committed)

The following capabilities are under consideration for future phases. No delivery dates are committed.

| Capability | Description | Complexity |
|---|---|---|
| **Week-on-week delta indicators** | Arrow and colour delta showing RAG changes since last week | Medium |
| **Historical RAG trend sparklines** | Mini chart per project showing RAG history over 4–8 weeks | High |
| **SharePoint List integration** | Read project data from a SharePoint list instead of `public/data/ctb_data.json` | High |
| **Power Automate notification** | Teams/email alert when a project RAG deteriorates | Medium |
| **Multi-portfolio view** | Aggregate view across multiple CTB portfolios | High |
| **Role-based filtering** | Filter the matrix by phase, RAG status, or portfolio owner | Low |
| **Print / PDF export** | Formatted print stylesheet for A3/A4 paper output | Low |

---

*CTB Portfolio Dashboard · Release Notes & Known Constraints*
*SAP CRM Team · IT Leadership · Confidential-Internal*
*v1.1 · Last reviewed: CW21 · 28 May 2026*
