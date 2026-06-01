#!/usr/bin/env bash
# daily-security-scan.sh — layered daily security check for ClarixHost.
#
# Each check below is annotated with the specific incident vector it covers,
# anchored to the verum-cms compromise (Hetzner abuse 2606:QG6HQTKVGNVO,
# May 4 – Jun 1 2026) — a malicious binary injected into a running container,
# running mass HTTP SYN scans, suspected entry via unauth Ollama on
# 0.0.0.0:11434.
#
# Conventions:
#   FINDINGS  total non-OK items
#   CRIT      items that warrant a same-day human look
# Exit code = number of critical findings (0 = clean).
#
# Optional alerting via env (loaded by the systemd unit from
# /etc/security-scan.env):
#   ALERT_WEBHOOK   POST a short summary on CRIT > 0 (Slack/Discord/etc.)
#   ALERT_EMAIL     mailx the full report on CRIT > 0
#   HOSTNAME_LABEL  shown in alerts (default: $(hostname))
set -uo pipefail

DATE_UTC=$(date -u +%Y-%m-%dT%H:%M:%SZ)
DAY=$(date -u +%Y-%m-%d)
REPORT_DIR=${REPORT_DIR:-/var/log/security-scan}
SNAP_DIR=${SNAP_DIR:-/var/lib/security-scan}
REPORT="$REPORT_DIR/$DAY.log"
SUMMARY_JSON="$REPORT_DIR/latest.json"
HOSTNAME_LABEL=${HOSTNAME_LABEL:-$(hostname)}

mkdir -p "$REPORT_DIR" "$SNAP_DIR"

FINDINGS=0
CRIT=0
declare -a CRIT_LINES=()

log()    { echo "$*" | tee -a "$REPORT"; }
section(){ log ""; log "===== $* ====="; }
info()   { log "  · $*"; }
warn()   { log "⚠  WARN: $*";  FINDINGS=$((FINDINGS+1)); }
crit()   { log "🚨 CRIT: $*"; CRIT=$((CRIT+1)); FINDINGS=$((FINDINGS+1)); CRIT_LINES+=("$*"); }

log "Security scan @ $DATE_UTC on $HOSTNAME_LABEL"
log "Report: $REPORT"

############################################################
# 1. Container drift — would have caught the injected binary
# `docker diff` lists every file added (A), changed (C), or deleted (D) in a
# running container's filesystem relative to its image. Filtering out routine
# log/cache/tmp paths leaves anything an attacker added: dropped binaries,
# scripts, modified configs. This is THE check that would have surfaced
# safenet-client-alpine-amd64 on day one.
############################################################
section "Container filesystem drift"
if command -v docker >/dev/null 2>&1; then
  for c in $(docker ps -q 2>/dev/null); do
    name=$(docker inspect --format '{{.Name}}' "$c" 2>/dev/null | sed 's|^/||')
    # ignore routine writable paths; flag everything else
    drift=$(docker diff "$c" 2>/dev/null \
      | grep -vE '^[ACD] (/tmp|/var/tmp|/var/log|/var/cache|/var/run|/run|/proc|/sys|/dev|/var/lib/mysql|/var/lib/postgresql|/var/lib/redis|/data|/app/storage|/app/var|/app/cache|/usr/share/nginx/html/cache|/var/lib/apt/lists)' \
      | head -50)
    if [ -n "$drift" ]; then
      # only escalate to CRIT if anything added under bin/sbin/usr/opt/etc/root/home
      sensitive=$(echo "$drift" | grep -E '^A (/usr|/bin|/sbin|/opt|/etc|/root|/home)' | head -10)
      if [ -n "$sensitive" ]; then
        crit "container '$name' has new files in sensitive paths"
        echo "$sensitive" | while read l; do info "$l"; done
      else
        warn "container '$name' has unexpected filesystem changes"
        echo "$drift" | head -10 | while read l; do info "$l"; done
      fi
    fi
  done
else
  info "docker not installed — skipping"
fi

############################################################
# 2. Public-bound services vs. allowlist — would have caught the Ollama exposure
# Hetzner public IP (65.21.192.12) should only accept inbound on SSH, HTTP,
# HTTPS, and Tailscale's UDP port. Anything else on 0.0.0.0 / [::] is suspect.
############################################################
section "Public-bound services"
ALLOW='":22 |:80 |:443 |:41641 "'
PUBLIC=$(ss -tlnp 2>/dev/null \
  | awk 'NR>1 {print $1, $4, $NF}' \
  | grep -E '0\.0\.0\.0|\[::\]' \
  | grep -vE ":22 |:80 |:443 |:41641 " )
