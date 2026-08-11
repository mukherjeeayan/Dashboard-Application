# OpsReview Dashboard — Support & Escalation Guide

> **Document Type:** Support Reference
> **Applies To:** Data Preparers, Report Owners, Module Leads, and IT Support
> **Classification:** Internal – Restricted
> **Maintained by:** TCS Operations Team

---

## Table of Contents

1. [Support Overview](#1-support-overview)
2. [Self-Service Diagnostics](#2-self-service-diagnostics)
3. [Common Issues & Resolutions](#3-common-issues--resolutions)
4. [Error Messages Reference](#4-error-messages-reference)
5. [Data & Calculation Issues](#5-data--calculation-issues)
6. [Editor Issues](#6-editor-issues)
7. [Dashboard Display Issues](#7-dashboard-display-issues)
8. [Launcher & Server Issues](#8-launcher--server-issues)
9. [Portable Build Issues](#9-portable-build-issues)
10. [Configuration Issues](#10-configuration-issues)
11. [Escalation Paths](#11-escalation-paths)
12. [Escalation Template](#12-escalation-template)
13. [Support Contacts](#13-support-contacts)

---

## 1. Support Overview

OpsReview is a self-contained, client-side application. Because there is no backend server or database, the vast majority of issues can be diagnosed and resolved by the Data Preparer using this guide. Before escalating, work through the self-service diagnostics and the relevant issue section below.

**Support tiers:**

| Tier | Handled By | Covers |
|---|---|---|
| **Tier 0 — Self-Service** | Data Preparer | This guide covers all Tier 0 issues |
| **Tier 1 — Team Support** | Senior team member / Report Owner | Issues requiring access to source files or config |
| **Tier 2 — Technical Owner** | OpsReview system maintainer | Bugs, schema changes, code defects |
| **Tier 3 — Emergency** | Report Owner + IT | Data loss, security incidents, critical meeting blocker |

---

## 2. Self-Service Diagnostics

Run through this checklist before raising an issue with anyone else.

### Step 1 — Identify Which Tool Is Affected

- [ ] Is the problem in the **Editor** (`editor.html`)?
- [ ] Is the problem in the **Dashboard** (`dashboard.html`)?
- [ ] Is the problem in the **Launcher** (`.bat` / `.sh`)?
- [ ] Is the problem with the **data** (`ops_data.json` contents)?
- [ ] Is the problem with the **portable build**?

### Step 2 — Check the Browser Console

1. Open the affected page.
2. Press **F12** (or right-click → Inspect) to open Developer Tools.
3. Click the **Console** tab.
4. Look for red error messages. Copy the full error text — it is the single most useful piece of information when seeking help.

### Step 3 — Run the CLI Validator

```bash
node scripts/validate_data.js public/data/ops_data.json
```

This will print `PASS` or `FAIL` for each structural check. Resolve all `FAIL` items before proceeding.

### Step 4 — Try a Hard Refresh

Press **Ctrl+Shift+R** (Windows/Linux) or **Cmd+Shift+R** (macOS) to bypass the browser cache and reload all files fresh.

### Step 5 — Check File Paths

Confirm that the following files exist and are in the correct locations:

```
public/data/ops_data.json          ← must exist and be valid JSON
public/data/dashboard_config.json  ← must exist and be valid JSON
public/data/opsreview_config.json  ← must exist and be valid JSON
public/js/ops_dashboard.js         ← must exist
public/js/ops_editor.js            ← must exist
public/js/chart.umd.js             ← must exist
public/js/xlsx.full.min.js         ← must exist (editor only)
public/css/ops_dashboard.css       ← must exist
public/css/fonts.css               ← must exist
public/css/fonts/DM_Sans.woff2     ← must exist
```

---

## 3. Common Issues & Resolutions

### "Failed to Load Dashboard Data" screen appears

**Cause:** The dashboard is being opened as a `file://` URL directly (double-clicking `dashboard.html` from File Explorer / Finder).

**Resolution:** Use the launcher (`Launcher.bat` or `launcher.sh`) to start the Python server, then access via `http://localhost:PORT/dashboard.html`. Alternatively, use a portable build.

---

### Dashboard is blank / white after loading

**Cause:** `ops_data.json` or `dashboard_config.json` failed to parse (malformed JSON), or a required field is missing.

**Resolution:**
1. Open the browser console (F12). Look for a JSON parse error or a missing field warning.
2. Run `node scripts/validate_data.js public/data/ops_data.json`.
3. Paste `ops_data.json` into an online JSON validator (use an internal tool if your organisation does not permit external sites) to identify syntax errors.

---

### Module tab shows no data / all zeros

**Cause (most common):** The MoM arrays (`mom`, `respSlaMom`, etc.) for that module were not populated in the latest `ops_data.json`. This happens when no tickets were assigned to that module in the XLSX export, or when a new month's data was added without carrying forward historical arrays.

**Resolution:**
1. In the Editor, use **Load Previous JSON** to import last period's file.
2. Re-run calculations. The engine will carry forward the historical trend data.
3. If the module genuinely had zero tickets, the `mom` array should still advance (drop the oldest value, append `0`).

---

### KPI values in the dashboard don't match ServiceNow reports

**Cause:** Differences in date window, state filtering, or priority mapping between the ServiceNow report and the OpsReview calculation engine.

**Resolution:**
1. Check the date window of the XLSX export. It must cover the exact reporting month.
2. Check `stateMappings` in `opsreview_config.json`. Ensure the states used in the ServiceNow report match the mapped values (case-sensitive).
3. Check `mappings` — confirm the assignment group name in the XLSX exactly matches the key in `opsreview_config.json`.
4. If a discrepancy persists after these checks, use the KPI Override feature in the Editor's KPI Preview tab to correct the value and document the reason.

---

### SLA percentage shows as "N/A"

**Cause:** The `respSla` or `resolSla` field is `null` in `ops_data.json`. This occurs when no eligible tickets exist for that module in the period, or when the SLA fields in the XLSX export were empty/unparseable.

**Resolution:**
1. Check the XLSX for the module's SLA fields. Are they populated?
2. In the Editor's KPI Preview, manually enter the SLA value for that module.
3. If no SLA data exists for the period, `null` (displaying as "N/A") is correct and expected.

---

### Fonts are not rendering correctly (showing system fallback font)

**Cause:** The WOFF2 font files are missing from `public/css/fonts/`, or `fonts.css` is not being loaded.

**Resolution:**
1. Confirm all three `.woff2` files exist: `DM_Sans.woff2`, `DM_Mono_400.woff2`, `DM_Mono_500.woff2`.
2. Open the browser's Network tab (F12 → Network) and reload. Check for 404 errors on font files.
3. In server mode, confirm the Python server is serving from the correct `public/` root.

---

### Charts are not rendering / canvas is empty

**Cause:** `chart.umd.js` failed to load, or the canvas element was not found when the chart was initialised.

**Resolution:**
1. Check the browser console for a `Chart is not defined` error.
2. Confirm `public/js/chart.umd.js` exists and is not zero bytes.
3. Try switching to another tab and back — charts are re-initialised on tab switch.
4. Hard-refresh the page (Ctrl+Shift+R).

---

### The Editor does not respond to XLSX upload

**Cause:** The uploaded file is not a valid `.xlsx` format, or the SheetJS library failed to load.

**Resolution:**
1. Confirm `public/js/xlsx.full.min.js` exists and is not zero bytes.
2. Confirm the file being uploaded has a `.xlsx` extension (not `.xls`, `.csv`, or `.xlsm`).
3. Open the browser console and check for a SheetJS parse error.
4. Re-export the file from ServiceNow in `.xlsx` format and retry.

---

### Portable build opens but shows no data or is completely blank

**Cause:** The build script did not successfully inline `ops_data.json` or `dashboard_config.json`, or the inlined JSON was malformed.

**Resolution:**
1. Open the portable `.html` file in a text editor and search for `window.__OPS_DATA__`. Confirm it is followed by a `{` and a JSON object.
2. Search for `window.__OPS_CONFIG__`. Confirm it is present.
3. Re-run the build. Check the build output for `[FAIL]` messages.
4. Ensure `ops_data.json` is valid JSON before building (run the CLI validator first).

---

## 4. Error Messages Reference

| Message | Location | Meaning | Action |
|---|---|---|---|
| `Failed to Load Dashboard Data` | Dashboard screen | JSON fetch failed (file: URL or JSON parse error) | Use Python server or portable build |
| `ops_data.json has no schemaVersion — may be incompatible` | Browser console (warning) | `schemaVersion` field missing | Add `"schemaVersion": 1` to the root of `ops_data.json` |
| `Missing moduleSubLabels key: <key>` | Browser console (warning) | `dashboard_config.json` is missing a label key | Add the missing key to `labels.moduleSubLabels` in `dashboard_config.json` |
| `Chart is not defined` | Browser console (error) | `chart.umd.js` did not load | Check file exists in `public/js/`; hard refresh |
| `FAIL: schemaVersion is 1` | CLI validator | `schemaVersion` is not `1` | Set `schemaVersion` to `1` in `ops_data.json` |
| `FAIL: modules[N].mom length matches months` | CLI validator | MoM array length mismatch | Ensure the module's `mom` array has exactly the same number of elements as the `months` array |
| `FAIL: actionItems[N] has required fields` | CLI validator | An action item is missing `action`, `owner`, `dueDate`, or `status` | Fill in all required fields for the flagged action item |
| `Build failed -- skipping launch` | Launcher | PowerShell build script returned exit code 1 | Read the preceding `[FAIL]` message in the launcher window |
| `No available port found between 8080 and 8120` | Launcher | All ports are occupied | Close other local servers, or manually specify a port with `python -m http.server PORT -d public` |

---

## 5. Data & Calculation Issues

### Issue: A module is missing from the dashboard entirely

**Check 1:** The module's `domain` field in `ops_data.json` must be exactly `"SAP"` or `"NonERP"` (capital S/E/R). Any other value causes the module to be skipped.

**Check 2:** The module `id` in `ops_data.json → modules[]` must match a module defined in `opsreview_config.json → modules[]`. If they differ, the module will still render but may not receive calculated data.

**Check 3:** The `total` field must be a number (even if `0`). A `null` or missing `total` causes the module to fail the schema check.

---

### Issue: Priority distribution donut shows a single "Unknown" slice

**Cause:** The `priority` array is all zeros, or `priorityMeta` is empty/missing.

**Resolution:** In the Editor KPI Preview, check that the priority distribution was calculated. If the XLSX priority field uses values not in `opsreview_config.json → priorityMappings`, those tickets will fall into an "unknown" bucket. Update `priorityMappings` to match the exact text values in your ServiceNow export.

---

### Issue: MTTR seems unusually high for a module

**Possible causes:**
- Tickets from previous periods that were not resolved until this period are being included, inflating MTTR.
- The `resolvedDate` field in the XLSX is empty for some tickets, causing the engine to use a fallback date.
- A small number of very old tickets is skewing the mean.

**Resolution:** Filter the XLSX to only include tickets created and resolved within the reporting month. Check for outliers by reviewing the oldest resolved dates in the export. The MTTR field can be manually overridden in KPI Preview if the calculated value is demonstrably incorrect.

---

## 6. Editor Issues

### Issue: Undo (Ctrl+Z) is not working

Undo is supported for manual data entry sections (Action Items, Escalations, Projects, CI, Appreciations, Service Offers). It does not apply to configuration changes or XLSX import. Ensure the editor tab is focused when pressing Ctrl+Z.

---

### Issue: Config Lock is on and I cannot change thresholds

Click the **Config Lock** button (padlock icon) in the Configuration panel to toggle the lock off. The label will change from "Locked" to "Unlocked". Make your changes, then re-lock when done.

---

### Issue: "Please upload both Incidents and Service Requests" when navigating to KPI Preview

The KPI Preview tab requires at least Incidents and Service Requests XLSX files to have been imported and calculated. Either upload both files and run the calculation, or use **Load Previous JSON** from the top bar to load an existing `ops_data.json` that already contains calculated data.

---

## 7. Dashboard Display Issues

### Issue: Dark/light theme switch is not persisting

The theme is stored in `localStorage` under the key `ops-theme`. If `localStorage` is disabled in the browser (e.g. in Private/Incognito mode), the preference will not persist across sessions. This is expected behaviour.

---

### Issue: Print output is missing charts or cuts off tables

- Use Chrome or Edge for best print output. Firefox and Safari have varying levels of print CSS support.
- Before printing, click the print icon in the toolbar (not the browser's File → Print). This triggers a print-optimised layout.
- Ensure "Background graphics" is enabled in the browser print dialog for coloured cells and RAG indicators to appear.

---

## 8. Launcher & Server Issues

### Issue: `Launcher.bat` shows "Python was not found"

Python 3 is not installed or not on the system PATH.

**Resolution:**
1. Install Python 3 from [python.org](https://www.python.org) (download the installer with the "Add Python to PATH" checkbox ticked).
2. Close and reopen the command prompt, then retry.
3. Alternatively, start the server manually: `python -m http.server 8080 -d public` from the project root.

---

### Issue: `launcher.sh` shows "Permission denied"

The script does not have execute permission.

**Resolution:**
```bash
chmod +x scripts/launcher.sh
./scripts/launcher.sh
```

---

### Issue: Browser does not open automatically after launcher starts the server

The launcher uses `start` (Windows) or `xdg-open`/`open` (Unix) to open the default browser. If these commands are not available or the default browser is misconfigured, open the URL manually.

The URL will be printed in the launcher window: `http://localhost:<PORT>/dashboard.html`

---

## 9. Portable Build Issues

### Issue: Build completes but the portable file is only a few KB (clearly wrong)

**Cause:** The build script silently failed to inline one or more assets. On Windows, this can happen if PowerShell execution policy prevents the embedded PS1 block from running.

**Resolution:**
```powershell
# Run in PowerShell as Administrator
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Then retry the build via the launcher.

---

### Issue: Fonts appear as boxes or question marks in the portable build

**Cause:** WOFF2 Base64 encoding failed, or the font file paths in `fonts.css` do not match the actual file names.

**Resolution:**
1. Open `public/css/fonts.css` and check the `src: url('fonts/FILENAME.woff2')` references.
2. Confirm those exact filenames exist in `public/css/fonts/`.
3. File names are case-sensitive on Unix. `DM_Sans.woff2` and `dm_sans.woff2` are different files.

---

## 10. Configuration Issues

### Issue: A new assignment group is not being mapped to any module

The `mappings` object in `opsreview_config.json` maps assignment group names (exactly as they appear in ServiceNow) to module IDs. If a new assignment group was created in ServiceNow and is not in the mappings, its tickets will be counted in the XLSX but not assigned to any module.

**Resolution:**
1. Note the exact assignment group name from the XLSX (copy from the cell, do not retype — it may have invisible spaces or different capitalisation).
2. Add an entry to `opsreview_config.json → mappings`: `"EXACT_GROUP_NAME": "moduleId"`.
3. Save the config, re-upload it in the Editor, and re-run calculations.

---

### Issue: RAG colours seem inverted for one metric

Check the `invert` flag in `opsreview_config.json → ragThresholds`. Metrics where a higher value is better (like SLA % and First-Fix Rate) use `"invert": true` so that the green/amber thresholds are applied in the correct direction.

---

## 11. Escalation Paths

Use this decision tree to determine the appropriate escalation path:

```
Is the issue blocking the governance review meeting today?
│
├─ YES ──► Tier 3 Emergency (contact Report Owner immediately by phone)
│
└─ NO
   │
   ├─ Is the issue a data accuracy concern (wrong KPI values)?
   │   ├─ YES ──► Tier 1 (Module Lead + Data Preparer)
   │   └─ NO
   │
   ├─ Is the issue a code defect or unexpected application behaviour?
   │   ├─ YES ──► Tier 2 (Technical Owner — log in the defect tracker)
   │   └─ NO
   │
   ├─ Is the issue a configuration question (thresholds, mappings)?
   │   ├─ YES ──► Tier 1 (Configuration Owner)
   │   └─ NO
   │
   └─ Default ──► Tier 0 (consult this guide, then Tier 1 if unresolved)
```

---

## 12. Escalation Template

When raising an issue with Tier 1 or Tier 2 support, include all of the following:

```
OPSREVIEW SUPPORT REQUEST
─────────────────────────────────────────────
Date/Time of Issue:
Reporter Name & Role:
Urgency (Meeting Blocker / High / Normal):

Tool Affected:
  [ ] Editor   [ ] Dashboard   [ ] Launcher   [ ] Portable Build   [ ] Data/Config

Steps to Reproduce:
1.
2.
3.

Expected Behaviour:

Actual Behaviour:

Browser & Version (if applicable):

Error Message (exact text or screenshot):

Console Output (F12 → Console — paste full error):

Files Involved (list file names and whether they can be shared):

CLI Validator Output (paste full output):
  node scripts/validate_data.js public/data/ops_data.json

Actions Already Attempted:

Reporting Period Affected:
```

---

## 13. Support Contacts

> **Note:** Update this section with your organisation's actual contact details before distributing this document.

| Role | Name | Contact | Availability |
|---|---|---|---|
| **Report Owner / Portfolio Owner** | TCS Operations Lead | [email] | Business hours |
| **Data Preparer (Primary)** | [Name] | [email / Teams] | Business hours |
| **Data Preparer (Backup)** | [Name] | [email / Teams] | Business hours |
| **Configuration Owner** | [Name] | [email / Teams] | Business hours |
| **Technical Owner (OpsReview App)** | [Name] | [email / Teams] | Business hours |
| **IT / Security (Incidents)** | IT Helpdesk | [email / phone] | 24×7 for security |

For **meeting-blocking emergencies on the day of the governance review**, contact the Report Owner directly by phone. Do not rely solely on email.
