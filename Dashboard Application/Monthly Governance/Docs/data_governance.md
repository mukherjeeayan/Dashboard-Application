# OpsReview Dashboard — Data Governance

> **Document Type:** Data Governance Policy
> **Applies To:** All users of the OpsReview Dashboard and Editor
> **Classification:** Internal – Restricted
> **Maintained by:** TCS Operations Team

---

## Table of Contents

1. [Purpose & Scope](#1-purpose--scope)
2. [Data Sources](#2-data-sources)
3. [Data Classification](#3-data-classification)
4. [Data Ownership & Stewardship](#4-data-ownership--stewardship)
5. [Data Lifecycle](#5-data-lifecycle)
6. [The `ops_data.json` Authoritative Record](#6-the-ops_datajson-authoritative-record)
7. [Schema Governance](#7-schema-governance)
8. [KPI Calculation Rules](#8-kpi-calculation-rules)
9. [RAG Threshold Standards](#9-rag-threshold-standards)
10. [Manual Data Entry Standards](#10-manual-data-entry-standards)
11. [Validation & Quality Gates](#11-validation--quality-gates)
12. [Retention & Archival](#12-retention--archival)
13. [Access Control](#13-access-control)
14. [Change Control for Configuration Files](#14-change-control-for-configuration-files)
15. [Data Correction Procedure](#15-data-correction-procedure)

---

## 1. Purpose & Scope

This document defines the governance rules for all data consumed, processed, and presented by the OpsReview Dashboard system. It establishes:

- What data enters the system, from where, and under what conditions.
- Who is responsible for data accuracy and completeness.
- How calculated metrics are defined and must not be altered arbitrarily.
- What constitutes valid values for all structured fields.
- How data is retained across reporting periods.

All users who prepare, review, or distribute OpsReview outputs are bound by these rules.

---

## 2. Data Sources

### Primary Source — ServiceNow ITSM Exports

The majority of dashboard data originates from four ServiceNow XLSX exports produced immediately before each reporting cycle:

| Export | Table / Module | Key Fields Required |
|---|---|---|
| **Incidents (INC)** | Incident Management | Number, Assignment Group, State, Priority, Created, Resolved, Response SLA Met, Resolution SLA Met |
| **Service Requests (SR)** | Service Catalog / Request | Number, Assignment Group, State, Priority, Created, Resolved, Response SLA Met, Resolution SLA Met |
| **Requests for Change (RFaC)** | Change Management | Number, Assignment Group, State, Emergency flag, Created, Closed, Cycle Time |
| **Problem Records (PRB)** | Problem Management | Number, Assignment Group, State, Known Error flag, Created, Resolved |

The export window for INC and SR records must cover the **full reporting month** plus the entire **6-month lookback window** to enable accurate MoM trend calculation.

### Secondary Sources — Manual Entry

The following data cannot be derived from ITSM exports and must be entered manually in the Editor:

- Action items and their statuses.
- Leadership escalation issues.
- Project scorecards and RAG ratings.
- Continuous improvement initiatives.
- Appreciations and kudos received.
- Service offers and CCR statuses.
- FTE headcount per pool.
- The period pulse/key-flag statement.

### Configuration Sources

Threshold values, state mappings, priority mappings, module definitions, and assignment group mappings are defined in `opsreview_config.json`. Changes to this file affect all future calculations and must follow the change-control process in Section 14.

---

## 3. Data Classification

All data within the OpsReview system is classified as **Internal – Restricted**:

- It must not be shared outside the operations team and authorised client stakeholders without explicit approval.
- Portable dashboard builds (`.html` files) must be treated as confidential documents. They contain the full `ops_data.json` payload embedded inside them.
- XLSX source files from ServiceNow contain operational ticket data and must be stored securely and not retained on personal devices.

---

## 4. Data Ownership & Stewardship

| Role | Responsibility |
|---|---|
| **Report Owner (Portfolio Owner)** | Signs off on the final `ops_data.json` before distribution. Accountable for accuracy of the published dashboard. |
| **Data Preparer** | Runs the Editor workflow, imports XLSX files, enters manual data, and exports `ops_data.json`. Responsible for following this governance policy. |
| **Module Leads** | Review and confirm KPI accuracy for their assigned modules in the KPI Preview step. Flag anomalies to the Data Preparer before sign-off. |
| **Configuration Owner** | Approves and applies changes to `opsreview_config.json` and `dashboard_config.json`. Changes require peer review. |

---

## 5. Data Lifecycle

```
Period Open
    │
    ├─► ServiceNow data exports produced (last working day of the period)
    │
    ├─► Editor: XLSX files imported, KPIs calculated
    │
    ├─► Module Leads: KPI Preview reviewed, anomalies flagged
    │
    ├─► Editor: Manual data entered/updated, metadata set
    │
    ├─► Editor: Pre-flight validation run — all checks must pass
    │
    ├─► ops_data.json exported and placed in public/data/
    │
    ├─► Dashboard reviewed by Report Owner
    │
    ├─► (Optional) Portable build generated for distribution
    │
    ├─► Dashboard/portable presented at governance review meeting
    │
    └─► ops_data.json archived to the period archive folder
```

---

## 6. The `ops_data.json` Authoritative Record

`ops_data.json` is the **single source of truth** for the dashboard. The following rules apply:

- The file in `public/data/ops_data.json` must always represent the **current period's approved data**.
- Direct manual edits to `ops_data.json` (bypassing the Editor) are **strongly discouraged** and must be documented in the data-correction log (see Section 15).
- The `schemaVersion` field must always be `1`. Do not increment this value without a corresponding schema migration.
- The `meta.lastUpdated` timestamp must reflect the actual time the file was last regenerated.
- The `months` and `monthsFull` arrays must contain exactly `lookbackMonths` elements (default: 6) and must be in chronological order, oldest first.
- All `*Mom` (month-over-month) arrays within each module must have a length exactly equal to the `months` array length.

---

## 7. Schema Governance

The formal schema for `ops_data.json` is defined in `ops_data_schema.json` (JSON Schema draft-07). Key constraints:

### Required Root Fields

`schemaVersion`, `meta`, `global`, `months`, `monthsFull`, `modules`

### Required Module Fields

`id`, `name`, `domain`, `total`

### Domain Values

Only `"SAP"` or `"NonERP"` are valid. Using any other value will cause the module to appear under the wrong tab or be omitted.

### SLA and Metric Ranges

| Field | Valid Range | Unit |
|---|---|---|
| `respSla`, `resolSla` | 0–100 | % |
| `mttr` | 0–∞ | Hours |
| `reopenRate` | 0–100 | % |
| `firstFixRate` | 0–100 | % |
| `priority[]` values | Must sum to 100 | % |
| `age[]` values | Must sum to 100 | % |

### Null Values

SLA and quality metric fields (`respSla`, `resolSla`, `mttr`, `reopenRate`, `firstFixRate`, `escalationRate`) may be `null` if no data is available for that module in the period. The dashboard will display "N/A" for null values.

---

## 8. KPI Calculation Rules

These definitions are authoritative. The Editor uses them; manual overrides must not contradict them without documented justification.

### Ticket Volume

- **Total (`total`)** = count of all INC + SR tickets with a `createdDate` falling within the report month.
- **INC (`inc`)** = subset of total where ticket number prefix matches an INC prefix (configured in `ticketTypePrefixes`).
- **SR (`sr`)** = subset of total where ticket number prefix matches an SR/REQ prefix.

### Resolved Count & Net Flow

- **Resolved (`resolved`)** = count of tickets whose `state` at period close is in `stateMappings.resolvedStates` AND whose `resolvedDate` falls within the report month.
- **Net Flow (`netFlow`)** = `resolved` − `total` (negative means backlog grew; positive means backlog shrank).

### SLA Compliance

- **Response SLA (`respSla`)** = (tickets meeting response SLA ÷ total eligible tickets) × 100.
- **Resolution SLA (`resolSla`)** = (tickets meeting resolution SLA ÷ total eligible tickets) × 100.
- A ticket is "eligible" for SLA measurement if it is not in `Cancelled` state.

### MTTR

- **Mean Time to Resolve (`mttr`)** = mean of (`resolvedDate` − `createdDate`) in hours, across all tickets resolved in the period.
- Tickets not yet resolved at period close are excluded from MTTR calculation.

### Reopen Rate

- **Reopen Rate (`reopenRate`)** = (count of tickets that moved from a resolved/closed state back to an open state ÷ total resolved tickets in period) × 100.

### First-Fix Rate

- **First-Fix Rate (`firstFixRate`)** = (tickets resolved without reopening ÷ total resolved tickets in period) × 100.

### SLA Breaches & Near-Misses

- **Breach Count (`breachCount`)** = count of tickets that failed to meet their SLA target.
- **Near-Miss Count (`nearMissCount`)** = count of tickets that met SLA but whose actual resolution time was within 10% of the SLA deadline (configurable via `thresholds.nearMissRatio`).

### RFaC Aging

- **under8wPct** = (RFaC records open < 56 days ÷ total open RFaC) × 100.
- **under12wPct** = (RFaC records open < 84 days ÷ total open RFaC) × 100.
- **cycleTimeAvgDays** = mean days from creation to closure for RFaC records closed in the period.

### PRB Aging

- **under3mPct** = (PRB records open < 90 days ÷ total open PRB) × 100.
- **under6mPct** = (PRB records open < 180 days ÷ total open PRB) × 100.

---

## 9. RAG Threshold Standards

RAG colours are applied consistently across the dashboard. The default thresholds (configurable in `opsreview_config.json`) are:

| Metric | Green | Amber | Red |
|---|---|---|---|
| SLA % (`sla`) | ≥ 98% | ≥ 95% | < 95% |
| MTTR hours (`mttr`) | ≤ 20 hrs | ≤ 30 hrs | > 30 hrs |
| Reopen Rate % (`reopenRate`) | ≤ 3% | ≤ 5% | > 5% |
| First-Fix Rate % (`firstFixRate`) | ≥ 85% | ≥ 70% | < 70% |
| Tickets per FTE (`fteLoad`) | ≤ 35 | ≤ 45 | > 45 |

**Threshold changes** must be agreed with the client and approved by the Configuration Owner. Changes take effect from the next reporting period and must be noted in the release notes for that period.

Per-module SLA threshold overrides can be set in `ops_data.json` under `modules[].slaThreshold` to accommodate modules with different contractual SLA levels.

---

## 10. Manual Data Entry Standards

### Action Items

Every action item must have:
- `action` — a specific, unambiguous description of the action required.
- `owner` — a named individual (not a team name).
- `dueDate` — an ISO date string (YYYY-MM-DD).
- `status` — one of: `"Open"`, `"In Progress"`, `"Closed"`.
- `nextSteps` — what happens next, even if the status is Closed (record the closure outcome).

### Escalations

Escalations must have a named `responsible` lead. The `issue` field should describe the problem requiring intervention, not just a ticket number.

### Projects

- `ragOverall` must be uppercase: `"GREEN"`, `"AMBER"`, or `"RED"`.
- `status` must be one of the defined phase labels: `"Explore"`, `"Prepare"`, `"Realize"`, `"Deploy"`, `"Closed"`.
- `currentStatus` must be a narrative sentence updated every period.

### Continuous Improvement

`effortSaved` should express time saved in a human-readable format (e.g. "2 hrs/week", "40 hrs/month"). Do not leave it blank if the initiative is completed.

---

## 11. Validation & Quality Gates

Before `ops_data.json` is published each period, all of the following gates must pass:

### Gate 1 — Editor Pre-Flight (Automated)

Run by the Editor export panel. Checks:
- Schema version = 1
- `meta.title`, `meta.period`, `meta.reportDate` non-empty
- `modules` array non-empty and all IDs unique
- All `*Mom` arrays equal in length to `months`
- All `actionItems` and `escalations` have required fields

### Gate 2 — CLI Validation (Automated)

```bash
node scripts/validate_data.js public/data/ops_data.json
```

Runs the same checks independently. Must exit with code 0.

### Gate 3 — Module Lead Review (Manual)

Each Module Lead reviews their module's KPI row in the KPI Preview tab and confirms accuracy in writing (email or Teams message to the Report Owner) before sign-off.

### Gate 4 — Report Owner Sign-Off (Manual)

The Report Owner reviews the live dashboard before distribution and confirms no anomalies. Approval is recorded in the period's governance log.

---

## 12. Retention & Archival

- **`ops_data.json` current file** — overwritten each period. Previous versions are archived.
- **Period archives** — each period's `ops_data.json` is archived in a folder named `archive/YYYY-MM/`.
- **XLSX source files** — retained for 12 months from the report date, then securely deleted.
- **Portable builds** — retained for 24 months.
- **Configuration file history** — maintained in version control or a named backup folder.

---

## 13. Access Control

| Asset | Who Can Read | Who Can Write |
|---|---|---|
| `ops_data.json` (current) | Dashboard viewers | Data Preparer, Report Owner |
| `opsreview_config.json` | Data Preparer | Configuration Owner |
| `dashboard_config.json` | Data Preparer | Configuration Owner |
| XLSX source exports | Data Preparer, Report Owner | ServiceNow admin |
| Portable `.html` builds | Authorised stakeholders | Data Preparer, Report Owner |
| Archive folder | Report Owner, Audit | Data Preparer (write once) |

---

## 14. Change Control for Configuration Files

Changes to `opsreview_config.json` (thresholds, module list, mappings) and `dashboard_config.json` (labels, tabs) require:

1. **Raise a change request** describing what is changing and why.
2. **Peer review** by at least one other team member.
3. **Configuration Owner approval** (documented in email or change log).
4. **Test** the change in a non-production copy of the dashboard before applying to `public/data/`.
5. **Document** the change in `release_notes.md` for the period.
6. **Back up** the previous configuration file before overwriting.

---

## 15. Data Correction Procedure

If an error is found in published data after sign-off:

1. **Log the error** — record the field, the incorrect value, the correct value, and the discovery date in the data-correction log.
2. **Assess impact** — determine whether the error affects a distributed portable build, a live dashboard, or both.
3. **Correct and re-validate** — make the correction in the Editor (preferred) or directly in `ops_data.json` (with documented justification), then re-run all validation gates.
4. **Re-distribute** — if a portable build was sent to stakeholders, generate a corrected build with a revised filename suffix (e.g. `_v2`) and notify recipients of the correction.
5. **Update the correction log** with the resolution date and distribution record.
