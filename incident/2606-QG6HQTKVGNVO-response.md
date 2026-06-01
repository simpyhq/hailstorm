# Hetzner Abuse Response — DRAFT (do not send until Step 2 + Step 4 done)

**To:** abuse-network@hetzner.com
**Subject:** Abuse-Message 2606:QG6HQTKVGNVO: Scan detected from IP-Address 65.21.192.12
**(Keep the abuse ID `2606:QG6HQTKVGNVO` unchanged in the subject — Hetzner explicitly requires this.)**

---

Hello Network-Abuse Team,

Thank you for the prompt notification regarding abuse case **2606:QG6HQTKVGNVO**.
We have investigated, contained the issue, and completed remediation.

**Server:** 65.21.192.12

## Summary

A [TBD: container / process / service] running on the host was compromised
via [TBD: e.g., an exposed Coolify admin endpoint / an exposed Docker
daemon TCP socket / a vulnerable client application]. The attacker used
the compromised foothold to run [TBD: masscan / zmap / nuclei], generating
the outbound TCP SYN scan to ports 80/443 across `74.51.156.0/24` and
`74.51.159.0/24` that your abuse monitoring detected between
`2026-06-01 05:29:03 UTC` and `2026-06-01 05:33:03 UTC`.

The scanning has stopped, the entry vector is closed, and credentials
that may have been exposed have been rotated.

## Timeline (UTC)

| Time | Event |
|------|-------|
| 2026-06-01 05:29:03 | First scan packet observed (per abuse report) |
| 2026-06-01 05:33:03 | Last scan packet observed (per abuse report) |
| 2026-06-01 05:33    | Hetzner abuse case 2606:QG6HQTKVGNVO opened |
| 2026-06-01 [HH:MM]  | Abuse notification received; incident response initiated |
| 2026-06-01 [HH:MM]  | Outbound traffic isolated at the Hetzner firewall |
| 2026-06-01 [HH:MM]  | Root cause identified: [TBD] |
| 2026-06-01 [HH:MM]  | Offending [container/process] removed; persistence cleared |
| 2026-06-01 [HH:MM]  | Credentials rotated: SSH keys, [Coolify admin], Docker registry tokens, Tailscale auth keys, all `.env` secrets on the host |
| 2026-06-01 [HH:MM]  | Verified via your statement URL — no further activity |

## Root cause

[TBD — fill in after Step 2 triage. Example:
"Coolify's control panel was reachable on the public interface at `:8000`
without sufficient access control. An attacker authenticated/exploited CVE-XXXX
and deployed a container running `masscan` against the IP ranges above."]

## Mitigations completed

- [TBD] container/process removed and image purged from local cache
- Outbound traffic on the host restricted to a default-deny policy with
  an explicit allowlist for legitimate destinations (package mirrors,
  Docker registries, monitoring endpoints)
- Coolify admin panel and the Docker daemon socket bound to `127.0.0.1`
  / restricted to the Tailscale interface (no longer reachable from
  the public internet)
- SSH restricted to key auth only, root login disabled, fail2ban
  re-enabled with stricter thresholds
- All `.env` files audited; every credential that touched the host
  has been rotated
- Container images currently deployed reviewed against latest CVEs
  and updated; any unmaintained app removed
- (If applicable) Host rebuilt from a known-good image rather than
  cleaned in place, given persistence risk

## Prevention going forward

- Public-facing admin surfaces (Coolify, Docker, Portainer, etc.) only
  reachable via Tailscale
- Hetzner Cloud firewall as a second layer of egress control (default
  deny outbound except an allowlist)
- Automated container image vulnerability scanning on deploy
- Log forwarding + alerting on anomalous outbound connection rates
  (catches a scan-bot in minutes rather than after an abuse report)

We confirmed via your test link (`https://abuse-network.hetzner.com/statement/09e66c86-080f-4b16-b114-ba9fe07ee991`)
that no further scanning is observed.

We apologize for the impact and appreciate the prompt notification.

Kind regards,
Christian Simpson
[role / company]
[reply-to address]
