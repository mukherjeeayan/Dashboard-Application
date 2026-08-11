@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

:: ============================================================
::  CTB Portfolio Dashboard -- All-in-One Script
::  1) Launch live dashboard  (Python server)
::  2) Build portable HTML    (self-contained)
::  3) Build then Launch
::  4) Open Data Editor       (ctb_editor.html)
::  N) Exit Script
:: ============================================================

set "SCRIPT_DIR=%~dp0"
set "SELF=%~f0"

:MENU
cd /d "%SCRIPT_DIR%"
cls
echo.
echo ==========================================
echo   CTB Portfolio Dashboard
echo ==========================================
echo.
echo   1. Launch Dashboard  ^(Python live server^)
echo   2. Build Portable    ^(self-contained HTML^)
echo   3. Build then Launch
echo   4. Open Data Editor  
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
:QUIT
:: ============================================================
echo.
echo   Exiting script...
echo.
exit /b 0


:: ============================================================
:BUILD
:: Extract the PowerShell block embedded below goto :EOF
:: and run it as a temp file.
:: Deleted on success or failure.
:: ============================================================
echo.
echo   Starting portable build...
echo.
set "TMP_PS1=%TEMP%\ctb_build_%RANDOM%.ps1"

:: Bulletproof extraction: Reads the entire text asset and splits natively on the marker string
powershell -NoProfile -Command "$content = [System.IO.File]::ReadAllText('!SELF!', [System.Text.Encoding]::UTF8); $parts = $content -split '(?m)^::PS1_START\s*\r?\n'; if ($parts.Length -gt 1) { [System.IO.File]::WriteAllText('!TMP_PS1!', $parts[1], [System.Text.Encoding]::UTF8) } else { Write-Error 'Marker not found' }"

