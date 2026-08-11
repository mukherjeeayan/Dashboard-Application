#!/usr/bin/env bash
# ============================================================
#  OpsReview Dashboard & Editor Launcher (Unix)
#  Controls:
#  1) Open Editor (opens directly, no server needed)
#  2) Launch Dashboard (Python server + browser)
#  3) Build Portable Dashboard
#  4) Build then Launch
#  N) Exit
# ============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PUBLIC_DIR="$(cd "$SCRIPT_DIR/../public" && pwd 2>/dev/null || echo "$SCRIPT_DIR/../public")"
PORTABLE_DIR="$(cd "$SCRIPT_DIR/../portable" && pwd 2>/dev/null || echo "$SCRIPT_DIR/../portable")"

# Detect OS for opening URLs/files
case "$(uname -s)" in
  Darwin) OPEN_CMD="open" ;;
  *)      OPEN_CMD="xdg-open" ;;
esac

find_python() {
  if command -v python3 &>/dev/null; then
    echo "python3"
  elif command -v python &>/dev/null; then
    echo "python"
  else
    echo ""
  fi
}

menu() {
  clear
  echo ""
  echo "===================================================="
  echo "  Operations Review Dashboard & Editor Launcher"
  echo "===================================================="
  echo ""
  echo "  Scripts Directory : $SCRIPT_DIR"
  echo "  Public Assets     : $PUBLIC_DIR"
  echo ""
  echo "  1. Open Editor (opens directly, no server needed)"
  echo "  2. Launch Dashboard (Python live server)"
  echo "  3. Build Portable Dashboard (self-contained HTML)"
  echo "  4. Build then Launch"
  echo "  N. Exit Script"
  echo ""
  printf "Enter choice [1/2/3/4/N]: "
  read -r choice
  echo ""

  case "$choice" in
    [Nn]) quit ;;
    1) open_editor ;;
    2) launch_dashboard ;;
    3) build_dashboard ;;
    4) build_and_launch ;;
    *)
      echo "  Invalid choice. Please enter 1, 2, 3, 4, or N."
      echo ""
      pause_prompt
      menu
      ;;
  esac
}

quit() {
  echo "  Exiting script..."
  echo ""
  exit 0
}

pause_prompt() {
  printf "Press [Enter] to continue... "
  read -r _
}

open_editor() {
  echo "  Opening Editor ..."
  echo ""
  local editor_file="$PUBLIC_DIR/editor.html"
  if [ ! -f "$editor_file" ]; then
    echo "  ERROR: Could not find 'editor.html'"
    echo "  Expected at: $editor_file"
    echo ""
    pause_prompt
    menu
    return
  fi
  "$OPEN_CMD" "file://$editor_file" 2>/dev/null || "$OPEN_CMD" "$editor_file" 2>/dev/null || echo "  Please open $editor_file manually."
  echo ""
  pause_prompt
  menu
}

# ── Port availability ──
port_available() {
  local port=$1
  if command -v ss &>/dev/null; then
    ss -tln "sport = :$port" 2>/dev/null | grep -q "." && return 1 || return 0
  elif command -v lsof &>/dev/null; then
    lsof -i ":$port" 2>/dev/null | grep -q LISTEN && return 1 || return 0
  else
    # Fallback: try opening a connection with bash built-in
    (echo > "/dev/tcp/127.0.0.1/$port") 2>/dev/null && return 1 || return 0
  fi
}

find_open_port() {
  local port=8080
  local max_port=8120
  while [ "$port" -le "$max_port" ]; do
    if port_available "$port"; then
      echo "$port"
      return 0
    fi
    port=$((port + 1))
  done
  echo ""
  return 1
}

