# Security, Hosting & Distribution Policy
### CTB Portfolio Dashboard — Confidential-Internal

> **Classification:** IT Leadership · Confidential-Internal
> **Owner:** SAP CRM Team Lead / Portfolio Owner
> **Applies to:** All files in the CTB Portfolio Dashboard product set
> **Last reviewed:** CW21 · 24 May 2026

---

## Table of Contents

1. [Data Classification](#1-data-classification)
2. [Permitted Distribution Channels](#2-permitted-distribution-channels)
3. [Prohibited Distribution Channels](#3-prohibited-distribution-channels)
4. [Access Control](#4-access-control)
5. [Internal Hosting Options](#5-internal-hosting-options)
6. [Portable File Handling](#6-portable-file-handling)
7. [Data Retention & Disposal](#7-data-retention--disposal)
8. [Incident Reporting](#8-incident-reporting)

---

## 1. Data Classification

The CTB Portfolio Dashboard and all associated files are classified as **Confidential-Internal**. This classification means:

- The content is intended exclusively for named IT Leadership recipients and the SAP CRM team.
- It must not be disclosed to external parties, contractors without a signed NDA, or internal colleagues outside the defined recipient list without Portfolio Owner authorisation.
- The classification label "IT Leadership · Confidential-Internal" displayed in the dashboard masthead is not decorative — it carries policy weight.

**Files in scope for this policy:**

| File | Classification | Reason |
|---|---|---|
| `public/data/ctb_data.json` | Confidential-Internal | Contains project health, budget RAG, scope issues, and escalation items |
| `public/dashboard.html` | Confidential-Internal | Renders the above data |
| `public/ctb_editor.html` | Confidential-Internal | Contains embedded data after editing session |
| `portable/` | Internal | Build output folder containing generated portable HTML files |
| `portable/CTB_Dashboard_Portable_*.html` | Confidential-Internal | Embeds the full data file; highest risk item |
| `EXECUTIVE_CHEATSHEET.html` | Internal | Describes portfolio reporting structure and visual conventions; no live project data but reveals internal process design |
| `scripts/Launcher.bat`, `scripts/launcher.sh` | Internal | Contains server configuration; lower sensitivity |
| `README.md` | Internal | Technical documentation; describes system architecture and field schemas |
| `RELEASE_NOTES.md` | Internal | Delivered capabilities and roadmap; no live data |
| `SECURITY_POLICY.md` | Internal | This document; describes access controls |
| `DATA_GOVERNANCE.md` | Internal | Describes weekly update process and archiving workflow |
| `SUPPORT_ESCALATION.md` | Internal | Describes escalation contacts and incident procedures |
| `public/data/ctb_data.json` archive files | Confidential-Internal | Historical project health data |

---

## 2. Permitted Distribution Channels

### Portable HTML File (`portable/CTB_Dashboard_Portable_*.html`)

| Channel | Permitted | Conditions |
|---|---|---|
| **Microsoft Teams — Internal Channels** | ✅ Yes | Post only in channels whose membership is restricted to the defined IT Leadership recipient list. Confirm channel membership before posting. |
| **Microsoft Teams — Direct Message** | ✅ Yes | To named IT Leadership recipients only. Do not forward to group chats with mixed membership. |
| **SharePoint — Internal Site** | ✅ Yes | Only on a SharePoint site with access restricted to the recipient list. Verify permissions before uploading. |
| **Outlook — Internal Email** | ✅ Yes (with caution) | Send only to corporate email addresses (`@[company].com`). Use the BCC field with discretion. Do not use distribution lists with unknown membership. |
| **OneDrive Shared Link** | ⚠️ Conditional | Only if the link is set to "Specific people" with named recipients. "Anyone with the link" is not permitted. |

### Live Dashboard (Python Server)

The live server (`http://localhost:8080`) is by design **not accessible outside the machine it runs on** — Python's built-in HTTP server binds to `localhost` only. No additional firewall rules are required. Do not modify this behaviour by binding to `0.0.0.0` without IT security review.

---

## 3. Prohibited Distribution Channels

The following are **strictly prohibited** for all files in scope, regardless of urgency or convenience:

- ❌ **Personal email accounts** (Gmail, Hotmail, Yahoo, or any non-corporate address) — whether sender or recipient.
- ❌ **WhatsApp, Telegram, Signal, or any consumer messaging platform.**
- ❌ **USB drives, SD cards, or any removable physical media** that is not encrypted to corporate standard.
- ❌ **Unencrypted local drives** on personal laptops or home computers.
- ❌ **Public cloud storage** (Dropbox, Google Drive personal, iCloud, WeTransfer).
- ❌ **SharePoint or Teams channels accessible to the entire organisation or to external guests** without explicit Portfolio Owner authorisation.
- ❌ **Printing and leaving unattended** in shared office spaces, printers, or meeting rooms.

If you are uncertain whether a specific channel is permitted, **do not send** and contact the Portfolio Owner for guidance before proceeding.

---

## 4. Access Control

### Recipient List Management

The Portfolio Owner maintains a named recipient list for the weekly distribution. This list is reviewed at the start of each quarter and whenever team membership changes.

**To add a recipient:** Submit a request to the Portfolio Owner with the person's name, role, and business justification. Access is granted by the next reporting cycle.

**To remove a recipient:** Notify the Portfolio Owner immediately when a team member leaves the project, transfers teams, or no longer requires access. Previously distributed portable files cannot be recalled, but they will not receive future distributions.

### File Access on SharePoint

The `/Live` and `/Archive` SharePoint folders must have explicit access permissions — not inherited from a parent site. Review permissions quarterly. The following groups should have access:

- SAP CRM Team (Edit permission on `/Live`)
- IT Leadership recipients (Read permission on `/Live` and `/Archive`)
- All others: No access

---

## 5. Internal Hosting Options

If the Python local server workflow becomes impractical (e.g. for non-technical users or for meeting room presentations), the following internal hosting approaches are approved.

### Option A — SharePoint Modern Page (Simplest)

Upload `portable/CTB_Dashboard_Portable_*.html` from the `portable/` folder to a restricted SharePoint document library and share the direct download link with recipients. Recipients download and open locally. No server required.

**Limitation:** Recipients must download a new file each week. There is no auto-refresh.

### Option B — IIS Internal Web Server

If your organisation runs an internal IIS (Internet Information Services) web server accessible on the corporate network:

1. Request a virtual directory from your IT infrastructure team (e.g. `http://intranet.corp/ctb-portfolio/`).
2. Copy `public/dashboard.html` and `public/data/ctb_data.json` to the virtual directory root.
3. Ensure the directory serves `.json` files with MIME type `application/json` (add in IIS MIME Types if missing).
4. Restrict access to the virtual directory using Windows Authentication or IP allowlist matching the recipient list.
5. Update `public/data/ctb_data.json` in the directory each Friday — the live dashboard auto-refreshes every 5 minutes.

**Advantage:** Recipients bookmark a single URL and always see the current data. No file distribution required.

**Security requirement:** The virtual directory must not be accessible from the public internet. Confirm with your network team that the URL is intranet-only.

### Option C — Azure Static Web App (Cloud-hosted Internal)

For teams on Microsoft Azure with an internal application proxy:

1. Create an Azure Static Web App in your corporate tenant.
2. Configure Azure Active Directory (AAD) authentication — restrict to the recipient security group.
3. Deploy `public/dashboard.html` and `public/data/ctb_data.json` via the Azure Static Web App deployment pipeline.
4. Update `public/data/ctb_data.json` each Friday via the pipeline or direct blob upload.

**Security requirement:** Ensure the Static Web App is configured with AAD authentication and is not publicly accessible. The default Azure Static Web App URL (`*.azurestaticapps.net`) must have the authentication requirement enforced.

---

## 6. Portable File Handling

The portable HTML file (`portable/CTB_Dashboard_Portable_*.html`) is the highest-risk artefact in this product because it is self-contained — it embeds the full `public/data/ctb_data.json` data and can be opened without any server or credentials once distributed.

### Handling Rules

1. **Name it correctly.** The Launcher auto-generates a date-stamped name and writes it to the `portable/` folder (e.g. `portable/CTB_Dashboard_Portable_2026-CW21.html`). Do not rename it in a way that removes the date stamp or obscures the version.

2. **Delete superseded copies.** Once CW22 is published, CW21 copies in the `portable/` folder or on recipients' local machines are outdated. Remind recipients to delete old copies. The authoritative archive lives in the SharePoint `/Archive` folder — local copies are working copies only.

3. **Do not embed in other documents.** Do not paste the HTML source into a Word document, PowerPoint, or email body. Always distribute as an attachment or a link to the SharePoint version.

4. **Do not modify the portable file after distribution.** If a data error is discovered after distribution, rebuild the portable from the corrected `public/data/ctb_data.json` and redistribute, clearly noting in the distribution message that it supersedes the earlier version.

---

## 7. Data Retention & Disposal

| File | Retention Period | Disposal Method |
|---|---|---|
| `public/data/ctb_data.json` archive files | 12 months minimum | Delete from SharePoint after 12 months, or move to cold archive per IT retention policy |
| Portable HTML files (local copies) | Duration of distribution week | Delete after the next week's file is received |
| Portable HTML files (SharePoint archive) | 12 months minimum | Same as archive data files |
| `public/dashboard.html` / `public/ctb_editor.html` | Indefinite (product files) | Dispose only when the product is decommissioned |

When disposing of files, use the corporate IT-approved deletion method (e.g. SharePoint recycle bin with subsequent permanent delete, or IT-managed secure wipe for local drives).

---

## 8. Incident Reporting

If you believe portfolio data has been accessed by an unauthorised person, shared via an unapproved channel, or if a device containing these files is lost or stolen:

1. **Notify the Portfolio Owner immediately** — do not wait until the next reporting cycle.
2. **Do not attempt to investigate or remediate independently.**
3. **Submit an incident report** to your organisation's IT Security team via the standard incident reporting process within **2 hours** of discovery.
4. The Portfolio Owner will determine whether recipient notifications are required and whether the current portable file should be superseded with a new build.

---

*CTB Portfolio Dashboard · Security, Hosting & Distribution Policy*
*SAP CRM Team · IT Leadership · Confidential-Internal*
*Last reviewed: CW21 · 24 May 2026 · Review annually or following any security incident*
