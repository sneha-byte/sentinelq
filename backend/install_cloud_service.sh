#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# install_cloud_service.sh
# Run ONCE on your cloud server (VPS, EC2, etc.) to register the
# SentinelQ cloud worker as a systemd service.
#
# Usage:
#   chmod +x backend/install_cloud_service.sh
#   sudo bash backend/install_cloud_service.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SERVICE_NAME="sentinelq-cloud"
SYSTEMD_DIR="/etc/systemd/system"

# ── Resolve project root (two levels up from this script: backend/ → project/) ─
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "📁  Project root detected: ${PROJECT_DIR}"

# ── Find Python — prefer venv, fall back to system python3 ────────────────────
if [[ -f "${PROJECT_DIR}/.venv/bin/python" ]]; then
  PYTHON="${PROJECT_DIR}/.venv/bin/python"
elif [[ -f "${PROJECT_DIR}/venv/bin/python" ]]; then
  PYTHON="${PROJECT_DIR}/venv/bin/python"
else
  PYTHON="$(command -v python3)"
fi

echo "🐍  Python:      ${PYTHON}"
echo "📜  Entry point: ${PROJECT_DIR}/model/cloudModel.py"
echo ""

# ── Confirm .env.local exists (needs NEXT_PUBLIC_SUPABASE_URL etc.) ───────────
if [[ ! -f "${PROJECT_DIR}/.env.local" ]]; then
  echo "⚠️   WARNING: ${PROJECT_DIR}/.env.local not found."
  echo "    The worker reads Supabase credentials from that file."
  echo "    Create it before starting the service, e.g.:"
  echo "      NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co"
  echo "      SUPABASE_SERVICE_ROLE_KEY=your-service-role-key"
  echo ""
fi

# ── Write the service file with real paths filled in ─────────────────────────
SERVICE_PATH="${SYSTEMD_DIR}/${SERVICE_NAME}.service"

cat > "${SERVICE_PATH}" <<EOF
[Unit]
Description=SentinelQ Cloud Analysis Worker
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=${PROJECT_DIR}
ExecStart=${PYTHON} ${PROJECT_DIR}/model/cloudModel.py --cloud-scan
Restart=on-failure
RestartSec=15s
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${SERVICE_NAME}

[Install]
WantedBy=multi-user.target
EOF

echo "📋  Service file written to ${SERVICE_PATH}"

# ── Enable + start ────────────────────────────────────────────────────────────
systemctl daemon-reload
systemctl enable  "${SERVICE_NAME}"
systemctl restart "${SERVICE_NAME}"

echo ""
systemctl status "${SERVICE_NAME}" --no-pager || true

echo ""
echo "✅  Done! The cloud worker will now start automatically on every reboot."
echo ""
echo "Useful commands:"
echo "  sudo journalctl -u ${SERVICE_NAME} -f          # live logs"
echo "  sudo systemctl status  ${SERVICE_NAME}          # is it running?"
echo "  sudo systemctl restart ${SERVICE_NAME}          # manual restart"
echo "  sudo systemctl stop    ${SERVICE_NAME}          # stop it"
echo "  sudo systemctl disable ${SERVICE_NAME}          # remove from auto-start"
