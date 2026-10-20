# Webhook & Tunnel Infrastructure Runbook

This covers the local pieces that let GitHub webhooks (e.g. `ai-review`,
PR-triggered Hermes cron jobs) reach this machine, and the automated health
check that watches them.

## What's running

| Component | What it does | Where |
|---|---|---|
| `cloudflared` | Cloudflare Tunnel daemon. Exposes a local port to the public internet without opening an inbound firewall port. | Windows Scheduled Task **`CloudflaredTunnel_tilemap-io`** |
| Local webhook service | Receives tunnel traffic on `http://localhost:8644`, including `/health`. | Runs as whatever process is configured in the tunnel's ingress rule — check `config.yml` below for the exact target. |
| Hermes gateway | Hosts/orchestrates Hermes itself (cron jobs, Discord bot, etc.) — not the webhook service, but on the same machine and relied on for alerting. | Windows Scheduled Task **`Hermes_Gateway`** |
| Hermes cron health check | `webhook_tunnel_healthcheck.py`, runs every 45 minutes via `hermes cron`, checks both endpoints below and posts to the Discord home channel only on failure. | Hermes cron job (see below) |

## Where the config lives

- Cloudflare Tunnel config: `C:\Users\Henry\.cloudflared\config.yml`
  - Tunnel UUID: `2048109a-1581-466f-9312-21a1cef64ee5`
  - Public hostname: `hooks.cfdomaintest.bid`
  - Local ingress target: `http://localhost:8644`
- Health check script: `%LOCALAPPDATA%\hermes\scripts\webhook_tunnel_healthcheck.py`
  (i.e. `C:\Users\Henry\AppData\Local\hermes\scripts\webhook_tunnel_healthcheck.py`)
- Discord bot credentials (token, home channel ID): `%LOCALAPPDATA%\hermes\.env`
  — `DISCORD_BOT_TOKEN`, `DISCORD_HOME_CHANNEL`. Never print these in plain
  text; treat as secrets.
- Hermes cron job definitions: `%LOCALAPPDATA%\hermes\cron\jobs.json`
  (managed via the `hermes cron` CLI, not hand-edited).

## How to check health manually

```bash
# 1. Is the cloudflared process alive?
tasklist | grep -i cloudflared
# or, for the Scheduled Task wrapper:
schtasks /query /TN "CloudflaredTunnel_tilemap-io" /V /FO LIST

# 2. Is the local webhook service answering?
curl -i http://localhost:8644/health

# 3. Is the tunnel actually routing traffic end-to-end (proves it's not
#    just the local process that's up — this hits the public internet and
#    comes back through Cloudflare)?
curl -i https://hooks.cfdomaintest.bid/health
```

All three should return `200`. If (1) is fine but (2) fails, the local
service itself is down. If (1) and (2) are fine but (3) fails, the tunnel
is the broken link.

**Gotcha confirmed while building this runbook:** Cloudflare's WAF returns a
bare `403` for requests whose `User-Agent` looks like a scripting library's
default (e.g. Python's `urllib`'s own `Python-urllib/x.y`), even though the
origin is completely healthy. `curl`'s default UA passes fine. Any
script/monitor hitting the public URL must set an explicit, non-default
`User-Agent` header or it will report a false failure. The health check
script in this repo's cron job already does this
(`User-Agent: tilemap-io-healthcheck/1.0`) — don't strip it back out.

## Automated monitoring

A Hermes cron job (`hermes cron list` to see it, name: *"tilemap-io
webhook/tunnel health check"*) runs `webhook_tunnel_healthcheck.py` every 45
minutes in `--no-agent` mode (plain script, no LLM call — cheap and fast).
The script:

- Checks `http://localhost:8644/health` and `https://hooks.cfdomaintest.bid/health`.
- Prints **nothing** and exits `0` when both are healthy — no Discord
  message is sent on a clean tick.
- Prints a failure summary and exits `1` the moment either check fails —
  that stdout is delivered straight to the Discord home channel
  (`--deliver discord` / `--failure-deliver discord`).

Inspect run history with:

```bash
hermes cron runs <job-id>
hermes cron doctor   # overall health of all cron jobs
```

### Known limitation — Discord permissions

The Discord bot currently does **not** have the `Manage Webhooks`
permission in the home channel/server. This blocks creating a native
Discord *incoming webhook* for this alert (which would have been a
no-agent, zero-Hermes-involvement delivery path). The current design works
around this by having Hermes's own bot session post the message instead
(`--deliver discord`), which does not need `Manage Webhooks` — only normal
"send messages" permission, which the bot already has. No action needed
unless you specifically want a raw incoming-webhook integration instead;
if so, grant `Manage Webhooks` to the bot's role via Channel Settings →
Integrations → Webhooks (manual, in the Discord UI — the bot cannot grant
this to itself via the API).

## How to recover

**`cloudflared` / the tunnel is down:**
1. `schtasks /query /TN "CloudflaredTunnel_tilemap-io"` — check its last run
   result and status.
2. `schtasks /run /TN "CloudflaredTunnel_tilemap-io"` — restart it.
3. Re-check with `curl https://hooks.cfdomaintest.bid/health`.
4. If it still fails, check `C:\Users\Henry\.cloudflared\config.yml` for
   drift and look at cloudflared's own logs (Scheduled Task's configured
   working directory / log redirection, if any).

**The local webhook service (port 8644) is down but the tunnel itself is
fine:** the tunnel has nothing to route *to* — restart whatever process
`config.yml`'s ingress rule points `hooks.cfdomaintest.bid` at.

**Hermes itself (and therefore the cron health check and Discord alerting)
is down:**
1. `schtasks /query /TN "Hermes_Gateway"` — check status.
2. `schtasks /run /TN "Hermes_Gateway"` — restart it.
3. Note: if Hermes is down, the health-check cron job is also down, so you
   get *no* alert for this case by definition — if GitHub webhooks (PR
   reviews, auto-merge triggers) silently stop firing, check this task
   first even though nothing paged you.

## Smoke-testing the health check logic

The check function was validated against both a deliberately-broken target
(bogus local port + an invalid hostname — correctly detected failure, exit
`1`, printed the expected diagnostic) and the real healthy endpoints
(silent, exit `0`). Re-run this validation after any edit to
`webhook_tunnel_healthcheck.py`:

```bash
python C:/Users/Henry/AppData/Local/hermes/scripts/webhook_tunnel_healthcheck.py; echo "EXIT=$?"
```
