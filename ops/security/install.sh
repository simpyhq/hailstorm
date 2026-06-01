#!/usr/bin/env bash
# install.sh — drop the daily security scan onto ClarixHost.
# Run as root on the Hetzner box from a checkout of the hailstorm repo:
#   sudo ops/security/install.sh
set -euo pipefail

[ "$EUID" -eq 0 ] || { echo "must run as root"; exit 1; }

HERE=$(cd "$(dirname "$0")" && pwd)

install -m 0755 "$HERE/daily-security-scan.sh" /usr/local/sbin/daily-security-scan.sh
install -m 0644 "$HERE/security-scan.service" /etc/systemd/system/security-scan.service
install -m 0644 "$HERE/security-scan.timer"   /etc/systemd/system/security-scan.timer

# only write the env file if it doesn't already exist (don't clobber secrets)
if [ ! -f /etc/security-scan.env ]; then
  cat > /etc/security-scan.env <<'EOF'
# Where to send alerts when the scan finds CRITICAL items.
# Both are optional; pick the one that fits.
#
# Slack/Discord/etc. incoming-webhook URL — receives a one-line summary on CRIT.
ALERT_WEBHOOK=

# Email address for the full report on CRIT. Requires `mailx` configured.
ALERT_EMAIL=

# What to call this host in alerts (defaults to `hostname` if unset).
HOSTNAME_LABEL=clarixhost
EOF
  chmod 0600 /etc/security-scan.env
  echo "wrote /etc/security-scan.env  (edit it to enable alerts)"
fi

mkdir -p /var/log/security-scan /var/lib/security-scan
chmod 0750 /var/log/security-scan /var/lib/security-scan

systemctl daemon-reload
systemctl enable --now security-scan.timer

echo
echo "installed. status:"
systemctl status security-scan.timer --no-pager
echo
echo "next runs:"
systemctl list-timers security-scan.timer --no-pager
echo
echo "run it once now to seed snapshots + verify everything works:"
echo "  sudo systemctl start security-scan.service"
echo "  sudo journalctl -u security-scan.service -e --no-pager | tail -80"
echo "  sudo less /var/log/security-scan/$(date -u +%Y-%m-%d).log"
