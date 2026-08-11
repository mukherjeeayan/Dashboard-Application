@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

:: ============================================================
::  SAP CRM ServiceNow Weekly Dashboard -- Launcher
::  Running from the scripts/ folder context
::  1) Launch live dashboard  (Python server)
::  2) Build portable HTML    (self-contained)
::  3) Build then Launch
::  4) Open Editor           (snow_editor.html)
::  N) Exit Script
:: ============================================================

set "SCRIPT_DIR=%~dp0"
set "PUBLIC_DIR=%SCRIPT_DIR%..\public"
set "SELF=%~f0"

:MENU
cd /d "%SCRIPT_DIR%"
cls
echo.
echo ====================================================
echo   SAP CRM ^|  ServiceNow Weekly Leadership Dashboard
echo ====================================================
echo.
echo   Scripts Directory : %SCRIPT_DIR%
echo   Public Assets     : %PUBLIC_DIR%
echo.
echo   1. Launch Dashboard  ^(Python live server^)
echo   2. Build Portable    ^(self-contained HTML^)
echo   3. Build then Launch
echo   4. Open Editor       ^(snow_editor.html^)
echo   N. Exit Script
echo.
set "CHOICE="
set /p "CHOICE=Enter choice [1/2/3/4/N]: "

if /i "!CHOICE!"=="N" goto :QUIT
if "!CHOICE!"=="1" goto :LAUNCH
if "!CHOICE!"=="2" goto :BUILD
if "!CHOICE!"=="3" goto :BUILD
if "!CHOICE!"=="4" goto :EDITOR

echo.
echo   Invalid choice. Please enter 1, 2, 3, 4, or N.
echo.
pause
goto :MENU


:: ============================================================
:EDITOR
:: ============================================================
echo.
echo   Opening Editor ...
echo.
set "EDITOR_FILE=!PUBLIC_DIR!\snow_editor.html"
if not exist "!EDITOR_FILE!" (
    echo   ERROR: Could not find 'snow_editor.html'
    echo   Expected at: !EDITOR_FILE!
    echo.
    pause
    goto :MENU
)
start "" "!EDITOR_FILE!"
echo.
pause
goto :MENU


:: ============================================================
:QUIT
:: ============================================================
echo.
echo   Exiting script...
echo.
exit /b 0


:: ============================================================
:BUILD
:: Extract the PowerShell block embedded below ::PS1_START
:: and run it as a temp file.
:: ============================================================
echo.
echo   Starting portable build...
echo.
set "TMP_PS1=%TEMP%\ctb_build_%RANDOM%.ps1"

powershell -NoProfile -Command "$lines = Get-Content '!SELF!' -Encoding UTF8; $idx = [array]::IndexOf($lines, '::PS1_START'); if ($idx -ge 0) { $rest = $lines[($idx+1)..($lines.Length-1)]; [System.IO.File]::WriteAllText('!TMP_PS1!', ($rest -join [Environment]::NewLine), [System.Text.Encoding]::UTF8) } else { Write-Error 'Marker not found' }"

if not exist "!TMP_PS1!" (
    echo.
    echo   ERROR: Could not extract the build engine.
    echo.
    pause
    goto :MENU
)

powershell -ExecutionPolicy Bypass -NonInteractive -File "!TMP_PS1!"
set "PS_EXIT=!ERRORLEVEL!"
del /f /q "!TMP_PS1!" 2>nul

if "!CHOICE!"=="3" (
    if !PS_EXIT! neq 0 (
        echo.
        echo   Build failed -- skipping launch.
        echo.
        pause
        goto :MENU
    )
    goto :LAUNCH
)

echo.
pause
goto :MENU


:: ============================================================
:LAUNCH
:: ============================================================
where python >nul 2>&1
if errorlevel 1 (
    echo.
    echo   ERROR: Python was not found on your system PATH.
    echo.
    echo   To fix this:
    echo     1. Download Python 3 from https://www.python.org/downloads/
    echo     2. During installation, check "Add Python to PATH"
    echo     3. Restart this script
    echo.
    pause
    goto :MENU
)

:: ── ITERATIVE PORT CHECKER ─────────────────────────────────────────────
set "PORT=8080"
set "PORT_MAX=8120"
echo.
echo   Checking availability of port !PORT!...

:PORT_LOOP
if !PORT! gtr !PORT_MAX! (
    echo.
    echo   ERROR: No available port found between 8080 and !PORT_MAX!.
    echo   Close any applications using those ports, then try again.
    echo.
    pause
    goto :MENU
)
netstat -ano | findstr /r /c:"TCP.*:!PORT! " >nul 2>&1
if !errorlevel! equ 0 (
    echo   [BUSY] Port !PORT! is occupied. Trying next port...
    set /a PORT+=1
    goto :PORT_LOOP
)
echo   [OK]   Port !PORT! is available.
:: ────────────────────────────────────────────────────────────────────────

