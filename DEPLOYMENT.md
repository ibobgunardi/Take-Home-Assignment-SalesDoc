# Deployment

> **State is in memory (D-10).** A redeploy or restart clears sessions and CRM
> data. Leads are re-seeded on boot, so a restarted instance is immediately
> usable; an in-flight session created before a restart returns `404` and the UI
> sends you back to Screen 1 with a "session expired" message.

## Routine redeploy

```bash
./deploy.sh
```

It builds the client, ships `server/src` + `client/dist` + the manifests over
SSH, installs production dependencies, and restarts the service. The SSH host
alias `salesdoc` (defined in `~/.ssh/config`, outside this repo) carries the
host, user and key — no credential appears in this repository.

## One-time server provisioning (already done)

Recorded so the deployment is reproducible, not so it needs re-running.

**1. systemd unit** — `/etc/systemd/system/salesdoc-dialer.service`

```ini
[Unit]
Description=SalesDoc Multi-Line Dialer (take-home Task 1)
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/salesdoc-dialer
Environment=NODE_ENV=production
Environment=PORT=3200
ExecStart=/usr/bin/node server/src/index.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload && systemctl enable --now salesdoc-dialer
```

**2. nginx reverse proxy** — `/etc/nginx/sites-available/salesdoc-dialer`,
symlinked into `sites-enabled/`:

```nginx
server {
    listen 80;
    listen [::]:80;

    location / {
        proxy_pass http://127.0.0.1:3200;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**3. TLS** — `sslip.io` resolves `<ip>.sslip.io` to that IP, so Let's Encrypt
can issue a certificate without owning a domain:

```bash
certbot --nginx -d 72.61.214.167.sslip.io --agree-tos --redirect
```

certbot rewrote the block above to listen on 443 and added the HTTP→HTTPS
redirect. Renewal is on certbot's existing scheduled timer.

## Why nginx and not Caddy (D-20)

D-19 originally specified Caddy. The target VPS already runs nginx on :80 and
:443 for sixteen unrelated production sites, so Caddy has no port to bind and
installing it would have meant displacing a live TLS terminator. Reusing nginx
reaches the same result — real Let's Encrypt certificate, HTTP→HTTPS redirect,
reverse proxy to the Node process — by adding one new `server_name` block and
touching nothing else. See `docs/decisions.md` D-20.

## Ports

`3200`. The VPS already had 3000, 3001, 3010, 4001, 5000, 5009, 8000, 8080 in
use by other applications, so D-19's illustrative `localhost:3000` was not
available.
