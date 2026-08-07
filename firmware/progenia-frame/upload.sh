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
  PORT="$(ls /dev/cu.usbmodem* 2>/dev/null | head -1 || true)"
fi

if [[ -z "$PORT" ]]; then
  echo "No USB port found. Plug the XIAO and pass the port:"
  echo "  $0 $ENV /dev/cu.usbmodem1101"
  exit 1
fi

echo "→ env=$ENV port=$PORT"
exec "$PIO" run -d "${ROOT}/firmware/progenia-frame" -e "$ENV" -t upload --upload-port "$PORT"