echo.
echo ====================================================
echo   SAP CRM ^|  ServiceNow Weekly Dashboard -- Launcher
echo ====================================================
echo.
echo   Hosting Path : !PUBLIC_DIR!
echo   Server URL   : http://localhost:!PORT!/snow_dashboard.html
echo.
echo   Starting Python server on port !PORT!...
echo   ==============================================
echo   CRITICAL: To stop the server and return to the 
echo   menu safely, press Ctrl+C ONLY ONCE.
echo   ==============================================
echo.

:: Verify target public directory and target html template exist
if not exist "!PUBLIC_DIR!" (
    echo.
    echo   ERROR: Target assets directory does not exist.
    echo   Expected at: !PUBLIC_DIR!
    echo   Please verify your directory setup.
    echo.
    pause
    goto :MENU
)
if not exist "!PUBLIC_DIR!\snow_dashboard.html" (
    echo.
    echo   ERROR: Could not find 'snow_dashboard.html' inside your public folder.
    echo   Expected file at: !PUBLIC_DIR!\snow_dashboard.html
    echo   Please verify your filenames.
    echo.
    pause
    goto :MENU
)

:: Pivot directory path directly into the web assets environment
pushd "!PUBLIC_DIR!"

:: Automatically open the browser tab after 2 seconds targeting snow_dashboard.html
start /b cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:!PORT!/snow_dashboard.html"

:: Run Python directly in the foreground window context to catch runtime exceptions cleanly
python -m http.server !PORT!

:: Handle unexpected server abort situations
if !errorlevel! neq 0 (
    echo.
    echo   CRITICAL: Python web server execution was interrupted.
    echo   If a browser shortcut opened instead of running the terminal server,
    echo   verify your local Windows App Execution Aliases for Python.
    echo.
    pause
)

:: Restore original directory context after server halts
popd

echo.
echo   Server stopped successfully.
pause
goto :MENU


::PS1_START
# =============================================================================
#  SAP CRM ServiceNow Weekly Dashboard -- Portable Build Script (PowerShell)
# =============================================================================

$ScriptDir    = (Get-Location).Path
$HtmlFile     = Join-Path $ScriptDir "..\public\snow_dashboard.html"
$JsonFile     = Join-Path $ScriptDir "..\public\data\snow_weekly.json"
$CssFile      = Join-Path $ScriptDir "..\public\css\snow_dashboard.css"
$JsFile       = Join-Path $ScriptDir "..\public\js\snow_dashboard.js"
$FontCssFile  = Join-Path $ScriptDir "..\public\css\fonts.css"
$ChartJsFile  = Join-Path $ScriptDir "..\public\js\chart.umd.js"

# Date-stamped output filename
$cw         = Get-Date -UFormat "%Y-CW%V"
$OutputFile = "SNOW_Weekly_Dashboard_Portable_$cw.html"

Write-Host ""
Write-Host "======================================================"
Write-Host "  ServiceNow Weekly Dashboard -- Portable Build"
Write-Host "  Output: portable\$OutputFile"
Write-Host "======================================================"
Write-Host ""

# -- Guard: ensure source files exist -----------------------------------------
if (!(Test-Path $HtmlFile)) {
    Write-Host "ERROR: 'snow_dashboard.html' not found in: $(Resolve-Path (Join-Path $ScriptDir '..\public'))"
    Write-Host ""
    exit 1
}
if (!(Test-Path $JsonFile)) {
    Write-Host "ERROR: 'snow_weekly.json' not found in: $(Resolve-Path (Join-Path $ScriptDir '..\public\data'))"
    Write-Host ""
    exit 1
}

# -- Read source files (UTF-8) -------------------------------------------------
$html = [System.IO.File]::ReadAllText((Resolve-Path $HtmlFile), [System.Text.Encoding]::UTF8)
$json = [System.IO.File]::ReadAllText((Resolve-Path $JsonFile), [System.Text.Encoding]::UTF8)
$css = $null
if (Test-Path $CssFile) {
    $css = [System.IO.File]::ReadAllText((Resolve-Path $CssFile), [System.Text.Encoding]::UTF8)
}
$js = $null
if (Test-Path $JsFile) {
    $js = [System.IO.File]::ReadAllText((Resolve-Path $JsFile), [System.Text.Encoding]::UTF8)
}

Write-Host "  Source HTML : $HtmlFile ($([math]::Round((Get-Item $HtmlFile).Length / 1KB, 1)) KB)"
Write-Host "  Source JSON : $JsonFile ($([math]::Round((Get-Item $JsonFile).Length / 1KB, 1)) KB)"
Write-Host ""

# -- Validate JSON data format before embedding ---------------------------------
Write-Host "  Validating snow_weekly.json..."
try {
    $parsed = $json | ConvertFrom-Json -ErrorAction Stop
    Write-Host "  [OK] JSON format structure verified."
} catch {
    Write-Host ""
    Write-Host "ERROR: snow_weekly.json contains a syntax error and cannot be embedded."
    Write-Host "  Detail: $($_.Exception.Message)"
    Write-Host ""
    exit 1
}

