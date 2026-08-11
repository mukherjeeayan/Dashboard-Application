# Support & Escalation Matrix
### CTB Portfolio Dashboard — Incident Response Guide

> **Audience:** Reporting PMs, Portfolio Coordinator, Dashboard Maintainer
> **Purpose:** Immediate reference for resolving dashboard issues before and during portfolio review meetings
> **Last reviewed:** CW21 · 24 May 2026
> **Print this page and keep it accessible on Friday mornings.**

---

## Emergency Quick Reference (8:00 AM Scenarios)

If something has gone wrong with 5 minutes to go before the portfolio review:

```
WHITE SCREEN / WON'T LOAD?
  → Open public/data/ctb_data.json in Notepad
  → Copy all text → paste into jsonlint.com
  → Fix the highlighted error → save
  → Press F5 in the browser
  → If still broken: share the PREVIOUS WEEK's portable file as a fallback

LIVE SERVER NOT RUNNING?
  → Double-click scripts/Launcher.bat (Windows) or run ./scripts/launcher.sh (Mac/Linux) → choose option 1
  → If Python not found: open portable/CTB_Dashboard_Portable_*.html directly (last week's build)

WRONG DATA SHOWING?
  → If minor: note corrections verbally in the meeting
  → If significant: postpone the data section and fix after the meeting
  → Do NOT rush-edit the JSON with stakeholders waiting
```

---

## Escalation Matrix

### Scenario 1 — JSON Syntax Error / White Screen or Validation Screen

**Symptom:** The browser shows a white screen, a red error card saying "Cannot Load public/data/ctb_data.json", or a yellow validation screen listing errors.

