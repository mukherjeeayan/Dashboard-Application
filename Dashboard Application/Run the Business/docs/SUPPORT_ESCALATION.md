# Support & Escalation Matrix

**Application:** SAP CRM · ServiceNow Weekly IT Operations Dashboard
**Owner:** IT Portfolio Management Office
**Audience:** Data Steward, IT Portfolio Manager, IT Operations Lead

---

## 1. Emergency Runbooks — Pre-Meeting Scenarios

These runbooks are designed for situations occurring **within 60 minutes of a live executive review meeting**. Follow each step in exact sequence. Do not improvise additional steps unless explicitly directed.

---

### Scenario A — Dashboard Fails to Load / Shows Error Overlay

**Symptom:** Browser displays a dark screen with the message "⚠ Failed to load dashboard data" and a red error text showing `HTTP 404` or a network/fetch error.

**Root cause:** The `fetch()` call in `boot()` could not retrieve `data/snow_weekly.json`. This occurs when the dashboard is opened directly from the filesystem (`file://` protocol) rather than via the Python HTTP server, when the server is not running, or when `snow_weekly.json` is missing from the `public/data/` directory.

**Resolution steps:**

```
Step 1 → Close the browser tab showing the error.

Step 2 → Double-click scripts\Launcher.bat.

Step 3 → Enter 1 and press Enter.
          The launcher checks ports 8080–8120 and starts the Python server.

Step 4 → Wait for the message:
          "Server URL : http://localhost:<PORT>/snow_dashboard.html"
          The browser will open automatically after 2 seconds.

Step 5 → Verify the dashboard renders fully (masthead, KPI tiles, sections).

Step 6 → If the browser does NOT open automatically:
          Open manually: http://localhost:<PORT>/snow_dashboard.html
          (Use the port number printed in the terminal — typically 8080.)

Step 7 → If Step 3 fails with "Python was not found":
          a. Open a browser.
          b. Use the PORTABLE BUILD instead (see Scenario A — Fallback below).
```

**Scenario A — Fallback (no Python available):**

```
Step 1 → Double-click scripts\Launcher.bat.

Step 2 → Enter 2 and press Enter (Build Portable).
          If the launcher itself cannot run, proceed to Step 3.

Step 3 → If a portable build already exists in portable\:
          Double-click the most recent SNOW_Weekly_Dashboard_Portable_*.html file.
          Open it directly in the browser (no server required).

Step 4 → Verify all KPI values and charts are visible and correct.

Step 5 → Proceed to the meeting with the portable file open in the browser.

Step 6 → After the meeting, investigate and resolve the Python installation issue.
```

---

### Scenario B — JSON Schema / Parse Error (Red Validation Screen)

**Symptom:** Browser shows the error overlay with a message such as `Unexpected token ',' at position 847` or `JSON.parse error`. The launcher Build option exits with `ERROR: snow_weekly.json contains a syntax error`.

**Root cause:** `snow_weekly.json` contains a JSON syntax violation introduced during the weekly edit. Common causes are listed in Section 2 below.

**Resolution steps:**

```
Step 1 → Open public\data\snow_weekly.json in VS Code or Notepad++.
          Do NOT use Windows Notepad — it may silently corrupt UTF-8 files.

Step 2 → In VS Code: press Ctrl+Shift+P → type "Format Document" → Enter.
          VS Code will highlight the first syntax error with a red underline.
          The error location is shown in the status bar (line:column).

Step 3 → Fix the error. Refer to the Syntax Fault Matrix in Section 2 for
          the exact pattern and correction for common fault types.

Step 4 → Save the file (Ctrl+S).

Step 5 → In VS Code, install and run the "JSON" validator:
          Press Ctrl+Shift+P → "JSON: Validate" or check the Problems panel (Ctrl+Shift+M).
          Confirm zero errors before proceeding.

Step 6 → Return to scripts\Launcher.bat → Enter 1 → verify dashboard loads.

Step 7 → If the error persists and cannot be resolved in under 10 minutes:
          a. Restore the most recent archive file:
             Copy archive\CW{NN-1}_{date}_snow_weekly.json
             to public\data\snow_weekly.json
             (This restores last week's data — values will be one week old.)
          b. Run Launcher.bat → option 1 to verify the restored file loads.
          c. Inform meeting attendees that data reflects the prior reporting week.
          d. Schedule a post-meeting correction and re-distribution.
```

