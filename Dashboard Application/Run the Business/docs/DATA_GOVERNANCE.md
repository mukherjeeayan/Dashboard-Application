# Data Governance & Lifecycle Guide

**Application:** SAP CRM · ServiceNow Weekly IT Operations Dashboard
**Owner:** IT Portfolio Management Office
**Classification:** Internal Use — Restricted Distribution
**Review Cycle:** Quarterly or upon schema change

---

## 1. Stewardship Principles

### 1.1 Designated Data Steward

A single named individual — the **Data Steward** — holds exclusive write authority over `snow_weekly.json` for each reporting cycle. This designation must be formally recorded in the team's weekly operating procedure. Under no circumstances may two individuals edit the file concurrently, as the system provides no native conflict-detection, merge capability, or rollback mechanism.

The Data Steward is accountable for:

- Accuracy of all KPI values, chart data, and SLA figures against the ServiceNow export.
- Correct application of RAG status, delta direction, and invert-delta logic.
- Structural integrity of the JSON file prior to distribution.
- Archiving the prior week's data file before overwriting.

### 1.2 Single-Editor Rule — Non-Negotiable

Because `snow_weekly.json` is a flat file with no database locking, no optimistic concurrency tokens, and no write-back API, **simultaneous editing by two or more individuals will silently produce a corrupt or partially overwritten dataset**. The last writer wins with no warning. This is an architectural constraint, not a defect.

The enforcement mechanism is procedural: the Data Steward must broadcast a file lock announcement to all potential editors at the start of each ingestion window (see Section 3.3). No exceptions are permitted under deadline pressure.

### 1.3 Validation Gate as an Immutable Control

The portable build compiler (`Launcher.bat` → option 2 or 3) will **refuse to embed a syntactically invalid JSON file** and will exit with a non-zero error code. This validation gate cannot be bypassed or disabled without modifying the embedded PowerShell source. It is the final automated quality control before distribution.

In live server mode, a JSON syntax error causes the browser to display a blocking error overlay with the HTTP error detail and launch instructions, preventing the dashboard from rendering. This deliberate failure mode ensures that a malformed data file is never silently displayed to an executive audience.

### 1.4 No Native Rollback

The system contains no version history, no auto-save, and no undo function. If `snow_weekly.json` is corrupted or incorrectly overwritten, recovery is entirely dependent on the manual archive copy maintained under the naming standard defined in Section 4.

This risk is explicitly accepted by the architecture's zero-dependency design. The mitigation is archiving, not technical rollback.

---

## 2. Weekly Ingestion Timeline

```
MONDAY          TUESDAY         WEDNESDAY       THURSDAY        FRIDAY
────────────────────────────────────────────────────────────────────────────

 09:00           10:00           09:00           08:00           10:00
 ┌──────────┐    ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
 │ EXPORT   │    │ DRAFT    │   │ FREEZE   │   │ REVIEW   │   │ RELEASE  │
 │ ServiceNow    │ ingestion│   │ data lock│   │ final    │   │ portable │
 │ CSV/XLSX │    │ & JSON   │   │ broadcast│   │ sign-off │   │ build &  │
 │ for INC, │    │ update   │   │ issued   │   │ by PM    │   │ distribute│
 │ SR, PRB, │    │ commence │   │          │   │          │   │          │
 │ RFAC     │    │          │   │          │   │          │   │          │
 └──────────┘    └──────────┘   └──────────┘   └──────────┘   └──────────┘
      │               │               │               │               │
      ▼               ▼               ▼               ▼               ▼
 Source data     Data Steward    LOCK broadcast   PM validates    Launcher.bat
 extracted as    opens prior     sent via email   against source  option 2 run;
 at W-close      week archive,   to all editors.  export figures. portable HTML
 timestamp.      begins update.  No further edits Schema check    emailed to
                                 permitted after  run in browser. distribution
                                 this point.      Defects raised  list.
                                                  to Steward.
```

### Phase Transition Criteria

**Opening Ingestion (Monday 09:00) → Draft (Tuesday 10:00)**
The Steward must confirm receipt of all four ServiceNow exports (Incidents, Service Requests, Problems, Changes) for the closed reporting week. If any export is unavailable, the transition is deferred and the IT Operations Lead is notified.

**Draft → Consolidation Freeze (Wednesday 09:00)**
All KPI fields, chart data arrays, and commentary items must be populated with values verified against the source export. The SLA figure must be cross-referenced against the ServiceNow SLA report, not manually estimated. The LOCK broadcast (see Section 3.3) must be issued before 09:00 Wednesday at the latest.

