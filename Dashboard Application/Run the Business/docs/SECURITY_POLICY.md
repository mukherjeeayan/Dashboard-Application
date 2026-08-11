# Security, Hosting & Distribution Policy

**Application:** SAP CRM · ServiceNow Weekly IT Operations Dashboard
**Owner:** IT Portfolio Management Office
**Classification:** Internal Use — Restricted Distribution
**Review Cycle:** Annually or upon distribution channel change

---

## 1. Data Classification Matrix

All assets produced or consumed by this application are classified under the following corporate security risk tiers. Classification determines permitted transport channels, storage locations, and access control requirements.

| Asset | Path | Classification | Rationale |
|---|---|---|---|
| `snow_weekly.json` (populated) | `public/data/snow_weekly.json` | **Highly Confidential** | Contains operational KPI data, SLA figures, P1 incident counts, escalation items, and internal commentary. Disclosure to unauthorised parties may impact vendor negotiations, audit findings, or executive decision-making. |
| `SNOW_Weekly_Dashboard_Portable_*.html` | `portable/` | **Highly Confidential** | Contains the same data as `snow_weekly.json`, embedded inline. Must be treated identically to the source JSON. |
| `snow_config.json` | `config/` | **Proprietary Technical Asset** | Contains ServiceNow instance URL patterns, field mapping rules, and threshold values. Disclosure reveals internal tooling architecture. |
| `snow_dashboard.html` | `public/` | **Proprietary Technical Asset** | Custom-developed rendering template. Contains SVG icon set and structural HTML. Does not contain data. |
| `snow_dashboard.css` | `public/css/` | **Proprietary Technical Asset** | Custom design system. No sensitive data content. |
| `snow_dashboard.js` | `public/js/` | **Proprietary Technical Asset** | Custom renderer logic. Contains XSS sanitisation code. No sensitive data content. |
| `snow_editor.html` | `public/` | **Proprietary Technical Asset** | Data entry GUI. No live data stored within the file itself. |
| `Launcher.bat` | `scripts/` | **Proprietary Technical Asset** | Build and server launcher. Contains filesystem path logic and embedded PowerShell. No sensitive data. |
| Archive files (`CW*.json`) | `archive/` | **Highly Confidential** | Historical KPI data. Subject to the same controls as current-week files. Retain for 24 months then destroy per data retention policy. |
| Documentation files (`docs/*.md`, `docs/*.html`) | `docs/` | **Internal Use** | Operational documentation. Contains architecture and escalation details. Not for external distribution. |

---

## 2. Permitted & Prohibited Transport Channels

### 2.1 Permitted Channels for Highly Confidential Assets

The following channels are approved for distributing `snow_weekly.json`, portable build files, and archive files:

| Channel | Permitted | Conditions |
|---|---|---|
| Corporate email (internal domain only) | ✅ Yes | Recipients must be named on the approved distribution list. Password-protected ZIP recommended for portable builds. |
| Corporate intranet file share (mapped drive, UNC path) | ✅ Yes | Must be access-controlled to named individuals or the IT Portfolio team AD group. |
| SharePoint (corporate-managed tenant, access-controlled library) | ✅ Yes | Library must have explicit permission inheritance disabled. "Anyone with the link" sharing must be disabled. |
| Microsoft Teams (private channel, internal members only) | ✅ Yes | File must be uploaded to the channel Files tab, not pasted inline. External guests must not be members of the channel. |
| IIS intranet hosting (see Section 4) | ✅ Yes | Windows Authentication required. Anonymous access must be disabled. |

### 2.2 Strictly Prohibited Channels

The following channels are **strictly prohibited** for all Highly Confidential and Proprietary Technical Asset materials. Violation requires immediate incident reporting to the IT Security team.

| Channel | Status | Reason |
|---|---|---|
| Public cloud storage (Google Drive personal, Dropbox, OneDrive personal) | ❌ Prohibited | Data resides on third-party infrastructure outside corporate control. No access control guarantee. |
| Public file-sharing services (WeTransfer, Filemail, SendGB, etc.) | ❌ Prohibited | Files are accessible to anyone with the link. No authentication. |
| Consumer messaging apps (WhatsApp, Telegram, Signal, iMessage) | ❌ Prohibited | Messages and attachments stored on third-party servers. Not subject to corporate data governance. |
| Personal email accounts (Gmail, Yahoo, Outlook.com, etc.) | ❌ Prohibited | Outside corporate email retention and audit scope. |
| Public GitHub repositories or public Gist | ❌ Prohibited | Files become publicly indexed and searchable within minutes of upload. |
| USB or removable media | ❌ Prohibited | Unless explicitly authorised via the corporate removable media policy with encrypted drive requirement. |
| Screenshot or screen-record share via consumer platforms | ❌ Prohibited | KPI values and SLA figures may be visible in shared screen recordings. |

---

## 3. Intranet Hosting Blueprint (IIS)

For teams requiring a shared intranet instance accessible to multiple stakeholders without running individual local servers, the following IIS configuration is the approved hosting pattern.