---

### Scenario C — Port Conflict (Server Refuses to Start)

**Symptom:** Launcher exits immediately with "No available port found between 8080 and 8120" or the Python server starts but the browser shows "Connection Refused".

**Resolution steps:**

```
Step 1 → In the Launcher terminal window, note the error message.

Step 2 → Open a new Command Prompt and run:
          netstat -ano | findstr ":808"
          This lists all processes using ports starting with 808x.

Step 3 → Identify the PID (last column) of the conflicting process.
          Run: tasklist | findstr <PID>
          This shows the process name.

Step 4 → If the conflicting process is a previous Python server instance:
          Run: taskkill /PID <PID> /F
          Then re-run Launcher.bat → option 1.

Step 5 → If the process cannot be killed (insufficient permissions):
          Use the Portable Build fallback (Scenario A — Fallback, above).
          Or wait for the conflicting application to release the port.

Step 6 → If PowerShell execution policy blocks the embedded build script:
          Open PowerShell as Administrator and run:
          Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
          Then re-run Launcher.bat.
```

---

## 2. Syntax Fault Matrix

The following table documents all commonly observed JSON syntax violations in `snow_weekly.json`, with exact diagnostic patterns and corrected replacements.

| Fault Type | Symptom / Parser Message | Faulty Example | Corrected Example |
|---|---|---|---|
| Trailing comma after last array item | `Unexpected token ]` near a `]` | `"data": [12, 9, 11,]` | `"data": [12, 9, 11]` |
| Trailing comma after last object property | `Unexpected token }` near a `}` | `"value": "91%",}` | `"value": "91%"}` |
| Unescaped double quote inside string | `Unexpected token` mid-string | `"text": "Team said "no""` | `"text": "Team said \"no\""` |
| Single quotes used instead of double | `Unexpected token '` | `'label': 'Open'` | `"label": "Open"` |
| Missing comma between array items | `Unexpected token {` | `[{"a":1}{"b":2}]` | `[{"a":1},{"b":2}]` |
| Missing comma between object properties | `Unexpected token "` mid-object | `{"a":1 "b":2}` | `{"a":1,"b":2}` |
| Unescaped backslash in string | `Unexpected token` | `"path": "C:\data\file"` | `"path": "C:\\data\\file"` |
| Unescaped newline in string | `Unterminated string literal` | `"text": "line one` *(actual newline)* `line two"` | `"text": "line one line two"` (remove newline) |
| Numeric value quoted where integer expected | Renders as `"NaN"` in KPI tile | `"bar_pct": "85"` | `"bar_pct": 85` |
| Boolean value quoted | Logic inversion silently fails | `"invert_delta": "true"` | `"invert_delta": true` |
| Missing required key | Section renders blank | `{ "label": "Open" }` (missing `value`) | `{ "label": "Open", "value": "118" }` |
| `null` where array expected | `Cannot read properties of null` | `"items": null` | `"items": []` |
| Invalid colour key | `console.warn` + falls back to muted | `"color": "orange"` | `"color": "amber"` |
| Invalid delta_dir value | Delta renders `—` regardless of intent | `"delta_dir": "decrease"` | `"delta_dir": "down"` |
| Invalid rag value | RAG dot renders without colour | `"rag": "yellow"` | `"rag": "amber"` |

---

## 3. Pre-Flight Verification Checklist

Complete this checklist before every Friday distribution. Each item requires a visual check in the live browser, not just a review of the JSON file.

