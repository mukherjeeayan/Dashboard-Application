#!/usr/bin/env bash
# ============================================================
#  SAP CRM  ServiceNow Weekly Dashboard -- Launcher (Unix)
#  Equivalent of Launcher.bat for macOS / Linux
#  1) Launch live dashboard  (Python server)
#  2) Build portable HTML    (self-contained)
#  3) Build then Launch
#  4) Open Editor            (snow_editor.html)
#  q) Quit
# ============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PUBLIC_DIR="$(dirname "$SCRIPT_DIR")/public"
SELF="$0"

main_menu() {
  while true; do
    clear 2>/dev/null || true
    echo "===================================================="
    echo "  SAP CRM |  ServiceNow Weekly Leadership Dashboard"
    echo "===================================================="
    echo ""
    echo "  Scripts Directory : $SCRIPT_DIR"
    echo "  Public Assets     : $PUBLIC_DIR"
    echo ""
    echo "  1. Launch Dashboard  (Python live server)"
    echo "  2. Build Portable    (self-contained HTML)"
    echo "  3. Build then Launch"
    echo "  4. Open Editor       (snow_editor.html)"
    echo "  q. Quit"
    echo ""
    read -rp "Enter choice [1/2/3/4/q]: " choice
    case "$choice" in
      1) launch_server ;;
      2) build_portable ;;
      3) build_portable; launch_server ;;
      4) open_editor ;;
      q|Q) echo ""; echo "  Exiting..."; exit 0 ;;
      *) echo ""; echo "  Invalid choice."; sleep 1 ;;
    esac
  done
}

launch_server() {
  if ! command -v python3 &>/dev/null && ! command -v python &>/dev/null; then
    echo ""
    echo "  ERROR: Python 3 is required."
    echo "  Install from https://www.python.org/downloads/"
    echo ""
    read -rp "Press Enter to return to menu..."
    return
  fi
  PYTHON=$(command -v python3 || command -v python)

  PORT=8080
  PORT_MAX=8120
  while [ "$PORT" -le "$PORT_MAX" ]; do
    if lsof -iTCP:"$PORT" -sTCP:LISTEN &>/dev/null 2>&1; then
      echo "  [BUSY] Port $PORT is occupied. Trying next port..."
      PORT=$((PORT + 1))
    else
      echo "  [OK]   Port $PORT is available."
      break
    fi
  done

  if [ "$PORT" -gt "$PORT_MAX" ]; then
    echo ""
    echo "  ERROR: No available port found between 8080 and $PORT_MAX."
    read -rp "Press Enter to return to menu..."
    return
  fi

  echo ""
  echo "===================================================="
  echo "  Hosting Path : $PUBLIC_DIR"
  echo "  Server URL   : http://localhost:$PORT/snow_dashboard.html"
  echo "===================================================="
  echo ""

  (sleep 2 && xdg-open "http://localhost:$PORT/snow_dashboard.html" 2>/dev/null || \
            open "http://localhost:$PORT/snow_dashboard.html" 2>/dev/null || true) &

  pushd "$PUBLIC_DIR" >/dev/null
  $PYTHON -m http.server "$PORT"
  popd >/dev/null

  read -rp "Press Enter to return to menu..."
}