### 3.1 Distribution Architecture

```
Corporate Network
│
├── [IT Portfolio Manager Workstation]
│   └── Runs Launcher.bat → produces portable HTML
│         or
│   └── Maintains public/ directory and pushes to IIS share
│
│   ▼ APPROVED CHANNEL ONLY (SharePoint / network share / corporate email)
│
├── [IIS Web Server — Intranet Zone]
│   ├── Site: IT Portfolio Dashboard
│   ├── Physical Path: D:\inetpub\itportfolio\
│   │   ├── snow_dashboard.html
│   │   ├── css\snow_dashboard.css
│   │   ├── js\snow_dashboard.js
│   │   └── data\snow_weekly.json
│   ├── Authentication: Windows Authentication ONLY
│   ├── Anonymous Access: DISABLED
│   └── Binding: https://intranet.corp.local/itdashboard
│
└── [Executive / Stakeholder Browsers — Intranet Zone]
    └── https://intranet.corp.local/itdashboard/snow_dashboard.html
        (Authenticated via corporate AD credentials — no password prompt on domain-joined devices)
```

### 3.2 IIS Configuration Steps

**Step 1 — Create the Application Pool**

```powershell
Import-Module WebAdministration
New-WebAppPool -Name "ITPortfolioDashboard"
Set-ItemProperty IIS:\AppPools\ITPortfolioDashboard -Name processModel.identityType -Value ApplicationPoolIdentity
Set-ItemProperty IIS:\AppPools\ITPortfolioDashboard -Name managedRuntimeVersion -Value ""
# No managed runtime required — static files only
```

**Step 2 — Create the Website**

```powershell
New-Website -Name "ITPortfolioDashboard" `
  -Port 443 `
  -PhysicalPath "D:\inetpub\itportfolio" `
  -ApplicationPool "ITPortfolioDashboard" `
  -Ssl
# Bind an internal CA-signed certificate to port 443
```

**Step 3 — Disable Anonymous Authentication**

```powershell
Set-WebConfigurationProperty -Filter "/system.webServer/security/authentication/anonymousAuthentication" `
  -Name "enabled" -Value "False" -PSPath "IIS:\Sites\ITPortfolioDashboard"
```

**Step 4 — Enable Windows Authentication**

```powershell
Set-WebConfigurationProperty -Filter "/system.webServer/security/authentication/windowsAuthentication" `
  -Name "enabled" -Value "True" -PSPath "IIS:\Sites\ITPortfolioDashboard"
```

**Step 5 — Add MIME Type for JSON**

Without this entry, IIS 8.5+ may return a 404 or refuse to serve `.json` files.

```powershell
Add-WebConfigurationProperty -PSPath "IIS:\Sites\ITPortfolioDashboard" `
  -Filter "system.webServer/staticContent" -Name "." `
  -Value @{fileExtension='.json'; mimeType='application/json'}
```

Or via `web.config` in the site root:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <security>
      <authentication>
        <anonymousAuthentication enabled="false"/>
        <windowsAuthentication enabled="true"/>
      </authentication>
    </security>
    <staticContent>
      <mimeMap fileExtension=".json" mimeType="application/json"/>
    </staticContent>
    <httpErrors errorMode="Custom"/>
  </system.webServer>
</configuration>
```

**Step 6 — Restrict File System Permissions**

```powershell
# Grant read access to the IT Portfolio AD group only
$acl = Get-Acl "D:\inetpub\itportfolio"
$rule = New-Object System.Security.AccessControl.FileSystemAccessRule(
  "CORP\ITPortfolioTeam", "ReadAndExecute", "ContainerInherit,ObjectInherit", "None", "Allow")
$acl.SetAccessRule($rule)
Set-Acl "D:\inetpub\itportfolio" $acl

# The AppPool identity needs read access
$rule2 = New-Object System.Security.AccessControl.FileSystemAccessRule(
  "IIS AppPool\ITPortfolioDashboard", "ReadAndExecute", "ContainerInherit,ObjectInherit", "None", "Allow")
$acl.SetAccessRule($rule2)
Set-Acl "D:\inetpub\itportfolio" $acl
```

**Step 7 — Weekly Data Update Procedure (IIS Mode)**

When the dashboard is hosted on IIS, the Data Steward updates the live instance by:
1. Completing the local weekly update cycle on their workstation.
2. Copying the validated `snow_weekly.json` to the IIS physical path `D:\inetpub\itportfolio\data\` via a mapped network share or SFTP.
3. Verifying the live URL renders correctly before notifying stakeholders.

No server restart is required. IIS serves the file statically; the browser fetches the updated JSON on next page load.

---

## 4. Incident Reporting

Any accidental distribution of Highly Confidential assets via a prohibited channel must be reported to the IT Security Operations team within 2 hours of discovery. The reporting mechanism is defined in the corporate data breach response procedure. See `SUPPORT_ESCALATION.md` §4 for the dashboard-specific breach protocol.

---

*Document version 1.0 · Generated 2026-05-28 · IT Portfolio Management Office*