**Consolidation Freeze → Review (Thursday 08:00)**
A second named reviewer (not the Data Steward) must open the dashboard in a browser via `Launcher.bat → option 1` and verify a minimum of: all six KPI tile values, the RAG status on all four ServiceNow cards, the 8-week trend chart labels, and the intervention items. Verification is signed off on the team's shared review checklist.

**Review → Release (Friday 10:00)**
Following reviewer sign-off, the Steward runs `Launcher.bat → option 2` to produce the portable build. The output filename (date-stamped) is verified before distribution. The portable file is distributed via the approved channel only (see `SECURITY_POLICY.md` §3).

---

## 3. Archive Standard & Conflict Mitigation

### 3.1 Weekly Archive Naming Convention

Before modifying `snow_weekly.json` for a new reporting cycle, the Data Steward **must** save a copy of the prior week's file using the following strict naming format:

```
archive/
└── CW{NN}_{YYYY}-{MM}-{DD}_snow_weekly.json
```

**Examples:**
```
archive/CW22_2026-05-28_snow_weekly.json
archive/CW21_2026-05-21_snow_weekly.json
archive/CW20_2026-05-14_snow_weekly.json
```

Rules:
- `{NN}` is the ISO calendar week number, zero-padded to two digits.
- `{YYYY}-{MM}-{DD}` is the Friday release date of that week's dashboard.
- The `archive/` directory must reside outside `public/` so it is never served by the HTTP server.
- Archive files must never be modified after the release date.

### 3.2 Git Tagging (Where Version Control Is Active)

If the dashboard source directory is managed under Git, each Friday release must be tagged as follows:

```bash
# Stage the week's final data file
git add public/data/snow_weekly.json

# Commit with structured message
git commit -m "data: W22 2026 weekly dashboard release"

# Annotated tag — non-negotiable; lightweight tags lack metadata
git tag -a "data-W22-2026" -m "W22 2026 — SAP CRM IT Operations Dashboard release. Prepared by [Steward Name]. Reviewed by [Reviewer Name]."

# Push both commit and tag to remote
git push origin main --tags
```

Tag naming format: `data-W{NN}-{YYYY}`

Tags must never be deleted or moved after creation. If a post-release correction is required, a new tag suffixed `-r1`, `-r2` etc. is created after the corrected commit.

### 3.3 File Lock Communication Protocol

The following communication rules are **mandatory** and must be enforced without exception during the Consolidation Freeze phase:

**LOCK Broadcast (issued by Data Steward, Wednesday 09:00 at latest):**

> **SUBJECT: [DASHBOARD LOCK] snow_weekly.json — W{NN} Consolidation Freeze Active**
>
> The W{NN} dashboard data file is now under edit lock. No changes to `public/data/snow_weekly.json` are permitted from this point until Friday release.
>
> **File:** `snow_weekly.json`
> **Lock issued by:** [Data Steward Name]
> **Lock active until:** Friday [date], 12:00
> **Reason:** Consolidation Freeze — review in progress
>
> If you have a mandatory correction, contact [Data Steward Name] directly. Do not edit the file.

**UNLOCK Broadcast (issued by Data Steward, Friday after release):**

> **SUBJECT: [DASHBOARD RELEASED] snow_weekly.json — W{NN} Release Complete**
>
> The W{NN} portable dashboard has been distributed. The file lock is now lifted.
> Archive copy saved as: `archive/CW{NN}_{YYYY}-{MM}-{DD}_snow_weekly.json`

**Emergency Correction Protocol:**

If a factual error is identified after the LOCK broadcast but before release, the Data Steward must:
1. Acknowledge the correction request in writing (email or team chat).
2. Amend the file and notify the reviewer that a re-review is required.
3. Document the change in the weekly review checklist under "Post-Lock Amendments".

---

## 4. Schema Versioning

`snow_weekly.json` carries a `_schema_version` field at its root. This value must be updated whenever a structural change is made to the file's top-level keys or nested data shapes.

| Version | Change Summary |
|---|---|
| `1.0.0` | Initial production schema. Defines `meta`, `kpis`, `snow_links`, `charts`, `wow_scorecard`, `rfac_scorecard`, `intervention`, `commentary`, `sections`, `footer`. |

The `snow_config.json` file carries its own independent schema version (`3.0.0` as of this release) and must not be confused with the data schema.

Any schema change requires:
1. A corresponding update to `snow_dashboard.js` (new render logic).
2. An update to this document (Section 4 version table).
3. An update to the `_schema_version` field in `snow_weekly.json`.
4. A new Git tag prefixed `schema-`.

---

*Document version 1.0 · Generated 2026-05-28 · IT Portfolio Management Office*