# ── Launch server for a given target directory + html file ──
launch_server() {
  local serve_dir="$1"
  local target_html="$2"

  local py_cmd
  py_cmd=$(find_python)
  if [ -z "$py_cmd" ]; then
    echo "  ERROR: Python was not found on your system PATH."
    echo "  Please install Python 3 and add it to your PATH."
    echo ""
    pause_prompt
    menu
    return
  fi

  echo "  Checking availability of ports 8080-8120..."
  local port
  port=$(find_open_port) || true
  if [ -z "$port" ]; then
    echo "  ERROR: No available port found between 8080 and 8120."
    echo ""
    pause_prompt
    menu
    return
  fi
  echo "  [OK]   Port $port is available."
  echo ""
  echo "  Hosting Path : $serve_dir"
  echo "  Server URL   : http://localhost:$port/$target_html"
  echo ""
  echo "  Starting Python server on port $port..."
  echo "  =============================================="
  echo "  To stop the server, press Ctrl+C."
  echo "  =============================================="
  echo ""

  if [ ! -d "$serve_dir" ]; then
    echo "  ERROR: Target assets directory does not exist: $serve_dir"
    pause_prompt
    menu
    return
  fi
  if [ ! -f "$serve_dir/$target_html" ]; then
    echo "  ERROR: Could not find '$target_html' inside $serve_dir"
    pause_prompt
    menu
    return
  fi

  # Open browser after a short delay
  (sleep 2 && "$OPEN_CMD" "http://localhost:$port/$target_html" 2>/dev/null || true) &
  cd "$serve_dir"
  "$py_cmd" -m http.server "$port"
  cd "$SCRIPT_DIR"

  echo ""
  echo "  Server stopped."
  pause_prompt
  menu
}

launch_dashboard() {
  launch_server "$PUBLIC_DIR" "dashboard.html"
}

launch_portable() {
  local latest
  latest=$(ls -t "$PORTABLE_DIR"/OpsReview_Dashboard_Portable_*.html 2>/dev/null | head -1)
  if [ -n "$latest" ]; then
    launch_server "$PORTABLE_DIR" "$(basename "$latest")"
  else
    echo "  No portable file found -- falling back to dashboard.html."
    echo ""
    launch_dashboard
  fi
}

# ═══════════════════════════════════════════════════════════
# Portable Build (pure bash)
# ═══════════════════════════════════════════════════════════

build_dashboard() {
  echo "  Building portable HTML (embedded build engine)..."
  echo ""
  if build_portable_dashboard; then
    echo ""
    echo "  Portable build process complete!"
  else
    echo ""
    echo "  Build failed. See errors above."
  fi
  pause_prompt
  menu
}

build_and_launch() {
  echo "  Building portable HTML (embedded build engine)..."
  echo ""
  if build_portable_dashboard; then
    local latest
    latest=$(ls -t "$PORTABLE_DIR"/OpsReview_Dashboard_Portable_*.html 2>/dev/null | head -1)
    if [ -n "$latest" ]; then
      launch_server "$PORTABLE_DIR" "$(basename "$latest")"
    else
      echo "  No portable file found -- falling back to dashboard.html."
      echo ""
      launch_dashboard
    fi
  else
    echo ""
    echo "  Build failed -- skipping launch."
    pause_prompt
    menu
  fi
}