build_portable() {
  echo ""
  echo "===================================================="
  echo "  ServiceNow Weekly Dashboard -- Portable Build"
  echo "===================================================="
  echo ""

  HTML_FILE="$PUBLIC_DIR/snow_dashboard.html"
  JSON_FILE="$PUBLIC_DIR/data/snow_weekly.json"
  CSS_FILE="$PUBLIC_DIR/css/snow_dashboard.css"
  JS_FILE="$PUBLIC_DIR/js/snow_dashboard.js"
  FONT_CSS_FILE="$PUBLIC_DIR/css/fonts.css"
  CHART_JS_FILE="$PUBLIC_DIR/js/chart.umd.js"
  FONT_DIR="$PUBLIC_DIR/css/fonts"

  for f in "$HTML_FILE" "$JSON_FILE"; do
    if [ ! -f "$f" ]; then
      echo "  ERROR: Missing $f"
      read -rp "Press Enter to return to menu..."
      return
    fi
  done

  CW=$(date +"CW%V")
  OUTPUT_FILE="SNOW_Weekly_Dashboard_Portable_$(date +%Y)-$CW.html"
  PORTABLE_DIR="$(dirname "$SCRIPT_DIR")/portable"
  mkdir -p "$PORTABLE_DIR"

  html=$(cat "$HTML_FILE")
  json=$(cat "$JSON_FILE")

  if [ -f "$CSS_FILE" ]; then
    css=$(cat "$CSS_FILE")
  fi
  if [ -f "$JS_FILE" ]; then
    js=$(cat "$JS_FILE")
  fi

  echo "  [OK] Source files read."

  # Inject JSON
  data_script="<script>window.__SNOW_DATA__ = $json;</script>"
  html="${html/<\/head>/$data_script<\/head>}"
  echo "  [OK] JSON data block injected."

  # Embed main CSS
  if [ -n "${css:-}" ]; then
    css_style="<style>$css</style>"
    html=$(echo "$html" | perl -0777 -pe 's|<link rel="stylesheet" href="css/snow_dashboard\.css"\s*/?>|<!-- css inlined -->|')
    html="${html/<!-- css inlined -->/$css_style}"
    echo "  [OK] snow_dashboard.css inlined."
  fi

  # Embed fonts.css with base64-embedded woff2
  if [ -f "$FONT_CSS_FILE" ]; then
    font_css=$(cat "$FONT_CSS_FILE")
    if [ -d "$FONT_DIR" ]; then
      for woff in "$FONT_DIR"/*.woff2; do
        [ -f "$woff" ] || continue
        woff_name=$(basename "$woff")
        b64=$(base64 -i "$woff" 2>/dev/null || base64 < "$woff" 2>/dev/null)
        font_css=$(echo "$font_css" | sed "s|fonts/$woff_name|data:font/woff2;base64,$b64|g")
      done
    fi
    font_style="<style>$font_css</style>"
    html=$(echo "$html" | perl -0777 -pe 's|<link rel="stylesheet" href="css/fonts\.css"\s*/?>|<!-- fonts inlined -->|')
    html="${html/<!-- fonts inlined -->/$font_style}"
    echo "  [OK] fonts.css inlined with embedded woff2."
  fi

  # Embed Chart.js
  if [ -f "$CHART_JS_FILE" ]; then
    chart_js=$(cat "$CHART_JS_FILE")
    chart_script="<script>$chart_js</script>"
    html=$(echo "$html" | perl -0777 -pe 's|<script src="js/chart\.umd\.js"\s*>\s*</script>|<!-- chart inlined -->|')
    html="${html/<!-- chart inlined -->/$chart_script}"
    echo "  [OK] chart.umd.js inlined."
  fi

  # Embed snow_dashboard.js + replace fetch block
  if [ -n "${js:-}" ]; then
    js_patched=$(echo "$js" | perl -0777 -pe 's|/\* PORTABLE_FETCH_BLOCK_START \*/.*?/\* PORTABLE_FETCH_BLOCK_END \*/|/* PORTABLE_FETCH_BLOCK_START */ const data = window.__SNOW_DATA__; /* PORTABLE_FETCH_BLOCK_END */|s')
    js_script="<script>$js_patched</script>"
    html=$(echo "$html" | perl -0777 -pe 's|<script src="js/snow_dashboard\.js"\s*>\s*</script>|<!-- js inlined -->|')
    html="${html/<!-- js inlined -->/$js_script}"
    echo "  [OK] snow_dashboard.js inlined with local data mapping."
  fi

  echo "$html" > "$PORTABLE_DIR/$OUTPUT_FILE"
  SIZE_KB=$(( $(stat -f%z "$PORTABLE_DIR/$OUTPUT_FILE" 2>/dev/null || stat -c%s "$PORTABLE_DIR/$OUTPUT_FILE" 2>/dev/null) / 1024 ))

  echo "  [OK] Written: portable/$OUTPUT_FILE (${SIZE_KB} KB)"
  echo ""
  echo "===================================================="
  echo "  Build complete!"
  echo "===================================================="
  read -rp "Press Enter to return to menu..."
}

open_editor() {
  EDITOR_FILE="$PUBLIC_DIR/snow_editor.html"
  if [ ! -f "$EDITOR_FILE" ]; then
    echo ""
    echo "  ERROR: snow_editor.html not found at $EDITOR_FILE"
    read -rp "Press Enter to return to menu..."
    return
  fi
  xdg-open "$EDITOR_FILE" 2>/dev/null || open "$EDITOR_FILE" 2>/dev/null || echo "  Open $EDITOR_FILE in your browser."
  read -rp "Press Enter to return to menu..."
}

main_menu