| | Contact | Action | Target Resolution |
|---|---|---|---|
| **Primary** | Reporting PM (self-service) | Open `public/data/ctb_data.json` in Notepad or VS Code. Copy the full contents into [jsonlint.com](https://jsonlint.com). The error line is highlighted in red with a description. Fix the issue (typically a missing comma, extra comma, or unclosed bracket). Save the file and press F5 in the browser. | **10 minutes** |
| **Secondary** | Dashboard Maintainer | If the PM cannot identify or fix the JSON error, send the broken `public/data/ctb_data.json` to the Dashboard Maintainer via Teams. They will diagnose and return a corrected file. | **30 minutes** |
| **Fallback** | Portfolio Coordinator | While the fix is in progress, share the previous week's portable file (`CTB_Dashboard_Portable_*.html` from the archive) via Teams so the meeting can proceed with last week's data clearly labelled as such. | **Immediate** |

**Common JSON errors and fixes:**

| Error Message | Likely Cause | Fix |
|---|---|---|
| `Unexpected token }` | Extra comma after last item in array/object | Remove the comma before the `}` or `]` |
| `Unexpected token ,` | Two commas in a row, or comma before `}` | Remove the duplicate or misplaced comma |
| `Unexpected end of JSON` | Missing closing `}` or `]` | Count opening vs closing brackets — find the unclosed one |
| `Unexpected token <string>` | Missing comma between two objects | Add a comma after the `}` of the preceding item |

---

### Scenario 2 — Launcher / Build Script Failure

**Symptom:** Running the portable build option produces an error, or the portable file is not created.

| | Contact | Action | Target Resolution |
|---|---|---|---|
| **Primary** | Portfolio Coordinator (self-service) | Read the error output carefully. Common causes: (a) `public/data/ctb_data.json` has a JSON syntax error — fix it first and retry; (b) `public/dashboard.html` is missing or has been moved — confirm all files are in their correct directories (see File Structure in README.md); (c) PowerShell execution policy blocked the script — run `powershell -ExecutionPolicy Bypass` manually and retry. | **15 minutes** |
| **Secondary** | Dashboard Maintainer | If the error is not one of the above, send a screenshot of the full Launcher error output to the Dashboard Maintainer. They will diagnose the PowerShell issue. | **30 minutes** |
| **Escalation** | IT DevOps / Systems Admin | If the issue is an organisation-level PowerShell policy or group policy restriction preventing script execution, escalate to IT Operations for a policy exception or alternative execution method. | **Next business day** |
| **Fallback** | Use previous portable file | Distribute last week's portable file clearly marked as "Data as of [previous date] — CW[NN] build unavailable". | **Immediate** |

---

### Scenario 3 — UI or Data Mismatch (Wrong Calculations or Display)

**Symptom:** The dashboard loads successfully but the displayed data appears incorrect — e.g. the global RAG colour does not match expectations, project counts are wrong, a project is missing, or a decision due date shows an incorrect urgency state.

| | Contact | Action | Target Resolution |
|---|---|---|---|
| **Primary** | Portfolio Coordinator | Verify `public/data/ctb_data.json` against the PM inputs. The most common cause is a data entry error: incorrect `rag.overall` value driving a wrong global RAG; a `projectId` on a decision that does not match any project `id`; `affectedProjects` on a risk entry using an `id` instead of the project's display `name`; or a date in the wrong format (`DD-MM-YYYY` instead of `YYYY-MM-DD`). Fix the data file and refresh. Note: if the date error was entered via the GUI editor, the editor now displays a visible ⚠ warning in the date field for `DD-MM-YYYY` format — this should have been caught before download. | **Within the meeting** (minor) |
| **Secondary** | Dashboard Maintainer | If the data in `public/data/ctb_data.json` is correct but the dashboard is displaying it incorrectly, this may indicate a rendering bug. Document the specific mismatch (screenshot + the relevant JSON snippet) and send to the Dashboard Maintainer. | **Next reporting cycle** |
| **Escalation** | Portfolio Owner | If the mismatch has already been seen by leadership and affected a decision or discussion, notify the Portfolio Owner so they can issue a correction notice to the recipient list. | **Same day** |

---

### Scenario 4 — Python Server Won't Start / All Ports Busy

**Symptom:** The Launcher shows an error such as `ERROR: No available port found between 8080 and 8120` or the browser cannot connect after the Launcher starts.

| | Contact | Action | Target Resolution |
|---|---|---|---|
| **Primary** | Portfolio Coordinator (self-service) | The Launcher automatically scans ports 8080–8120 and uses the first available one. If the error above appears, all ports in that range are occupied. Close any application using those ports, then reopen the Launcher. To identify the process, open Task Manager → Details → find `python.exe` → End Task. Alternatively, start the server manually on a port outside the range: open Command Prompt, navigate to the dashboard folder (`cd /path/to/folder`), and run `python -m http.server 9090`. Open `http://localhost:9090/public/dashboard.html`. | **5 minutes** |
| **Fallback** | Open the last portable file | If the server cannot be started at all, open `portable/CTB_Dashboard_Portable_*.html` directly in the browser (double-click). This is a static snapshot — no Python server required. | **Immediate** |

---

### Scenario 5 — Browser Opens to Blank Page or "Site Can't Be Reached"

**Symptom:** The browser launches but the page is empty or shows a connection refused error.

| | Contact | Action | Target Resolution |
|---|---|---|---|
| **Primary** | Portfolio Coordinator (self-service) | The server may not have started yet (the Launcher adds a 2-second delay before opening the browser — wait a moment and refresh). If still blank: confirm the server is running by checking the Launcher window for the port confirmation message (e.g. "Port 8080 is available" followed by "Starting Python server on port 8080"). If not running, restart the Launcher. Confirm the URL matches the port shown in the Launcher window (e.g. `http://localhost:8080/public/dashboard.html`). | **2 minutes** |

---

### Scenario 6 — Confidential Data Shared in Error

**Symptom:** A portfolio file has been sent to an unintended recipient, shared via an unapproved channel, or a device containing the files has been lost.

| | Contact | Action | Target Resolution |
|---|---|---|---|
| **Immediate** | Portfolio Owner | Notify the Portfolio Owner within 1 hour of discovering the incident. Do not attempt to independently recall or remediate. | **1 hour** |
| **Immediate** | IT Security | Submit a formal incident report via your organisation's IT Security portal. | **2 hours** |
| **Follow-up** | Dashboard Maintainer | If a portable file needs to be rebuilt with a revised dataset to supersede the compromised version, the Maintainer coordinates this. | **As directed** |

See the **Security, Hosting & Distribution Policy** for full incident handling procedures.

---

### Scenario 7 — Editor Downloaded Example Data (Seed-Data Overwrite)

**Symptom:** The dashboard loads but shows stale or obviously wrong data — project names, milestones, and decisions do not match the current portfolio. Typically noticed immediately after someone used the editor.

| | Contact | Action | Target Resolution |
|---|---|---|---|
| **Primary** | Portfolio Coordinator (self-service) | The editor was used without importing the live `public/data/ctb_data.json` first. The seed-data warning banner was not heeded. Restore `public/data/ctb_data.json` from the SharePoint `/Archive` folder (most recent `CWNN_ctb_data.json` in the archive) or from the last portable file. If the overwritten file was the live copy, notify the Portfolio Owner. | **15 minutes** |
| **Prevention** | All editor users | When you open `public/ctb_editor.html`, always click **Import JSON** and select the current `public/data/ctb_data.json` before editing. The amber banner at the top of the editor is a mandatory reminder — do not dismiss it without importing first. | **On every session** |

---

## Contact Directory

> Complete this table with your organisation's actual contact details before distributing.

| Role | Name | Teams Handle | Phone / Mobile | Available |
|---|---|---|---|---|
| Dashboard Maintainer | `[Name]` | `@[handle]` | `[number]` | Business hours |
| Portfolio Coordinator | `[Name]` | `@[handle]` | `[number]` | Business hours |
| Portfolio Owner | `[Name]` | `@[handle]` | `[number]` | Business hours |
| IT DevOps / Systems Admin | `[Name]` | `@[handle]` | `[number]` | Business hours |
| IT Security (Incidents) | — | — | `[Helpdesk number]` | 24/7 |

---

## Self-Service Diagnostics Checklist

Run through this list before escalating any issue:

```
□ Is the Python server running? (Check Launcher window for confirmation message)
□ Is the URL correct? Check the Launcher window for the port in use (e.g. http://localhost:8080/public/dashboard.html)
□ Have I pressed F5 to force a refresh?
□ Are public/data/ctb_data.json and public/dashboard.html in their correct directories?
   (public/data/ for the JSON, public/ for the HTML)
□ Did I paste public/data/ctb_data.json into jsonlint.com and get "Valid JSON"?
□ Is there a previous week's portable file I can use as a fallback?
□ Has public/dashboard.html been accidentally modified?
   (Check file size — it should be similar to when it was first delivered)
```

If all boxes are checked and the issue persists, escalate to the Dashboard Maintainer with:
1. A screenshot of the error or incorrect display.
2. The current `public/data/ctb_data.json` file attached.
3. The exact text of any error message from the Launcher or browser console (F12 → Console tab).

---

*CTB Portfolio Dashboard · Support & Escalation Matrix*
*SAP CRM Team · IT Leadership · Confidential-Internal*
*Last reviewed: CW21 · 24 May 2026 · Review whenever team contacts change*