```
PRE-FLIGHT CHECKLIST — W{NN} {YEAR} Distribution
──────────────────────────────────────────────────
Data Steward: ____________________
Reviewer:     ____________________
Date:         ____________________

[ ] 1. Launcher.bat → option 1 starts without error.
        Server URL confirmed: http://localhost:____/snow_dashboard.html

[ ] 2. Masthead shows correct week label:
        Expected: W{NN}  Actual: ____

[ ] 3. Masthead shows correct week range:
        Expected: {date range}  Actual: ____

[ ] 4. Masthead shows correct "Data as of" timestamp:
        Expected: {datetime}  Actual: ____

[ ] 5. KPI — Open Incidents value matches ServiceNow export:
        Expected: ____  Actual: ____

[ ] 6. KPI — Service Requests value matches ServiceNow export:
        Expected: ____  Actual: ____

[ ] 7. KPI — RFAC / Changes value matches ServiceNow export:
        Expected: ____  Actual: ____

[ ] 8. KPI — Problems (PRB) value matches ServiceNow export:
        Expected: ____  Actual: ____

[ ] 9. KPI — P1 / Critical value matches ServiceNow export:
        Expected: ____  Actual: ____

[ ] 10. KPI — SLA Compliance value matches ServiceNow SLA report:
         Expected: ____  Actual: ____

[ ] 11. All four ServiceNow navigation card RAG statuses reviewed
         and confirmed as intentional (not default green from prior week).

[ ] 12. 8-week trend chart — leftmost label is W{NN-7}, rightmost is W{NN}.
         Labels correct: Yes / No

[ ] 13. Intervention section — items reflect THIS week's escalations
         (not carried forward from prior week without review).

[ ] 14. Commentary section — author and "Updated:" date are current.

[ ] 15. Launcher.bat → option 2 completes without error.
         Output file confirmed in portable\ directory:
         SNOW_Weekly_Dashboard_Portable_{YYYY}-CW{NN}.html

[ ] 16. Portable file opened directly in browser (no server) —
         all charts and data visible and correct.

[ ] 17. Archive copy saved:
         archive\CW{NN}_{YYYY}-{MM}-{DD}_snow_weekly.json

[ ] 18. Distribution LOCK broadcast sent and confirmed (if not already).

Reviewer sign-off: ____________________ Date: ____________
```

---

## 4. Accidental Public Distribution — 2-Hour Response Protocol

If a **Highly Confidential** build file (`snow_weekly.json`, portable HTML, or archive) is confirmed or suspected to have been distributed via a prohibited channel (public file share, personal cloud storage, external email, etc.), the following protocol must be initiated **immediately**:

```
T+0 min  IDENTIFY
         Confirm the asset, the prohibited channel, and the approximate
         time of upload/send. Screenshot evidence if possible.

T+5 min  CONTAIN
         Immediately delete or retract the shared file or link:
         - Email: recall the message via Outlook (Message → Actions → Recall).
         - Cloud share: revoke the share link and delete the file.
         - Teams: delete the message and file.
         Note: deletion does not guarantee the recipient has not already
         downloaded the file. Assume compromise.

T+10 min NOTIFY
         Contact the IT Security Operations team via the corporate
         security incident hotline. Do not notify the recipient of the
         accidental share until advised by Security Operations.
         Notify the IT Portfolio Management Lead immediately.

T+20 min DOCUMENT
         Complete a written incident record including:
         - Asset name and classification
         - Prohibited channel used
         - Timestamp of disclosure
         - Recipients or audience (if known)
         - Actions taken so far

T+60 min ASSESS
         IT Security Operations assesses the disclosure scope:
         - Internal-only recipients (lower risk): monitor and log.
         - External recipients or public access confirmed: invoke the
           corporate data breach response procedure.

T+120 min CLOSE OR ESCALATE
          If no external exposure is confirmed: document the incident,
          close with lessons-learned note, update team procedures.
          If external exposure is confirmed: escalate per the corporate
          breach response procedure. Do not close the incident internally.
```

---

## 5. Support Contact Escalation Path

| Severity | Scenario | First Contact | Second Contact |
|---|---|---|---|
| P1 — Meeting imminent (< 60 min) | Dashboard fails to load or render | Data Steward — immediate self-resolution via Runbooks above | IT Portfolio Management Lead |
| P1 — Data breach | Confidential asset distributed via prohibited channel | IT Security Operations — immediate | IT Portfolio Management Lead |
| P2 — Pre-release (> 2 hours to meeting) | JSON syntax error cannot be resolved | Data Steward → Reviewer → IT Portfolio Engineer | — |
| P3 — Post-meeting | Chart renders incorrectly; KPI value mismatch discovered after distribution | Data Steward corrects JSON; re-distributes corrected portable file | Notify distribution list of correction |
| P4 — Enhancement | New field type, layout change, or feature request | Raise via standard IT Portfolio Engineering change request | — |

---

*Document version 1.0 · Generated 2026-05-28 · IT Portfolio Management Office*