build_portable_dashboard() {
  local html_file="$PUBLIC_DIR/dashboard.html"
  local data_file="$PUBLIC_DIR/data/ops_data.json"
  local cfg_file="$PUBLIC_DIR/data/dashboard_config.json"
  local ovr_file="$PUBLIC_DIR/data/opsreview_config.json"
  local css_file="$PUBLIC_DIR/css/ops_dashboard.css"
  local js_file="$PUBLIC_DIR/js/ops_dashboard.js"
  local chart_file="$PUBLIC_DIR/js/chart.umd.js"
  local font_css_file="$PUBLIC_DIR/css/fonts.css"
  local font_dir="$PUBLIC_DIR/css/fonts"

  # Generate CW-based output name
  local cw
  cw=$(date +"%Y-CW%V")
  local output_file="OpsReview_Dashboard_Portable_$cw.html"
  local output_path="$PORTABLE_DIR/$output_file"

  echo "  Building Portable Dashboard -> portable/$output_file"

  # Ensure portable dir exists
  mkdir -p "$PORTABLE_DIR"

  # Validate required files
  if [ ! -f "$html_file" ]; then echo "  [FAIL] dashboard.html not found"; return 1; fi
  if [ ! -f "$data_file" ]; then echo "  [FAIL] ops_data.json not found"; return 1; fi

  # Validate ops_data.json via python if available
  local py_cmd
  py_cmd=$(find_python)
  if [ -n "$py_cmd" ]; then
    if "$py_cmd" -c "import json; json.load(open('$data_file','r',encoding='utf-8')); print('  [OK] ops_data.json validation passed.')" 2>/dev/null; then
      :
    else
      echo "  [WARN] ops_data.json validation failed. Aborting."
      return 1
    fi
  else
    echo "  [WARN] Python not found; skipping JSON validation."
  fi

  # Read base HTML
  local html
  html=$(cat "$html_file")

  # Build inline script block
  local data_json
  data_json=$(cat "$data_file")
  local inline_script
  inline_script="<script>
  window.__OPS_DATA__ = $data_json;"

  # Inline dashboard_config.json
  if [ -f "$cfg_file" ]; then
    local cfg_json
    cfg_json=$(cat "$cfg_file")
    if echo "$cfg_json" | "$py_cmd" -c "import json,sys; json.load(sys.stdin); print('valid')" 2>/dev/null; then
      echo "  [OK] dashboard_config.json validated."
    else
      echo "  [WARN] dashboard_config.json invalid"
      return 1
    fi
    inline_script="$inline_script
  window.__OPS_CONFIG__ = $cfg_json;"
  else
    echo "  [WARN] dashboard_config.json not found - portable will not render correctly."
    return 1
  fi

  # Inline opsreview_config.json (optional)
  if [ -f "$ovr_file" ]; then
    local ovr_json
    ovr_json=$(cat "$ovr_file")
    if echo "$ovr_json" | "$py_cmd" -c "import json,sys; json.load(sys.stdin); print('valid')" 2>/dev/null; then
      echo "  [OK] opsreview_config.json validated."
    else
      echo "  [WARN] opsreview_config.json invalid - ignoring"
      ovr_json="{}"
    fi
    inline_script="$inline_script
  window.__OPS_OVERRIDE__ = $ovr_json;"
  else
    inline_script="$inline_script
  window.__OPS_OVERRIDE__ = {};"
  fi

  inline_script="$inline_script
</script>"

  # Inject inline script before </head>
  html="${html/<\/head>/$inline_script<\/head>}"

  # Inline CSS
  if [ -f "$css_file" ]; then
    local css
    css=$(cat "$css_file")
    # Escape & and / for sed replacement
    local css_stripped
    css_stripped=$(printf '%s\n' "$css" | sed 's/[&/\]/\\&/g')
    html=$(printf '%s\n' "$html" | sed "s|<link[^>]*href=\"css/ops_dashboard\.css\"[^>]*/>|<style>\\n$css_stripped\\n</style>|")
  fi

  # Inline WOFF2 fonts — base64 encode and replace references in fonts.css
  if [ -f "$font_css_file" ]; then
    local font_css
    font_css=$(cat "$font_css_file")

    if [ -d "$font_dir" ]; then
      for f in "$font_dir"/*.woff2; do
        [ -f "$f" ] || continue
        local fname
        fname=$(basename "$f")
        local b64
        b64=$(base64 < "$f" | tr -d '\n')
        local data_uri="data:font/woff2;base64,$b64"
        # Replace "fonts/fname" with the data URI in font_css
        font_css="${font_css//fonts\/$fname/$data_uri}"
      done
    fi

    # Remove the fonts.css link tag
    html=$(printf '%s\n' "$html" | sed '/<link[^>]*href="css\/fonts\.css"[^>]*\/>/d')
    # Inject inlined font css before </head>
    html="${html/<\/head>/$font_css<\/head>}"
  else
    # Remove fonts.css link tag
    html=$(printf '%s\n' "$html" | sed '/<link[^>]*href="css\/fonts\.css"[^>]*\/>/d')
  fi

  # Inline Chart.js
  if [ -f "$chart_file" ]; then
    local chart_js
    chart_js=$(cat "$chart_file")
    html=$(printf '%s\n' "$html" | sed 's|<script[^>]*src="js/chart\.umd\.js"[^>]*></script>|<script>\n</script>|')
    html="${html/<script><\/script>/<script>$chart_js<\/script>}"
  fi

  # Inline dashboard JS
  if [ -f "$js_file" ]; then
    local dashboard_js
    dashboard_js=$(cat "$js_file")
    html=$(printf '%s\n' "$html" | sed 's|<script[^>]*src="js/ops_dashboard\.js[^"]*"[^>]*></script>|<script>\n</script>|')
    html="${html/<script><\/script>/<script>$dashboard_js<\/script>}"
  fi

  # Write output (printf to handle special chars, pipe to preserve content)
  printf '%s\n' "$html" > "$output_path"

  local size
  if [ -n "$py_cmd" ]; then
    size=$("$py_cmd" -c "import os; print(round(os.path.getsize('$output_path')/1024, 1))")
    echo "  [OK] Dashboard compiled: ${size} KB"
  else
    local bytes
    bytes=$(wc -c < "$output_path")
    echo "  [OK] Dashboard compiled: $(( bytes / 1024 )).$(( (bytes % 1024) * 10 / 1024 )) KB"
  fi

  return 0
}

# ── Entry ──
menu
