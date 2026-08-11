@echo off
setlocal EnableDelayedExpansion

:: ============================================================
::  Dashboard Application Suite — Root Launcher
::  Unified entry point for all dashboard applications.
::
::  Select an application to access its full launcher menu
::  (Launch Dashboard, Build Portable, Open Editor, etc.)
:: ============================================================

set "ROOT_DIR=%~dp0"


:: ============================================================
:MENU
:: ============================================================
cls
echo.
echo  +---------------------------------------------------------------------------+
echo  :                                                                           :
echo  :                   DASHBOARD APPLICATION SUITE                             :
echo  :                                                                           :
echo  :  Select a dashboard below. The full sub-menu with Launch, Build           :
echo  :  Portable, and Open Editor options will open for your chosen app.         :
echo  :                                                                           :
echo  +---------------------------------------------------------------------------+
echo.
echo.
echo   [1]  Change the Business - CTB Portfolio Dashboard
echo.
echo        Audience : IT Leadership / Workstream Team
echo        Domain   : RAG portfolio status for ongoing change-the-business
echo                   programmes currently being worked upon.
echo        View     : Single-screen status matrix tracking Schedule, Budget,
echo                   Scope, Quality, and Overall Health with RAG indicators.
echo        When     : Weekly portfolio health review for IT leadership.
echo        Actions  : Launch Dashboard, Build Portable, Open Editor
echo.
echo   [2]  Monthly Governance - OpsReview Operations Dashboard
echo.
echo        Audience : Operations Managers / Service Owners / IT Leadership
echo        Domain   : Service management metrics covering Incidents, Service
echo                   Requests, Problems, and RFACs across SAP and Non-SAP modules.
echo        View     : Tabbed dashboard with volume trends, SLA compliance,
echo                   backlog analysis, MTTR tracking, and quality metrics.
echo        When     : Monthly operations review and governance meetings.
echo        Actions  : Launch Dashboard, Build Portable, Open Editor
echo.
echo   [3]  Run the Business - ServiceNow Weekly IT Dashboard
echo.
echo        Audience : IT Portfolio Managers / IT Leadership
echo        Domain   : Weekly IT operations data from ServiceNow - KPIs,
echo                   incident/SR/problem/RFAC volumes, SLA breach tracking.
echo        View     : Executive summary with KPI scorecard tiles, week-on-week
echo                   comparison charts, intervention tracker, and commentary.
echo        When     : Weekly IT operations stand-up and ServiceNow review.
echo        Actions  : Launch Dashboard, Build Portable, Open Editor
echo.
echo   [N]  Exit
echo.
echo  -----------------------------------------------------------------------------
echo.
set "CHOICE="
set /p "CHOICE=  Enter choice [1/2/3/N]: "
echo.

if /i "!CHOICE!"=="N" goto :QUIT
if "!CHOICE!"=="1" goto :APP_CTB
if "!CHOICE!"=="2" goto :APP_MG
if "!CHOICE!"=="3" goto :APP_RTB

echo   Invalid choice. Please enter 1, 2, 3, or N.
pause
goto :MENU


:: ============================================================
:APP_CTB
:: ============================================================
cls
echo.
echo  +--------------------------------------------------------------------------+
echo  :          Change the Business  -  CTB Portfolio Dashboard                :
echo  +--------------------------------------------------------------------------+
echo.
set "APP_DIR=!ROOT_DIR!Change the Business"
if exist "!APP_DIR!\scripts\Launcher.bat" (
    pushd "!APP_DIR!\scripts"
    call Launcher.bat
    popd
) else (
    echo   ERROR: Launcher.bat not found in !APP_DIR!\scripts
    pause
)
goto :MENU


:: ============================================================
:APP_MG
:: ============================================================
cls
echo.
echo  +--------------------------------------------------------------------------+
echo  :          Monthly Governance  -  OpsReview Operations Dashboard          :
echo  +--------------------------------------------------------------------------+
echo.
set "APP_DIR=!ROOT_DIR!Monthly Governance"
if exist "!APP_DIR!\scripts\Launcher.bat" (
    pushd "!APP_DIR!\scripts"
    call Launcher.bat
    popd
) else (
    echo   ERROR: Launcher.bat not found in !APP_DIR!\scripts
    pause
)
goto :MENU


:: ============================================================
:APP_RTB
:: ============================================================
cls
echo.
echo  +--------------------------------------------------------------------------+
echo  :          Run the Business  -  ServiceNow Weekly IT Dashboard            :
echo  +--------------------------------------------------------------------------+
echo.
set "APP_DIR=!ROOT_DIR!Run the Business"
if exist "!APP_DIR!\scripts\Launcher.bat" (
    pushd "!APP_DIR!\scripts"
    call Launcher.bat
    popd
) else (
    echo   ERROR: Launcher.bat not found in !APP_DIR!\scripts
    pause
)
goto :MENU


:: ============================================================
:QUIT
:: ============================================================
cls
echo.
echo  +--------------------------------------------------------------------------+
echo  :                              Goodbye.                                    :
echo  +--------------------------------------------------------------------------+
echo.
timeout /t 1 /nobreak >nul 2>nul
exit /b 0