if [ -n "$PUBLIC" ]; then
  crit "non-allowlisted port(s) bound to a public interface"
  echo "$PUBLIC" | while read l; do info "$l"; done
fi

# explicit deny-list of historically-vulnerable services
for p in 11434 2375 2376 8000 8080 9000 9443 6379 27017 5432 3306 5984 9200 11211; do
  bad=$(ss -tlnp 2>/dev/null | awk -v p=":$p" '$4 ~ p {print}' | grep -E '0\.0\.0\.0|\[::\]')
  [ -n "$bad" ] && crit "sensitive port $p bound publicly: $bad"
done

############################################################
# 3. Outbound scan signatures — would have caught the live SYN scan
# A high count of TCP connections in SYN_SENT state is the textbook signature
# of an outbound port scan. Healthy hosts have very few at any given moment.
############################################################
section "Outbound scan signature"
SYN_COUNT=$(ss -tn state syn-sent 2>/dev/null | tail -n +2 | wc -l)
info "TCP SYN_SENT connections right now: $SYN_COUNT"
[ "$SYN_COUNT" -gt 50 ]  && warn "elevated SYN_SENT count (possible burst)"
[ "$SYN_COUNT" -gt 200 ] && crit "very high SYN_SENT count — likely active scan"

# unique remote IPs in established connections (diversity signal)
UNIQ_REMOTE=$(ss -tn state established 2>/dev/null \
  | awk 'NR>1 {split($5,a,":"); print a[1]}' \
  | grep -vE '^127\.|^::1' | sort -u | wc -l)
info "unique remote IPs (established): $UNIQ_REMOTE"
[ "$UNIQ_REMOTE" -gt 100 ] && warn "unusually diverse outbound peers ($UNIQ_REMOTE) — possible scan tail"

############################################################
# 4. Suspicious process names
############################################################
section "Suspicious processes"
PATTERNS='masscan|zmap|nmap|zgrab|nuclei|httpx|hydra|gobuster|wpscan|xmrig|cnrig|kdevtmpfsi|kinsing|safenet|cryptonight|minerd'
SUSP=$(ps auxf 2>/dev/null | grep -iE "$PATTERNS" | grep -v grep | grep -v "daily-security-scan")
if [ -n "$SUSP" ]; then
  crit "process(es) matching known scanner/miner names:"
  echo "$SUSP" | while read l; do info "$l"; done
fi

# also check inside containers (which is where the actual binary lived)
if command -v docker >/dev/null 2>&1; then
  for c in $(docker ps -q 2>/dev/null); do
    susp=$(docker top "$c" 2>/dev/null | tail -n +2 | grep -iE "$PATTERNS")
    if [ -n "$susp" ]; then
      name=$(docker inspect --format '{{.Name}}' "$c" 2>/dev/null | sed 's|^/||')
      crit "suspicious process inside container '$name'"
      echo "$susp" | while read l; do info "$l"; done
    fi
  done
fi

############################################################
# 5. Dropper paths — recently-dropped executables in writable temp dirs
############################################################
section "Dropper paths"
DROPS=$(find /tmp /var/tmp /dev/shm -type f -mtime -1 -executable 2>/dev/null | head -20)
if [ -n "$DROPS" ]; then
  warn "executable files dropped in temp paths in last 24h:"
  echo "$DROPS" | while read f; do info "$f ($(stat -c '%y %U %s' "$f"))"; done
fi

