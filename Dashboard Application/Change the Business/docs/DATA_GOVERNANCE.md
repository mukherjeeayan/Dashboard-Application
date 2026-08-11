# Data Governance & Lifecycle Guide
### The PM Playbook — CTB Portfolio Dashboard

> **Audience:** Reporting PMs, Portfolio Coordinators, Dashboard Maintainer
> **Applies to:** All updates to `public/data/ctb_data.json` and all portable build executions
> **Effective from:** CW20 · May 2026 · First published reporting cycle
> **Last reviewed:** CW21 · 24 May 2026

---

## Table of Contents

1. [Principles of Data Stewardship](#1-principles-of-data-stewardship)
2. [Roles & Responsibilities](#2-roles--responsibilities)
3. [The Friday Cut-off Workflow](#3-the-friday-cut-off-workflow)
4. [Version Control & Archiving Strategy](#4-version-control--archiving-strategy)
5. [Concurrent Editing Safeguards](#5-concurrent-editing-safeguards)
6. [JSON Quality Checklist (Pre-Submission)](#6-json-quality-checklist-pre-submission)
7. [Update Cadence for Each Data Section](#7-update-cadence-for-each-data-section)
8. [Change Log Discipline](#8-change-log-discipline)

---

## 1. Principles of Data Stewardship

The CTB Portfolio Dashboard has **no database, no write-back API, and no version history** of its own. Everything displayed to IT Leadership derives from a single file — `public/data/ctb_data.json`. This means:

- A single misplaced comma blocks the entire dashboard.
- An overwritten file has no automatic recovery path.
- Stale or incorrect data is presented as fact until someone notices and corrects it.

These risks are entirely manageable with the lightweight protocols in this guide. The discipline required is minimal; the downside of ignoring it is significant.

**Three non-negotiable rules:**
1. **One editor at a time.** `public/data/ctb_data.json` is never edited by two people simultaneously.
2. **Archive before editing.** A copy of the current week's file is saved before any changes are made.
3. **Validate before publishing.** JSON is checked for syntax errors before the portable file is built or the dashboard server is restarted.

---

## 2. Roles & Responsibilities

| Role | Person(s) | Responsibility |
|---|---|---|
| **Reporting PM** | Project managers per workstream | Provide updated status, RAG, comments, and milestone data by the Thursday cut-off. |
| **Portfolio Coordinator** | Dashboard update lead (rotating or fixed) | Consolidates PM inputs into `public/data/ctb_data.json`, validates syntax, runs the build, and distributes the portable file. |
| **Dashboard Maintainer** | SAP CRM Technical Lead | Owns `public/dashboard.html`, `public/ctb_editor.html`, `scripts/Launcher.bat`, and `scripts/launcher.sh`. The single point of contact for any structural or technical issues with the dashboard itself. |
| **Portfolio Owner** | SAP CRM Team Lead | Final sign-off authority on what is published. Approves content before Friday distribution. |

---

## 3. The Friday Cut-off Workflow

The following timeline applies to every standard reporting cycle. Adjust dates for weeks with public holidays.

```
THURSDAY
─────────────────────────────────────────────────────────────────
14:00  PMs submit status updates
       Each PM provides (via Teams message or shared notes):
         • RAG for each dimension (schedule / budget / scope / quality / overall)
         • scheduleVariance and scheduleStatus
         • nextMilestone text
         • comment / narrative
         • Any new risks, milestones, or decisions to add or close
         • Any changes to deepDiveUrl links

17:00  Portfolio Coordinator input deadline
       All PM updates must be received by this time.
       Late submissions default to carrying forward last week's data,
       with a note added to the project comment field.

FRIDAY
─────────────────────────────────────────────────────────────────
08:00  Portfolio Coordinator begins data update
       Step 1 — Archive current file (see Section 4)
        Step 2 — Open public/ctb_editor.html OR edit public/data/ctb_data.json directly
       Step 3 — Apply all PM updates
       Step 4 — Update meta.period, meta.reportDate, meta.lastUpdated
       Step 5 — Update pulse.keyFlag with this week's headline

09:00  Validation pass
       Step 6 — Paste public/data/ctb_data.json into https://jsonlint.com
                 → Resolve ALL errors before proceeding
       Step 7 — Start the live server (Launcher → option 1)
                 → Review the dashboard visually for obvious data issues
                 → Confirm global RAG matches expectations
                 → Confirm all project counts are correct

09:30  Portfolio Owner review
       Step 8 — Portfolio Owner reviews the live dashboard
                 → Any correction requests fed back to Coordinator
                 → Changes applied and dashboard re-reviewed

09:45  Build & distribute
       Step 9 — Run Launcher → option 2 (Build Portable)
       Step 10 — Rename if needed; confirm date stamp on filename
                   (e.g. portable/CTB_Dashboard_Portable_2026-CW20.html)
       Step 11 — Share via IT Leadership Teams channel (see Security Policy)
       Step 12 — Copy the final public/data/ctb_data.json to the archive (see Section 4)

10:00  Distribution deadline
       The portable file must reach all stakeholders by this time,
       ahead of any standing Friday portfolio review meetings.
```

---

## 4. Version Control & Archiving Strategy

### Option A — SharePoint Archive (Recommended for most teams)

Maintain a dedicated archive folder in the team SharePoint site with the following structure:

```
📁 SAP CRM · CTB Portfolio (SharePoint)
├── 📁 Live
│   ├── public/dashboard.html        ← Never change
│   ├── public/ctb_editor.html           ← Never change
│   ├── public/data/ctb_data.json             ← Current week's data (single source of truth)
│       ├── scripts/Launcher.bat              ← Never change (Windows)
    └── scripts/launcher.sh               ← Never change (Mac/Linux)
│
└── 📁 Archive
    └── 📁 2026
        ├── CW20_ctb_data.json
        ├── CW21_ctb_data.json
        ├── CW22_ctb_data.json
        └── ...
```

**Naming convention:** `CWNN_ctb_data.json` where `NN` is the two-digit ISO calendar week number.

**Archive rule:** Copy (do not move) `public/data/ctb_data.json` from the `/Live` folder to `/Archive/YYYY/` **before** making any changes for the new week. Never delete archive files.

### Option B — Git Repository (Recommended for technical teams)

If your team uses Git (Azure DevOps, GitHub Enterprise, or similar), maintain the dashboard in a repository with the following branch and commit convention:

```
Repository: ctb-portfolio-dashboard
├── main                         ← Always contains the current published state
└── archive/2026/CW20            ← One branch per calendar week (read-only after publish)
```

**Commit message convention:**
```
CW20 · Weekly update — May 2026 [Portfolio Coordinator initials]

Updated projects: E-Invoicing, Asset Care
Changes: RAG updated, new milestone added for AssetCare go-live
Risks: Added cross-team dependency for Loaner Improvement
```

**Branch creation (before Friday edits):**
```bash
git checkout main
git pull origin main
git checkout -b archive/2026/CW20
git push origin archive/2026/CW20
git checkout main
# Now make your edits to public/data/ctb_data.json on main
```

This creates an immutable snapshot of last week's data on its own branch before any changes are made.

### Retention Policy

Archive files are retained for a minimum of **12 months** from the date of publication. Files older than 12 months may be moved to cold storage (SharePoint Recycle Bin with extended retention, or a `_cold` subfolder) but must not be deleted without Portfolio Owner approval.

---

## 5. Concurrent Editing Safeguards

`public/data/ctb_data.json` is a plain text file. It has **no locking mechanism** — if two people open and save it simultaneously, the second save silently overwrites the first with no merge, no warning, and no recovery.

### The Golden Rule

> **Only one person edits `public/data/ctb_data.json` at any given time.**
> This is a social contract, not a technical enforcement. It must be respected by all team members.

### Protocol

**Before opening the file to edit:**

Post a message in the team's designated coordination channel (e.g. a pinned Teams thread titled "CTB Dashboard — Editing Lock"):

> ✏️ **[Name] — Editing public/data/ctb_data.json now. Please wait before making any changes.**

**After saving and closing:**

> ✅ **[Name] — Editing complete. File is free.**

**If you need to make urgent corrections while someone else is editing:**

Contact the current editor directly via Teams or phone. Give them your change verbally or in writing — they apply it as part of their current session and confirm when done.

### Using the GUI Editor

`public/ctb_editor.html` works with an in-memory copy of the data and only writes to disk when you click **Download JSON**. This does not eliminate the concurrent editing risk — if two people each download a modified JSON and one replaces the other's version, changes are lost. The same single-editor protocol applies.

> ⚠️ **Always import before editing.** `public/ctb_editor.html` loads example seed data on open and shows an amber warning banner. Click **Import JSON** and select the current `public/data/ctb_data.json` from the `/Live` SharePoint folder (or your local working copy) before making any changes. Downloading without importing first will overwrite live data with the editor's built-in example data.

### SharePoint Co-authoring Note

SharePoint does **not** support co-authoring of `.json` files the way it does for Word documents. Do not assume SharePoint's version history provides a real-time safety net for in-progress edits — it snapshots on save, and a conflicted save can still overwrite data. Always follow the check-in/check-out protocol above.

---

## 6. JSON Quality Checklist (Pre-Submission)

Complete this checklist before executing the portable build or restarting the live server.

```
PRE-BUILD QUALITY GATE
───────────────────────────────────────────────────────────
□  meta.period reflects the correct calendar week
□  meta.reportDate reflects today's date
□  meta.lastUpdated is set to the current date/time (ISO format)
□  pulse.keyFlag contains the correct headline for this week
   (or is empty "" if no announcement)

FOR EACH PROJECT:
□  rag.overall is set and reflects the project's true health
□  rag.schedule / budget / scope / quality are all set
□  scheduleStatus and scheduleVariance are consistent with rag.schedule
□  nextMilestone is current (remove past milestones from this field)
□  comment reflects this week's status, not last week's

RISKS:
□  Closed risks have been removed
□  New risks added with correct level and affectedProjects (use project ids, not display names)
□  DEP-level risks: set depOwner to "BUSINESS" or "IT" if the owning party is known

MILESTONES:
□  Past milestones have been removed (or retained deliberately)
□  New milestones added with correct date (YYYY-MM-DD format)

DECISIONS:
□  Resolved decisions have been removed
□  New asks added with correct projectId and dueDate

VALIDATION:
□  Full JSON pasted into jsonlint.com — result: VALID JSON ✓
     (jsonlint.com checks syntax only — commas, brackets, quotes)
□  Live server started and dashboard opened — check the validation screen
     The dashboard validator goes further: it checks RAG values, phase names,
     sub-phase matches, date formats, and projectId links. Fix any errors
     shown before distributing. Warnings may be acknowledged via "Load Anyway".
□  Global RAG colour matches expected portfolio health
□  Project count in Section B matches actual number of active projects
□  No STALE indicator visible after initial load

SIGN-OFF:
□  Portfolio Owner has reviewed and approved content
□  Build executed successfully (no PowerShell errors)
□  Output file date stamp confirmed correct (CWNN)
───────────────────────────────────────────────────────────
```

---

## 7. Update Cadence for Each Data Section

Not all sections require updates every week. Use this guide to understand expected frequency.

| Section | Typical Update Frequency | Notes |
|---|---|---|
| `meta` | Every week | Period, reportDate, and lastUpdated must change every cycle. |
| `pulse.keyFlag` | Every week | Either update the headline or clear it. Never carry forward last week's flag verbatim. |
| `projects[].rag` | Every week | All five RAG fields must be actively reviewed each cycle, even if unchanged. |
| `projects[].comment` | Every week | Comments must be current. A comment dated from a previous period is misleading. |
| `projects[].scheduleVariance` | Every week | Update to reflect the current schedule position. |
| `projects[].nextMilestone` | As milestones pass or change | Remove past milestones; update upcoming ones. |
| `risks` | As new risks emerge or close | Do not accumulate stale risks. Close a risk by deleting its entry when it is resolved. |
| `milestones` | As new milestones are confirmed | Past milestones may be removed after they pass unless retained for audit purposes. |
| `decisions` | As asks open or close | Remove a decision when it has been actioned. Add a new one as soon as a new ask is identified — do not wait until Friday. |
| `projects[].deepDiveUrl` | When the linked resource changes | Verify links quarterly; Teams Planner links can expire. |

---

## 8. Change Log Discipline

Maintain a brief human-readable log of significant changes made to the data file each week. This is separate from Git commit messages and serves as an audit trail for stakeholders.

Maintain a `CHANGELOG.txt` file in the project root folder (see File Structure in README.md):

```
───────────────────────────────────────────────────────────
CW21 · 23 May 2026 · Updated by: [Coordinator Initials]
───────────────────────────────────────────────────────────
Changes:
  - E-Invoicing OFR: comment updated post-kickoff (21 May confirmed complete)
  - Asset Care: comment updated post-kickoff (21 May confirmed complete)
  - OSTE Mercoline OFR: nextMilestone confirmed — go live 3 Jun 2026
  - Loaner Improvement: nextMilestone updated to reflect SIT start (15 Jun)
  - CDS After Repair: risk WATCH updated — UAT feedback scope still pending
  - New risk added: CPI integration dependency (DEP level, Business type)
  - Milestone confirmed: Loaner 3 RFAC dev checkpoint — 12 Jun 2026
  - Decision closed: Legal text for Like-to-Like devices (resolved)
  - Decision updated: Resource allocation sign-off for Loaner (due 10 Jun)
  - pulse.keyFlag updated with CW21 headline
Portfolio Owner sign-off: [Name] · 23 May 2026 09:42
───────────────────────────────────────────────────────────
CW22 · 30 May 2026 · Updated by: [Coordinator Initials]
───────────────────────────────────────────────────────────
Changes:
  - [Update this section each Friday with a brief list of what changed]
Portfolio Owner sign-off: [Name] · 30 May 2026 [time]
───────────────────────────────────────────────────────────
```

This log requires no special tooling — a plain text file appended each Friday is sufficient. It provides an immediate answer to "what changed since last week?" without needing to diff JSON files.

---

*CTB Portfolio Dashboard · Data Governance & Lifecycle Guide*
*SAP CRM Team · IT Leadership · Confidential-Internal*
*Last reviewed: CW21 · 24 May 2026 · Review annually or when the reporting process changes*
