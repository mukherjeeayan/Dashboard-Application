#!/usr/bin/env bash
# ============================================================
#  CTB Portfolio Dashboard -- All-in-One Script (Mac/Linux)
#  1) Launch live dashboard  (Python server)
#  2) Build portable HTML    (self-contained)
#  3) Build then Launch
#  4) Open Data Editor       (ctb_editor.html)
#  N) Exit Script
# ============================================================

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

show_menu() {
  clear
  echo ""
  echo "=========================================="
  echo "  CTB Portfolio Dashboard"
  echo "=========================================="
  echo ""
  echo "  1. Launch Dashboard  (Python live server)"
  echo "  2. Build Portable    (self-contained HTML)"
  echo "  3. Build then Launch"
  echo "  4. Open Data Editor"
  echo "  N. Exit Script"
  echo ""
}

open_browser() {
  local url="$1"
  case "$(uname -s)" in
    Darwin) open "$url" ;;
    Linux)  xdg-open "$url" 2>/dev/null || true ;;
  esac
}

find_port() {
  local port=8080
  local max_port=8120
  while [ "$port" -le "$max_port" ]; do
    if ! lsof -iTCP:"$port" -sTCP:LISTEN -Fn 2>/dev/null | grep -q . && \
       ! ss -tlnp 2>/dev/null | grep -q ":$port "; then
      echo "$port"
      return 0
    fi
    port=$((port + 1))
  done
  echo ""
  return 1
}

launch_server() {
  echo ""
  echo "  Checking availability of ports..."
  local port
  port=$(find_port) || {
    echo "  ERROR: No available port found between 8080 and 8120."
    echo "  Close applications using those ports, then try again."
    echo ""
    read -rp "  Press Enter to return to menu..."
    return 1
  }
  echo "  [OK]   Port $port is available."
  echo ""
  echo "=========================================="
  echo "  CTB Portfolio Dashboard -- Launcher"
  echo "=========================================="
  echo ""
  echo "  Server  : http://localhost:$port/public/dashboard.html"
  echo ""
  echo "  Starting Python server on port $port..."
  echo "  Press Ctrl+C once to stop the server."
  echo ""
  open_browser "http://localhost:$port/public/dashboard.html" &
  cd "$PROJECT_ROOT"
  python3 -m http.server "$port"
  cd "$SCRIPT_DIR"
  echo ""
  read -rp "  Server stopped. Press Enter to return to menu..."
}

