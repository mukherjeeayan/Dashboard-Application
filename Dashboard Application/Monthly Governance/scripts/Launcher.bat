@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

:: ============================================================
::  OpsReview Dashboard & Editor Launcher
::  Controls:
::  1) Open Editor (opens directly, no server needed)
::  2) Launch Dashboard (Python server + browser)
::  3) Build Portable Dashboard
::  4) Build then Launch
::  N) Exit
:: ============================================================

set "SCRIPT_DIR=%~dp0"
set "PUBLIC_DIR=%SCRIPT_DIR%..\public"
set "SELF=%~f0"

:MENU
cd /d "%SCRIPT_DIR%"
cls
echo.
echo ====================================================
echo   Operations Review Dashboard ^& Editor Launcher
echo ====================================================
echo.
echo   Scripts Directory : %SCRIPT_DIR%
echo   Public Assets     : %PUBLIC_DIR%
echo.
echo   1. Open Editor ^(opens directly, no server needed^)
echo   2. Launch Dashboard ^(Python live server^)
echo   3. Build Portable Dashboard ^(self-contained HTML^)
echo   4. Build then Launch
echo   N. Exit Script
echo.
set "CHOICE="
set /p "CHOICE=Enter choice [1/2/3/4/N]: "

if /i "!CHOICE!"=="N" goto :QUIT
if "!CHOICE!"=="1" goto :OPEN_EDITOR
if "!CHOICE!"=="2" goto :LAUNCH_DASHBOARD
if "!CHOICE!"=="3" goto :BUILD_DASHBOARD
if "!CHOICE!"=="4" goto :BUILD_AND_LAUNCH

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
:OPEN_EDITOR
:: ============================================================
echo.
echo   Opening Editor ...
echo.
set "EDITOR_FILE=!PUBLIC_DIR!\editor.html"
if not exist "!EDITOR_FILE!" (
    echo   ERROR: Could not find 'editor.html'
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
:LAUNCH_PORTABLE
:: ============================================================
set "PUBLIC_DIR=%SCRIPT_DIR%..\portable"
goto :LAUNCH_SERVER

:: ============================================================
:LAUNCH_DASHBOARD
:: ============================================================
set "TARGET_HTML=dashboard.html"
set "PUBLIC_DIR=%SCRIPT_DIR%..\public"
goto :LAUNCH_SERVER

:: ============================================================
:LAUNCH_SERVER
:: ============================================================
where python >nul 2>&1
if errorlevel 1 (
    echo.
    echo   ERROR: Python was not found on your system PATH.
    echo   Please install Python 3 and add it to your PATH.
    echo.
    pause
    goto :MENU
)

:: Find first available port 8080-8120
set "PORT=8080"
set "PORT_MAX=8120"
echo.
echo   Checking availability of port !PORT!...

:PORT_LOOP
if !PORT! gtr !PORT_MAX! (
    echo.
    echo   ERROR: No available port found between 8080 and !PORT_MAX!.
    echo.
    pause
    goto :MENU
)
netstat -ano | findstr /r /c:"TCP.*:!PORT! .*LISTENING" >nul 2>&1
if !errorlevel! equ 0 (
    echo   [BUSY] Port !PORT! is occupied. Trying next port...
    set /a PORT+=1
    goto :PORT_LOOP
)
echo   [OK]   Port !PORT! is available.

echo.
echo   Hosting Path : !PUBLIC_DIR!
echo   Server URL   : http://localhost:!PORT!/!TARGET_HTML!
echo.
echo   Starting Python server on port !PORT!...
echo   ==============================================
echo   To stop the server and return to menu, press Ctrl+C once.
echo   ==============================================
echo.

if not exist "!PUBLIC_DIR!" (
    echo   ERROR: Target assets directory does not exist: !PUBLIC_DIR!
    pause
    goto :MENU
)
if not exist "!PUBLIC_DIR!\!TARGET_HTML!" (
    echo   ERROR: Could not find '!TARGET_HTML!' inside public folder.
    pause
    goto :MENU
)

pushd "!PUBLIC_DIR!"
start /b cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:!PORT!/!TARGET_HTML!"
python -m http.server !PORT!
popd

echo.
echo   Server stopped.
pause
goto :MENU

:: ============================================================
:BUILD_DASHBOARD
:: ============================================================
set "BUILD_MODE=dashboard"
set "LAUNCH_AFTER_BUILD="
goto :RUN_POWERSHELL_BUILD

:: ============================================================
:BUILD_AND_LAUNCH
:: ============================================================
set "BUILD_MODE=dashboard"
set "LAUNCH_AFTER_BUILD=1"
goto :RUN_POWERSHELL_BUILD

:: ============================================================
:RUN_POWERSHELL_BUILD
:: ============================================================
echo.
echo   Building portable HTML (embedded build engine)...
echo.
powershell -ExecutionPolicy Bypass -NoProfile -Command "Get-Content -LiteralPath '%~f0' | Select-Object -Skip ((Select-String -Pattern '^::PS1_START$' -Path '%~f0').LineNumber)" 2>nul | powershell -NoProfile -Command -
set "PS_EXIT=!ERRORLEVEL!"

if defined LAUNCH_AFTER_BUILD (
    if !PS_EXIT! neq 0 (
        echo.
        echo   Build failed -- skipping launch.
        echo.
        pause
        goto :MENU
    )
    :: Determine latest portable file and serve it instead of dashboard.html
    for /f "delims=" %%f in ('dir /b /o-d "%SCRIPT_DIR%..\portable\OpsReview_Dashboard_Portable_*.html" 2^>nul') do (
        set "TARGET_HTML=%%f"
        goto :LAUNCH_PORTABLE
    )
    echo.
    echo   No portable file found in portable folder -- falling back to dashboard.html.
    echo.
    goto :LAUNCH_DASHBOARD
)

echo.
pause
goto :MENU

::PS1_START

$ScriptDir   = (Get-Location).Path
$PublicDir   = Join-Path $ScriptDir "..\public"
$PortableDir = Join-Path $ScriptDir "..\portable"

if (!(Test-Path $PortableDir)) { 
    New-Item -ItemType Directory -Path $PortableDir -Force | Out-Null 
}

# WOFF2 Base64 fonts caching
function Get-Base64FontCss {
    $fontCssFile = Join-Path $PublicDir "css\fonts.css"
    if (!(Test-Path $fontCssFile)) { return $null }
    
    $fontCss = [System.IO.File]::ReadAllText($fontCssFile, [System.Text.Encoding]::UTF8)
    $fontFolder = Join-Path $PublicDir "css\fonts"
    
    if (Test-Path $fontFolder) {
        Get-ChildItem $fontFolder -Filter "*.woff2" | ForEach-Object {
            $bytes = [System.IO.File]::ReadAllBytes($_.FullName)
            $b64 = [Convert]::ToBase64String($bytes)
            $dataUri = "data:font/woff2;base64,$b64"
            $fileName = $_.Name
            $fontCss = $fontCss -replace [regex]::Escape("fonts/$fileName"), $dataUri
        }
    }
    return $fontCss
}

# Package Dashboard — returns $true on success, $false on failure
function Build-Dashboard {
    $HtmlFile  = Join-Path $PublicDir "dashboard.html"
    $DataFile  = Join-Path $PublicDir "data\ops_data.json"
    $CfgFile   = Join-Path $PublicDir "data\dashboard_config.json"
    $OvrFile   = Join-Path $PublicDir "data\opsreview_config.json"
    $CssFile   = Join-Path $PublicDir "css\ops_dashboard.css"
    $JsFile    = Join-Path $PublicDir "js\ops_dashboard.js"
    $ChartFile = Join-Path $PublicDir "js\chart.umd.js"
    
    $cw = Get-Date -UFormat "%Y-CW%V"
    $OutputFile = "OpsReview_Dashboard_Portable_$cw.html"
    $OutputPath = Join-Path $PortableDir $OutputFile
    
    Write-Host "Building Portable Dashboard -> portable\$OutputFile" -ForegroundColor Cyan
    
    if (!(Test-Path $HtmlFile)) { Write-Error "dashboard.html not found"; return $false }
    if (!(Test-Path $DataFile)) { Write-Error "ops_data.json not found"; return $false }
    
    $html = [System.IO.File]::ReadAllText($HtmlFile, [System.Text.Encoding]::UTF8)
    $json = [System.IO.File]::ReadAllText($DataFile, [System.Text.Encoding]::UTF8)
    
    # Validate JSON
    try {
        $null = $json | ConvertFrom-Json -ErrorAction Stop
        Write-Host "  [OK] ops_data.json validation passed." -ForegroundColor Green
    } catch {
        Write-Warning "ops_data.json validation failed: $($_.Exception.Message)"
        return $false
    }
    
    # Inline data + config globals
    $inlineScript = "<script>`n  window.__OPS_DATA__ = " + $json + ";`n"
    
    # Inline dashboard_config.json
    if (Test-Path $CfgFile) {
        $cfgJson = [System.IO.File]::ReadAllText($CfgFile, [System.Text.Encoding]::UTF8)
        try { $null = $cfgJson | ConvertFrom-Json -ErrorAction Stop; Write-Host "  [OK] dashboard_config.json validated." -ForegroundColor Green } catch { Write-Warning "dashboard_config.json invalid: $($_.Exception.Message)"; return $false }
        $inlineScript += "  window.__OPS_CONFIG__ = " + $cfgJson + ";`n"
    } else {
        Write-Warning "dashboard_config.json not found - portable will not render correctly."
        return $false
    }
    
    # Inline opsreview_config.json (optional)
    if (Test-Path $OvrFile) {
        $ovrJson = [System.IO.File]::ReadAllText($OvrFile, [System.Text.Encoding]::UTF8)
        try { $null = $ovrJson | ConvertFrom-Json -ErrorAction Stop; Write-Host "  [OK] opsreview_config.json validated." -ForegroundColor Green } catch { Write-Warning "opsreview_config.json invalid - ignoring"; $ovrJson = "{}" }
        $inlineScript += "  window.__OPS_OVERRIDE__ = " + $ovrJson + ";`n"
    } else {
        $inlineScript += "  window.__OPS_OVERRIDE__ = {};`n"
    }
    
    $inlineScript += "</script>`n"
    $html = $html.Replace("</head>", "$inlineScript</head>")
    
    # Inline CSS
    if (Test-Path $CssFile) {
        $css = [System.IO.File]::ReadAllText($CssFile, [System.Text.Encoding]::UTF8)
        $html = $html -replace '<link\s+rel="stylesheet"\s+href="css/ops_dashboard\.css"\s*/?>', "<style>`n$css`n</style>"
    }
    
    # Inline WOFF2 Fonts — also remove <link> if fonts.css is absent
    $fontCss = Get-Base64FontCss
    if ($fontCss) {
        $html = $html -replace '<link\s+rel="stylesheet"\s+href="css/fonts\.css"\s*/?>', ""
        $html = $html.Replace("</head>", "<style>`n$fontCss`n</style></head>")
    } else {
        $html = $html -replace '<link\s+rel="stylesheet"\s+href="css/fonts\.css"\s*/?>', ""
    }
    
    # Inline Chart.js
    if (Test-Path $ChartFile) {
        $chartJs = [System.IO.File]::ReadAllText($ChartFile, [System.Text.Encoding]::UTF8)
        $html = $html -replace '<script\s+src="js/chart\.umd\.js"\s*>\s*</script>', "<script>`n$chartJs`n</script>"
    }
    
    # Inline JS (runtime handles portable mode via window.__OPS_DATA__ check)
    if (Test-Path $JsFile) {
        $js = [System.IO.File]::ReadAllText($JsFile, [System.Text.Encoding]::UTF8)
        $html = $html -replace '<script\s+src="js/ops_dashboard\.js(\?[^"]*)?"\s*>\s*</script>', "<script>`n$js`n</script>"
    }
    
    $utf8NoBom = [System.Text.UTF8Encoding]::new($false)
    [System.IO.File]::WriteAllText($OutputPath, $html, $utf8NoBom)
    Write-Host "  [OK] Dashboard compiled: $(([math]::Round((Get-Item $OutputPath).Length / 1KB, 1))) KB" -ForegroundColor Green
    return $true
}

# Run build — exit 1 on failure so batch file detects it
if (-not (Build-Dashboard)) { exit 1 }
Write-Host "Portable build process complete!" -ForegroundColor Green

