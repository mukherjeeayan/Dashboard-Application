# OpsReview Dashboard — Security Policy

> **Document Type:** Application Security Policy
> **Applies To:** All users, administrators, and deployers of the OpsReview Dashboard system
> **Classification:** Internal – Restricted
> **Maintained by:** TCS Operations Team

---

## Table of Contents

1. [Overview](#1-overview)
2. [Security Architecture](#2-security-architecture)
3. [Content Security Policy](#3-content-security-policy)
4. [Data Handling Security](#4-data-handling-security)
5. [Browser-Side Security Controls](#5-browser-side-security-controls)
6. [Local Server Security](#6-local-server-security)
7. [Portable Build Security](#7-portable-build-security)
8. [User Responsibilities](#8-user-responsibilities)
9. [Known Limitations](#9-known-limitations)
10. [Incident Response](#10-incident-response)

---

## 1. Overview

OpsReview is a **fully client-side, offline-capable** web application. It has no backend server, no database, no user authentication system, and makes no outbound network requests. This design eliminates an entire class of server-side vulnerabilities (SQL injection, server-side RCE, authentication bypass, session hijacking), but it introduces specific responsibilities on the client and deployment sides that this policy addresses.

The application processes operational IT data classified as **Internal – Restricted**. Security controls must ensure this data cannot be exposed to unauthorised parties through misconfigured deployment, browser vulnerabilities, or user error.

---

## 2. Security Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  User's local machine or internal network share              │
│                                                              │
│  ┌──────────────────┐    ┌───────────────────────────────┐  │
│  │  Python HTTP      │    │  Browser (sandboxed)          │  │
│  │  server (local)   │◄──►│                               │  │
│  │  port 8080-8120   │    │  dashboard.html / editor.html │  │
│  │  serves only      │    │  ops_dashboard.js             │  │
│  │  public/ dir      │    │  ops_editor.js                │  │
│  └──────────────────┘    │                               │  │
│                           │  Reads: ops_data.json,        │  │
│                           │  dashboard_config.json,       │  │
│                           │  opsreview_config.json        │  │
│                           │                               │  │
│                           │  No outbound network calls    │  │
│                           │  No cookies                   │  │
│                           │  No external scripts/fonts    │  │
│                           └───────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

**No data leaves the machine.** All computation is in-browser. No telemetry, analytics, or error-reporting calls are made.

---

## 3. Content Security Policy

Both `dashboard.html` and `editor.html` declare a strict Content Security Policy (CSP) via `<meta http-equiv="Content-Security-Policy">`:

```
default-src 'self';
script-src  'self' 'unsafe-inline';
style-src   'self' 'unsafe-inline';
font-src    'self';
connect-src 'self';
object-src  'none';
base-uri    'self';
```

### What This Means

| Directive | Effect |
|---|---|
| `default-src 'self'` | All resources must come from the same origin by default |
| `script-src 'self' 'unsafe-inline'` | Only local scripts and inline `<script>` blocks are permitted. No CDN, no remote JS |
| `style-src 'self' 'unsafe-inline'` | Only local stylesheets and inline `<style>` blocks. No external CSS |
| `font-src 'self'` | Only locally hosted font files. No Google Fonts or other external font services |
| `connect-src 'self'` | `fetch()` and XHR calls are restricted to the same origin. No cross-origin API calls |
| `object-src 'none'` | Plugins (`<object>`, `<embed>`, Flash) are blocked entirely |
| `base-uri 'self'` | Prevents `<base>` tag hijacking |

### Implication

`unsafe-inline` is required because the dashboard and editor generate HTML dynamically via `innerHTML` assignments with sanitised content. All user-visible strings are HTML-escaped before insertion. A security boundary function (`trust()`) applies allowlist-based tag filtering — only `<strong>`, `<em>`, `<b>`, `<i>`, and `<br>` tags are permitted through; all others are entity-escaped. `javascript:` URIs and `on*=` event attributes are blocked even within the allowlist.

---

## 4. Data Handling Security

### Input Data (XLSX files)

- XLSX files are parsed entirely in-browser using the bundled SheetJS library. No file content is transmitted anywhere.
- The editor reads only the sheets it needs (INC, SR, RFaC, PRB). Unused sheets are discarded.
- Parsed row data is held in browser memory (`editorState` object) for the duration of the session and is cleared when the browser tab is closed.

### Output Data (ops_data.json)

- The exported `ops_data.json` is generated client-side and downloaded via a `Blob` URL. No data is sent to any server.
- The file must be stored securely after download. It contains operational metrics, staffing numbers, escalation details, and project status — all of which are Internal – Restricted.

### Portable Build

- The portable `.html` build embeds the entire `ops_data.json` payload as an inline JavaScript object (`window.__OPS_DATA__`). Anyone who can open the file can read all the data within it by inspecting the page source.
- Treat portable build files with the same confidentiality as the source `ops_data.json`.

### localStorage

- The dashboard uses `localStorage` only to persist two user preferences: the selected theme (`ops-theme`) and font size (`ops-font-size`).
- No operational data is written to `localStorage`. Clearing browser storage has no effect on dashboard data.
- The editor uses `sessionStorage` or in-memory state only; no data is persisted to `localStorage` across sessions.

---

## 5. Browser-Side Security Controls

### HTML Escaping

All values rendered into HTML from the data layer pass through the `esc()` function before insertion:

```javascript
const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
```

This prevents any user-supplied data from the JSON files from executing as HTML or JavaScript.

### Allowlist Tag Filter

The `trust()` function allows a small set of formatting tags to pass through for rich-text fields (notes, pulse text, action item descriptions). The allowlist is:

- `<strong>`, `<em>`, `<b>`, `<i>`, `<br>`

All other tags are entity-escaped. Attributes are stripped entirely from all tags passing through the filter. `javascript:` URIs and `on*=` event handlers are blocked even for allowlisted tags.

### No `eval()` Usage

The codebase does not use `eval()`, `Function()` constructor, or `setTimeout`/`setInterval` with string arguments.

### No Dynamic Script Loading

No scripts are loaded after page initialisation via `document.createElement('script')` or equivalent. All JavaScript is loaded from local sources declared in the HTML.

---

## 6. Local Server Security

The Python `http.server` used by the launcher is a minimal, read-only file server. Security properties:

- It serves only the `public/` directory (or `portable/` for portable builds). It cannot serve files outside that directory.
- It binds to `localhost` (127.0.0.1) only — it is not accessible from other machines on the network.
- It has no authentication. **Do not expose the port externally** (e.g. via port forwarding or firewall rules).
- The server is stopped when the launcher session is ended (Ctrl+C or closing the terminal).

### Port Range

The launcher tries ports 8080–8120 and uses the first available one. Ensure no other application on the machine is listening on those ports in a way that could intercept requests.

### Network Shares

If running OpsReview from a network share, ensure the share is accessible only to authorised users. The Python server, if started, will serve files to any browser that can reach the localhost port, so it must only be started on the machine where the data is authorised to reside.

---

## 7. Portable Build Security

Because the portable build is a self-contained file with all data embedded:

- **Do not email portable builds to distribution lists** without confirming all recipients are authorised to access the data.
- **Do not upload portable builds to unapproved cloud storage** (personal OneDrive, Google Drive, Dropbox, etc.).
- **Do not share portable builds via public links.**
- Store portable builds in the approved internal file share or SharePoint location only.
- Portable builds should be treated as confidential documents and disposed of according to the document retention policy in `data_governance.md`.

---

## 8. User Responsibilities

All users of the OpsReview system must:

1. **Not share XLSX source exports** outside the operations team. These files contain raw ticket data that may include sensitive operational details.
2. **Not store `ops_data.json` or portable builds** on personal devices, personal cloud storage, or unapproved locations.
3. **Not modify configuration files** (`opsreview_config.json`, `dashboard_config.json`) without following the change-control process.
4. **Report any suspected data exposure** (e.g. a portable build sent to the wrong recipient) immediately to the Report Owner and the security team.
5. **Keep the browser up to date.** The CSP and security model of this application depends on browser enforcement of web standards. Use a supported, patched browser.
6. **Not inject external scripts or stylesheets** into the HTML files. All third-party code (Chart.js, SheetJS) is bundled locally and should not be replaced with CDN links.

---

## 9. Known Limitations

### No Authentication

The application has no login or authentication mechanism. Access control relies entirely on filesystem/share permissions and physical access controls. Anyone who can open the files can view all data.

**Mitigation:** Restrict access to the deployment folder using OS-level permissions or share access controls. Use portable builds for distribution to stakeholders who do not need access to the raw data files.

### `unsafe-inline` in CSP

The `script-src 'unsafe-inline'` directive is required by the current architecture (dynamic HTML rendering). This means that if an attacker could inject content into `ops_data.json` before it is loaded, they could potentially inject HTML that the `trust()` filter might not catch in edge cases.

**Mitigation:** Restrict write access to `ops_data.json` to authorised preparers only. Run the CLI validator (`node scripts/validate_data.js`) before deploying any updated data file.

### Python `http.server` Is Not Production-Grade

The built-in Python HTTP server has no rate limiting, no TLS, and no access logging. It is appropriate for local, temporary use only.

**Mitigation:** If OpsReview needs to be hosted for more than a single session or for team access over a network, deploy behind a proper web server (nginx, IIS, Apache) with TLS and access controls. The `public/` directory can be served as static files from any web server.

### No Audit Log

The system does not log who viewed the dashboard, when, or what data was exported. Audit trails rely on filesystem access logs if enabled at the OS level.

---

## 10. Incident Response

If a security incident related to OpsReview is suspected (e.g. data exposed to unauthorised parties, tampered configuration, suspicious file access):

1. **Immediately stop** using the affected files and take them offline if possible.
2. **Notify** the Report Owner and your security/IT team within 1 business hour.
3. **Preserve** the state: do not delete, modify, or overwrite any files until the incident is assessed.
4. **Document** what happened: which files were involved, who had access, what actions were taken.
5. **Assess** whether any data of a sensitive nature (headcount, escalation details, client metrics) was exposed and to whom.
6. **Remediate** per the security team's guidance — this may include revoking share access, regenerating `ops_data.json` with corrected access controls, and notifying affected parties.
7. **Review** the incident in the next team retrospective and update this policy if gaps are identified.
