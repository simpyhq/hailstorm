# ops/security — daily security scan for ClarixHost

A focused daily check on the Hetzner box (`65.21.192.12`) designed around
**the actual things that would have caught the verum-cms compromise**
(abuse case `2606:QG6HQTKVGNVO`, dwell window May 4 – Jun 1 2026).

## What each check covers

| Check | Catches |
|---|---|
| `docker diff` on each running container, filtered to sensitive paths | a binary injected into a container at runtime (the verum-cms vector) |
| `ss -tln` vs. allowlist `[22, 80, 443, 41641]` + explicit deny list of `[11434, 2375/6, 8000, 8080, 9000, 9443, 6379, 27017, 5432, 3306, 5984, 9200, 11211]` | a service accidentally bound to a public interface (the Ollama vector) |
| `ss state syn-sent` rate threshold + outbound peer diversity | an active outbound scan in progress (the June 1 burst) |
| `ps auxf` and `docker top` against a known-bad name list (`masscan`, `zmap`, `nuclei`, `xmrig`, `kinsing`, `safenet`, …) | the scanner/miner once it's running |
| `find /tmp /var/tmp /dev/shm -executable -mtime -1` | freshly-dropped binaries |
| `~/.ssh/authorized_keys` diff vs. snapshot | a new key being added for persistence |
| crontab + `/etc/cron.*` + `/var/spool/cron` diff vs. snapshot | cron-based persistence |
| `systemctl list-unit-files` diff vs. snapshot | a new systemd service/timer being enabled |
| `find /etc /usr/local/{bin,sbin} -mtime -1` | freshly-modified system files |
| SSH auth-failure rate over the last 24h | bruteforce attempts ramping up |
| ClamAV scan of dropper paths *(optional, installed if present)* | known malware signatures |
| `rkhunter` *(optional, installed if present)* | rootkits + tampered binaries |

Critical findings exit non-zero, write to `/var/log/security-scan/<DATE>.log`,
publish a one-line JSON summary at `/var/log/security-scan/latest.json`,
and (if configured) POST to a webhook + email the full report.

## Install

On the Hetzner box, from a checkout of this repo:

```bash
sudo ops/security/install.sh
```

That:
1. Drops `daily-security-scan.sh` into `/usr/local/sbin/`
2. Installs the systemd service + timer (runs daily at 04:00 UTC with ±30min jitter)
3. Creates `/etc/security-scan.env` (empty by default — edit to enable alerts)
4. Enables and starts the timer

Then seed the baseline snapshots + verify with one manual run:

```bash
sudo systemctl start security-scan.service
sudo journalctl -u security-scan.service -e --no-pager | tail -80
sudo less /var/log/security-scan/$(date -u +%Y-%m-%d).log
```

The first run will set baselines for `authorized_keys`, cron, and systemd
units — subsequent runs flag *changes* against that baseline.

## Alerting

Edit `/etc/security-scan.env` (mode 0600) and set either or both:

```sh
ALERT_WEBHOOK=https://hooks.slack.com/services/...   # or Discord, Mattermost, etc.
ALERT_EMAIL=ops@example.com                          # requires mailx configured
HOSTNAME_LABEL=clarixhost
```

Alerts only fire on **CRITICAL** findings (not WARNs), so the channel
stays signal-only.

## Tuning out false positives

When a check legitimately fires (e.g. you deploy a new service that listens
on a non-allowlisted port), adjust the script rather than silencing the
check:

- New public-bound port that's intentional → add it to the allowlist
  regex in section **2. Public-bound services**.
- A container that writes a lot to non-temp paths → extend the filter
  in section **1. Container filesystem drift**.
- New cron job that's intentional → just acknowledge the WARN once;
  the next run will see it as the new baseline.

## Optional companions

These are not part of the script but pair well with it:

- **CrowdSec** — community-driven IPS that bans IPs hitting known attack
  patterns (SSH brute, web exploit scanners). Reactive, complements the
  scan's detective controls. `curl -s https://install.crowdsec.net | sudo sh`.
- **Trivy** — `trivy image <name>` to scan container images for known CVEs
  before/after deploy. Can be wired into Coolify deploy hooks.
- **AIDE** — full filesystem integrity baseline. Heavier than what's here;
  use if you want defense-in-depth.

## Removal

```bash
sudo systemctl disable --now security-scan.timer
sudo rm /etc/systemd/system/security-scan.{service,timer} /usr/local/sbin/daily-security-scan.sh
sudo systemctl daemon-reload
# logs and snapshots:
sudo rm -rf /var/log/security-scan /var/lib/security-scan /etc/security-scan.env
```