build_portable() {
  echo ""
  echo "=========================================="
  echo "  CTB Portfolio -- Portable Build"
  echo "  Output: portable/"
  echo "=========================================="
  echo ""

  cd "$PROJECT_ROOT"

  # Validate source files exist
  if [ ! -f "public/dashboard.html" ]; then
    echo "  ERROR: public/dashboard.html not found."
    read -rp "  Press Enter to return to menu..."
    return 1
  fi
  if [ ! -f "public/data/ctb_data.json" ]; then
    echo "  ERROR: public/data/ctb_data.json not found."
    read -rp "  Press Enter to return to menu..."
    return 1
  fi
  if [ ! -f "public/js/dashboard.js" ]; then
    echo "  ERROR: public/js/dashboard.js not found."
    read -rp "  Press Enter to return to menu..."
    return 1
  fi

  # Validate JSON
  echo "  Validating ctb_data.json..."
  if ! python3 -c "
import json, sys
try:
    with open('public/data/ctb_data.json', encoding='utf-8') as f:
        json.load(f)
    print('  [OK] JSON is valid.')
except json.JSONDecodeError as e:
    print(f'ERROR: {e}')
    sys.exit(1)
"; then
    read -rp "  Press Enter to return to menu..."
    return 1
  fi

  # Build using embedded Python script
  python3 <<'PYBUILD'
import json, os, re, sys
from datetime import datetime

root = os.getcwd()
public = os.path.join(root, 'public')

# Read sources
with open(os.path.join(public, 'dashboard.html'), encoding='utf-8') as f:
    html = f.read()
with open(os.path.join(public, 'data', 'ctb_data.json'), encoding='utf-8') as f:
    json_data = f.read()
with open(os.path.join(public, 'js', 'dashboard.js'), encoding='utf-8') as f:
    js = f.read()
utils_path = os.path.join(public, 'js', 'utils.js')
utils = None
if os.path.exists(utils_path):
    with open(utils_path, encoding='utf-8') as f:
        utils = f.read()
css_path = os.path.join(public, 'css', 'dashboard.css')
css = None
if os.path.exists(css_path):
    with open(css_path, encoding='utf-8') as f:
        css = f.read()

# Validate JSON
parsed = json.loads(json_data)
if not parsed.get('projects'):
    print('  [WARN] No projects found in JSON.')

# Inject JSON as global var
data_script = f'<script>\n  window.__CTB_DATA__ = {json_data};\n</script>\n'
if '</head>' in html:
    html = html.replace('</head>', f'{data_script}</head>')
    print('  [OK] JSON data block injected.')
else:
    print('ERROR: Could not find </head> tag.')
    sys.exit(1)

# Embed CSS inline
if css:
    style_tag = f'<style>\n{css}\n</style>'
    html = re.sub(
        r'<link\s+rel="stylesheet"\s+href="css/dashboard\.css"\s*/>',
        style_tag,
        html
    )
    print(f'  [OK] CSS embedded inline ({len(css) // 1024} KB).')

# Prepend utils.js so esc(), safeUrl(), daysUntil() are available at runtime
if utils:
    patched_js = utils + '\n' + js
else:
    patched_js = js

# Apply portable transforms
patched_js = re.sub(
    r'const resp = await fetch\(.*?\);.*?const data = await resp\.json\(\);',
    'const data = window.__CTB_DATA__;',
    patched_js,
    flags=re.DOTALL
)
patched_js = patched_js.replace(
    'setInterval(silentRefresh, 300000);',
    '/* auto-refresh disabled in portable build */'
)

js_script_tag = f'<script>\n{patched_js}\n</script>'
html = re.sub(
    r'<script\s+src="js/dashboard\.js"\s*>\s*</script>',
    lambda m: js_script_tag,
    html
)
# Also remove utils.js script tag since functions are now inline
html = re.sub(
    r'<script\s+src="js/utils\.js"\s*>\s*</script>',
    '',
    html
)

# Relax CSP for portable mode — everything is inline, no server origin
html = html.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'")
html = html.replace("style-src 'self'", "style-src 'self' 'unsafe-inline'")
print(f'  [OK] JS embedded inline ({len(patched_js) // 1024} KB).')

# Ensure portable output directory
portable_dir = os.path.join(root, 'portable')
os.makedirs(portable_dir, exist_ok=True)

# Date-stamped output filename
now = datetime.now()
iso_year, iso_week, _ = now.isocalendar()
output_file = f'CTB_Dashboard_Portable_{iso_year}-CW{iso_week:02d}.html'
output_path = os.path.join(portable_dir, output_file)

with open(output_path, 'w', encoding='utf-8') as f:
    f.write(html)

size_kb = os.path.getsize(output_path) // 1024
print(f'  [OK] Output written: portable/{output_file} ({size_kb} KB)')
print('')
print('==========================================')
print('  Build complete!')
print(f'')
print(f'  {output_file} is fully self-contained.')
print(f'  Share it and double-click to open in any browser.')
print(f'  No Python, no server needed.')
print('==========================================')
PYBUILD

  cd "$SCRIPT_DIR"
  echo ""
  read -rp "  Press Enter to return to menu..."
}

open_editor() {
  echo ""
  echo "  Opening Data Editor in your default browser..."
  local editor_path="$PROJECT_ROOT/public/ctb_editor.html"
  open_browser "file://$editor_path"
  echo ""
  read -rp "  Press Enter to return to menu..."
}

# ============================================================
# MAIN LOOP
# ============================================================
while true; do
  show_menu
  read -rp "  Enter choice [1/2/3/4/N]: " choice
  case "$choice" in
    1) launch_server ;;
    2) build_portable ;;
    3) build_portable && launch_server ;;
    4) open_editor ;;
    n|N) echo ""; echo "  Exiting script..."; echo ""; exit 0 ;;
    *) echo ""; echo "  Invalid choice. Enter 1, 2, 3, 4, or N."; read -rp "  Press Enter..." ;;
  esac
done
