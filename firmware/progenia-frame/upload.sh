#!/usr/bin/env bash
# Flash ProGenia frame firmware (C6 or C3).
# Usage: ./upload.sh [seeed_xiao_esp32c6|seeed_xiao_esp32c3] [/dev/cu.usbmodemXXX]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PIO="${ROOT}/firmware/.venv/bin/pio"
ENV="${1:-seeed_xiao_esp32c6}"
PORT="${2:-}"

if [[ ! -x "$PIO" ]]; then
  echo "PlatformIO venv missing. From repo root:"
  echo "  python3 -m venv firmware/.venv && firmware/.venv/bin/pip install platformio"
  exit 1
fi

if [[ -z "$PORT" ]]; then
  PORTS=()
  for p in /dev/cu.usbmodem*; do
    [[ -e "$p" ]] || continue
    PORTS+=("$p")
  done
  if ((${#PORTS[@]} == 0)); then
    echo "No USB port found. Plug the XIAO and pass the port:"
    echo "  $0 $ENV /dev/cu.usbmodem11201"
    echo ""
    echo "Available serial devices:"
    ls /dev/cu.* 2>/dev/null || true
    exit 1
  elif ((${#PORTS[@]} == 1)); then
    PORT="${PORTS[0]}"
  else
    echo "Multiple USB modems found — pass the port explicitly:"
    printf '  %s\n' "${PORTS[@]}"
    echo "Example:"
    echo "  $0 $ENV ${PORTS[0]}"
    exit 1
  fi
fi

if [[ ! -e "$PORT" ]]; then
  echo "Port not found: $PORT"
  echo "Available usbmodem ports:"
  ls /dev/cu.usbmodem* 2>/dev/null || echo "  (none — is the XIAO plugged in?)"
  exit 1
fi

echo "→ env=$ENV port=$PORT"
exec "$PIO" run -d "${ROOT}/firmware/progenia-frame" -e "$ENV" -t upload --upload-port "$PORT"