############################################################
# 6. SSH authorized_keys diff — catches new keys appearing
############################################################
section "SSH authorized_keys"
for home in /root /home/*; do
  [ -d "$home" ] || continue
  ak="$home/.ssh/authorized_keys"
  [ -f "$ak" ] || continue
  count=$(grep -c . "$ak" 2>/dev/null || echo 0)
  info "$home: $count key(s)"
  snap="$SNAP_DIR/keys_$(echo "$home" | tr / _).snap"
  if [ -f "$snap" ]; then
    if ! diff -q "$ak" "$snap" >/dev/null 2>&1; then
      crit "authorized_keys CHANGED for $home since last scan"
      diff "$snap" "$ak" | head -30 | while read l; do info "$l"; done
    fi
  fi
  cp -f "$ak" "$snap"
done

############################################################
# 7. Cron / systemd persistence drift
############################################################
section "Cron jobs"
cron_now=$(mktemp)
for u in $(cut -f1 -d: /etc/passwd); do
  out=$(crontab -u "$u" -l 2>/dev/null | grep -v '^#' | grep .)
  [ -n "$out" ] && echo "## user: $u" >> "$cron_now" && echo "$out" >> "$cron_now"
done
find /etc/cron.d /etc/cron.hourly /etc/cron.daily /etc/cron.weekly /etc/cron.monthly /var/spool/cron 2>/dev/null \
  | xargs -I{} sh -c 'echo "## file: {}"; cat "{}" 2>/dev/null' 2>/dev/null >> "$cron_now"

cron_snap="$SNAP_DIR/cron.snap"
if [ -f "$cron_snap" ]; then
  if ! diff -q "$cron_now" "$cron_snap" >/dev/null 2>&1; then
    warn "cron configuration changed since last scan"
    diff "$cron_snap" "$cron_now" | head -40 | while read l; do info "$l"; done
  fi
fi
mv -f "$cron_now" "$cron_snap"

# systemd unit drift (timers & services)
section "systemd units"
units_now=$(mktemp)
systemctl list-unit-files --type=service,timer --state=enabled --no-legend --no-pager 2>/dev/null \
  | awk '{print $1}' | sort > "$units_now"
units_snap="$SNAP_DIR/units.snap"
if [ -f "$units_snap" ]; then
  added=$(comm -13 "$units_snap" "$units_now")
  if [ -n "$added" ]; then
    warn "newly-enabled systemd units since last scan:"
    echo "$added" | while read l; do info "$l"; done
  fi
fi
mv -f "$units_now" "$units_snap"

############################################################
# 8. Recently modified system files
############################################################
section "Recently modified system files"
RECENT=$(find /etc /usr/local/bin /usr/local/sbin -type f -mtime -1 \
  ! -path '/etc/letsencrypt/*' ! -path '/etc/security-scan.env' 2>/dev/null | head -20)
if [ -n "$RECENT" ]; then
  warn "system files modified in last 24h:"
  echo "$RECENT" | while read f; do info "$f ($(stat -c '%y %U' "$f" 2>/dev/null))"; done
fi

############################################################
# 9. Failed login attempts
############################################################
section "Failed SSH logins (last 24h)"
FAILS=$(journalctl _COMM=sshd --since "24 hours ago" --no-pager 2>/dev/null \
  | grep -iE 'Failed password|Invalid user|authentication failure' | wc -l)
info "failed login attempts: $FAILS"
[ "$FAILS" -gt 5000 ]  && warn "elevated SSH failure rate"
[ "$FAILS" -gt 20000 ] && crit "very high SSH failure rate — possible bruteforce"

############################################################
# 10. Optional: ClamAV quick scan of dropper paths
############################################################
if command -v clamscan >/dev/null 2>&1; then
  section "ClamAV (dropper paths)"
  out=$(clamscan -r --quiet --infected /tmp /var/tmp /dev/shm 2>&1 | tail -10)
  if echo "$out" | grep -q FOUND; then
    crit "ClamAV found infection(s):"
    echo "$out" | while read l; do info "$l"; done
  else
    info "no infections found"
  fi
fi

############################################################
# 11. Optional: rkhunter
############################################################
if command -v rkhunter >/dev/null 2>&1; then
  section "rkhunter"
  rkhunter --check --skip-keypress --report-warnings-only --no-mail-on-warning 2>&1 \
    | tail -20 | while read l; do info "$l"; done
fi

############################################################
# Summary + alert
############################################################
section "Summary"
log "Findings: $FINDINGS    Critical: $CRIT"

cat > "$SUMMARY_JSON" <<EOF
{
  "host": "$HOSTNAME_LABEL",
  "timestamp": "$DATE_UTC",
  "findings": $FINDINGS,
  "critical": $CRIT,
  "report": "$REPORT"
}
EOF

if [ "$CRIT" -gt 0 ]; then
  log ""
  log "Action required:"
  for line in "${CRIT_LINES[@]}"; do log "  • $line"; done

  if [ -n "${ALERT_WEBHOOK:-}" ]; then
    body=$(printf '{"text":"🚨 [%s] daily security scan: %d CRITICAL finding(s) at %s — see %s"}' \
      "$HOSTNAME_LABEL" "$CRIT" "$DATE_UTC" "$REPORT")
    curl -fsS -X POST -H 'Content-Type: application/json' -d "$body" "$ALERT_WEBHOOK" >/dev/null 2>&1 \
      && info "webhook notified" || info "webhook notify failed"
  fi
  if [ -n "${ALERT_EMAIL:-}" ] && command -v mailx >/dev/null 2>&1; then
    mailx -s "[$HOSTNAME_LABEL] security scan: $CRIT critical" "$ALERT_EMAIL" < "$REPORT" \
      && info "email sent to $ALERT_EMAIL" || info "email send failed"
  fi
fi

# keep 30 days of reports
find "$REPORT_DIR" -name '*.log' -mtime +30 -delete 2>/dev/null

exit "$CRIT"