# -- Step 1: Inject JSON block into global scope -------------------------------
$dataScript = "<script>`n  window.__SNOW_DATA__ = " + $json + ";`n</script>`n"
if ($html.Contains("</head>")) {
    $html = $html.Replace("</head>", "$dataScript</head>")
    Write-Host "  [OK] JSON configuration data block injected."
} else {
    Write-Host "ERROR: Could not find mandatory '</head>' wrapper tag in template HTML file."
    exit 1
}

# -- Step 2: Embed inline CSS styles if found ---------------------------------
if ($css) {
    $cssStyleTag = "<style>`n$css`n</style>"
    $linkPattern = '<link\s+rel="stylesheet"\s+href="css/snow_dashboard\.css"\s*/?>'
    if ($html -match $linkPattern) {
        $html = $html -replace $linkPattern, $cssStyleTag
        Write-Host "  [OK] snow_dashboard.css embedded inline."
    }
}

# -- Step 2a: Inline fonts.css with base64-embedded woff2 files ---------------
$fontCssContent = $null
if (Test-Path $FontCssFile) {
    $fontCssContent = [System.IO.File]::ReadAllText((Resolve-Path $FontCssFile), [System.Text.Encoding]::UTF8)
    # Embed each woff2 file as base64 data URI
    $fontDir = Join-Path $ScriptDir "..\public\css\fonts"
    if (Test-Path $fontDir) {
        Get-ChildItem $fontDir -Filter "*.woff2" | ForEach-Object {
            $bytes     = [System.IO.File]::ReadAllBytes($_.FullName)
            $b64       = [Convert]::ToBase64String($bytes)
            $dataUri   = "data:font/woff2;base64,$b64"
            $fileName  = $_.Name
            $fontCssContent = $fontCssContent -replace [regex]::Escape("fonts/$fileName"), $dataUri
        }
        Write-Host "  [OK] woff2 font files embedded as data URIs."
    }
    $fontCssStyleTag = "<style>`n$fontCssContent`n</style>"
    $fontLinkPattern = '<link\s+rel="stylesheet"\s+href="css/fonts\.css"\s*/?>'
    if ($html -match $fontLinkPattern) {
        $html = $html -replace $fontLinkPattern, $fontCssStyleTag
        Write-Host "  [OK] fonts.css embedded inline with base64 woff2 data."
    }
}

# -- Step 3: Embed runtime scripts and parse local data mapping references -----
# 3a: Inline Chart.js so it works offline
if (Test-Path $ChartJsFile) {
    $chartJs   = [System.IO.File]::ReadAllText((Resolve-Path $ChartJsFile), [System.Text.Encoding]::UTF8)
    $chartTag  = "<script>`n$chartJs`n</script>"
    $chartPattern = '<script\s+src="js/chart\.umd\.js"\s*>\s*</script>'
    if ($html -match $chartPattern) {
        $html = $html -replace $chartPattern, $chartTag
        Write-Host "  [OK] chart.umd.js embedded inline ($([math]::Round($chartJs.Length / 1KB, 1)) KB)."
    }
}

# 3b: Inline snow_dashboard.js with fetch block replaced
if ($js) {
    $fetchPattern = "/\* PORTABLE_FETCH_BLOCK_START \*/.*?/\* PORTABLE_FETCH_BLOCK_END \*/"
    $fetchReplace = '/* PORTABLE_FETCH_BLOCK_START */ const data = window.__SNOW_DATA__; /* PORTABLE_FETCH_BLOCK_END */'
    $patchedJs    = [regex]::Replace($js, $fetchPattern, $fetchReplace, [System.Text.RegularExpressions.RegexOptions]::Singleline)

    $jsScriptTag   = "<script>`n$patchedJs`n</script>"
    $jsLinkPattern = '<script\s+src="js/snow_dashboard\.js"\s*>\s*</script>'
    if ($html -match $jsLinkPattern) {
        $html = $html -replace $jsLinkPattern, $jsScriptTag
        Write-Host "  [OK] snow_dashboard.js embedded inline with local data mapping."
    }
}

# -- Step 4: Write self-contained build out to file ----------------------------
$utf8NoBom   = [System.Text.UTF8Encoding]::new($false)
$PortableDir = Join-Path $ScriptDir "..\portable"
if (!(Test-Path $PortableDir)) { New-Item -ItemType Directory -Path $PortableDir -Force | Out-Null }
$outputPath  = Join-Path $PortableDir $OutputFile
[System.IO.File]::WriteAllText($outputPath, $html, $utf8NoBom)

$sizeKB = [math]::Round((Get-Item $outputPath).Length / 1KB, 1)

Write-Host "  [OK] Build file written successfully to: portable\$OutputFile ($sizeKB KB)"
Write-Host ""
Write-Host "======================================================"
Write-Host "  Process Finished Successfully!"
Write-Host "======================================================"
Write-Host ""