if not exist "!TMP_PS1!" (
    echo.
    echo   ERROR: Could not extract the build engine.
    echo   Please ensure the script was copied completely.
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
:EDITOR
:: ============================================================
echo.
echo   Opening Data Editor in your default browser...
echo.
start "" "%SCRIPT_DIR%..\public\ctb_editor.html"
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

:: ── ITERATIVE PORT CHECKER ───────────────────────────────────
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
:: ─────────────────────────────────────────────────────────────

echo.
echo ==========================================
echo   CTB Portfolio Dashboard -- Launcher
echo ==========================================
echo.
echo   Scripts : !SCRIPT_DIR!
echo   Server  : http://localhost:!PORT!/dashboard.html
echo.
echo   Starting Python server on port !PORT!...
echo   ==============================================
echo   CRITICAL: To stop the server and return to the 
echo   menu safely, press Ctrl+C ONLY ONCE.
echo   ==============================================
echo.

:: Serve from the public/ directory where dashboard files live
pushd "%SCRIPT_DIR%..\public"

:: Automatically open the browser tab after 2 seconds
start /b cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:!PORT!/dashboard.html"

:: Running Python inside cmd /c traps the break intercept.
:: When you hit Ctrl+C, the server stops and immediately bounces you safely back to your menu!
cmd /c python -m http.server !PORT!

:: Restore original directory after server stops
popd

echo.
echo   Server stopped successfully.
pause
goto :MENU


:: ============================================================
:: Everything below this line is the embedded PowerShell script.
:: Batch ignores it (execution ends at goto :EOF above).
:: ============================================================
::PS1_START
# =============================================================================
#  CTB Portfolio Dashboard -- Portable Build Script
# =============================================================================

$ScriptDir    = (Get-Location).Path
$HtmlFile     = Join-Path $ScriptDir "..\public\dashboard.html"
$JsonFile     = Join-Path $ScriptDir "..\public\data\ctb_data.json"
$CssFile      = Join-Path $ScriptDir "..\public\css\dashboard.css"
$JsFile       = Join-Path $ScriptDir "..\public\js\dashboard.js"
$UtilsFile    = Join-Path $ScriptDir "..\public\js\utils.js"

# Phase 3.4 -- date-stamped output filename (e.g. CTB_Dashboard_Portable_2026-CW20.html)
$cw         = Get-Date -UFormat "%Y-CW%V"
$OutputFile = "CTB_Dashboard_Portable_$cw.html"

Write-Host ""
Write-Host "=========================================="
Write-Host "  CTB Portfolio -- Portable Build"
Write-Host "  Output: portable\$OutputFile"
Write-Host "=========================================="
Write-Host ""

# -- Guard: ensure source files exist -----------------------------------------
if (!(Test-Path $HtmlFile)) {
    Write-Host "ERROR: 'dashboard.html' not found in: $(Resolve-Path $ScriptDir\..\public)"
    Write-Host "       Make sure the scripts folder is inside the project root."
    Write-Host ""
    exit 1
}
if (!(Test-Path $JsonFile)) {
    Write-Host "ERROR: 'ctb_data.json' not found in: $(Resolve-Path $ScriptDir\..\public\data)"
    Write-Host "       Make sure the scripts folder is inside the project root."
    Write-Host ""
    exit 1
}
if (!(Test-Path $CssFile)) {
    Write-Host "WARNING: 'css/dashboard.css' not found -- styles will be missing from the portable build."
    Write-Host "         The dashboard may not render correctly."
    Write-Host ""
}
if (!(Test-Path $JsFile)) {
    Write-Host "ERROR: 'js/dashboard.js' not found -- the dashboard requires its JavaScript."
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
$js   = [System.IO.File]::ReadAllText((Resolve-Path $JsFile), [System.Text.Encoding]::UTF8)
$utils = $null
if (Test-Path $UtilsFile) {
    $utils = [System.IO.File]::ReadAllText((Resolve-Path $UtilsFile), [System.Text.Encoding]::UTF8)
}

Write-Host "  Source HTML : $HtmlFile ($([math]::Round((Get-Item $HtmlFile).Length / 1KB, 1)) KB)"
Write-Host "  Source JSON : $JsonFile ($([math]::Round((Get-Item $JsonFile).Length / 1KB, 1)) KB)"
Write-Host ""

# -- Phase 5.4: Validate JSON before embedding ---------------------------------
Write-Host "  Validating ctb_data.json..."
try {
    $parsed = $json | ConvertFrom-Json -ErrorAction Stop
    Write-Host "  [OK] JSON is valid."
} catch {
    Write-Host ""
    Write-Host "ERROR: ctb_data.json contains a syntax error and cannot be embedded."
    Write-Host ""
    Write-Host "  Detail: $($_.Exception.Message)"
    Write-Host ""
    Write-Host "  How to fix:"
    Write-Host "    1. Open ctb_data.json in a text editor"
    Write-Host "    2. Paste its contents into https://jsonlint.com"
    Write-Host "    3. Fix the error shown -- common causes: missing comma,"
    Write-Host "       unclosed bracket, or extra comma after last item"
    Write-Host "    4. Save the file and run this script again"
    Write-Host ""
    exit 1
}

# Basic schema smoke-test -- catch missing projects array early
if (-not $parsed.projects -or $parsed.projects.Count -eq 0) {
    Write-Host ""
    Write-Host "WARNING: ctb_data.json has no projects -- the dashboard will show an empty matrix."
    Write-Host "         Continuing build, but check the 'projects' array in ctb_data.json."
    Write-Host ""
}

# -- Step 1: inject the JSON as a global JS variable before </head> ------------
$dataScript = "<script>`n  window.__CTB_DATA__ = $json;`n</script>`n"

if ($html.Contains("</head>")) {
    $html = $html.Replace("</head>", "$dataScript</head>")
    Write-Host "  [OK] JSON data block injected."
} else {
    Write-Host "ERROR: Could not find '</head>' tag in dashboard.html. Is the file intact?"
    exit 1
}

# -- Step 2: embed external CSS inline (portable file must be self-contained) --
if ($css) {
    $cssStyleTag = "<style>`n$css`n</style>"
    $linkPattern = '<link\s+rel="stylesheet"\s+href="css/dashboard\.css"\s*/>'
    if ($html -match $linkPattern) {
        $html = $html -replace $linkPattern, $cssStyleTag
        Write-Host "  [OK] External CSS embedded inline ($([math]::Round($css.Length / 1KB, 1)) KB)."
    } else {
        Write-Host "  [WARN] No <link> to css/dashboard.css found -- styles may be missing."
    }
}

# -- Step 3: embed external JS inline + apply portable transforms --------------
$fetchPattern    = "const resp = await fetch\(.*?\);.*?const data = await resp\.json\(\);"
$fetchReplace    = "const data = window.__CTB_DATA__;"
$refreshPattern  = "setInterval\(silentRefresh,\s*300000\);"
$refreshReplace  = "/* auto-refresh disabled in portable build */"

# Prepend utils.js so esc(), safeUrl(), daysUntil() are available at runtime
if ($utils) {
    $patchedJs = $utils + "`n" + $js
} else {
    $patchedJs = $js
}
$patchedJs = [regex]::Replace($patchedJs, $fetchPattern,   $fetchReplace, [System.Text.RegularExpressions.RegexOptions]::Singleline)
$patchedJs =        $patchedJs -replace $refreshPattern,   $refreshReplace

# Check that the fetch pattern was found in JS
if ($patchedJs -eq $js) {
    Write-Host "  [WARN] fetch() pattern not found in $JsFile -- was it already transformed?"
}

$jsScriptTag = "<script>`n$patchedJs`n</script>"
$jsLinkPattern = '<script\s+src="js/dashboard\.js"\s*>\s*</script>'
if ($html -match $jsLinkPattern) {
    $html = $html -replace $jsLinkPattern, $jsScriptTag
    Write-Host "  [OK] External JS embedded inline ($([math]::Round($patchedJs.Length / 1KB, 1)) KB) with portable transforms applied."
} else {
    Write-Host "  [WARN] No <script src=\"js/dashboard.js\"> found -- JS may be missing."
}
# Remove utils.js script tag -- its functions are now inlined with dashboard.js
$html = $html -replace '<script\s+src="js/utils\.js"\s*>\s*</script>', ''

# -- Relax CSP for portable mode: everything is inline, no server origin --
$html = $html -replace "script-src 'self'", "script-src 'self' 'unsafe-inline'"
$html = $html -replace "style-src 'self'", "style-src 'self' 'unsafe-inline'"

# -- Step 4: legacy fetch replacement in HTML (should be a no-op after Step 3, kept for safety) --
$html = [regex]::Replace($html, $fetchPattern, $fetchReplace, [System.Text.RegularExpressions.RegexOptions]::Singleline)

# -- Step 5: disable the 5-minute auto-refresh in portable builds (legacy guard) --
$html = $html -replace $refreshPattern, $refreshReplace

# -- Step 6: write the output file (UTF-8, no BOM) ----------------------------
$utf8NoBom   = [System.Text.UTF8Encoding]::new($false)
$PortableDir = Join-Path $ScriptDir "..\portable"
if (!(Test-Path $PortableDir)) { New-Item -ItemType Directory -Path $PortableDir -Force | Out-Null }
$outputPath  = Join-Path $PortableDir $OutputFile
[System.IO.File]::WriteAllText($outputPath, $html, $utf8NoBom)

$sizeKB = [math]::Round((Get-Item $outputPath).Length / 1KB, 1)

Write-Host "  [OK] Output written: portable\$OutputFile ($sizeKB KB)"
Write-Host ""
Write-Host "=========================================="
Write-Host "  Build complete!"
Write-Host ""
Write-Host "  $OutputFile is fully self-contained."
Write-Host "  Share it and double-click to open in any browser."
Write-Host "  No Python, no npm, no server needed."
Write-Host "=========================================="
Write-Host ""