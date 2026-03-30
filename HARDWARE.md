# Hardware Setup Guide — Raspberry Pi 4 for Scion Sync

Self-hosted Obsidian vault sync on a Raspberry Pi 4, designed for reliability in hot climates (tested for 50°C ambient in Amravati, Maharashtra).

---

## 1. Bill of Materials

| Component | Recommendation | Why |
|-----------|---------------|-----|
| **Raspberry Pi 4** | 4GB minimum, 8GB recommended | 4GB is enough for Scion; 8GB gives headroom for other services |
| **USB 3.0 SSD** | Samsung T7 Shield 256GB or SanDisk Extreme 256GB | Heat-rated to 45°C operating. **Do not use SD card for vault data** — SD cards wear out fast under write-heavy workloads |
| **Budget SSD option** | Any SATA SSD (120GB+) + USB 3.0 enclosure | Cheaper, same durability, slightly bulkier |
| **Heatsink case** | Argon ONE M.2 or Geekworm aluminum armor case | Passive cooling — entire case acts as heatsink. Critical for 50°C ambient |
| **UPS** | PiSugar 3 HAT or 10,000mAh USB-C power bank | Clean shutdown on power cuts — prevents SQLite/git corruption |
| **Power supply** | Official RPi USB-C PSU (5.1V, 3A) | Under-voltage causes random crashes and SD card corruption |
| **SD card** | 32GB Class 10 (for OS only) | Vault data goes on SSD, not here |

**Total cost**: ~₹8,000–12,000 depending on SSD choice.

---

## 2. SSD Setup

### Format and mount

```bash
# Find the SSD (usually /dev/sda1 after plugging in USB)
lsblk

# Format as ext4 (skip if already formatted)
sudo mkfs.ext4 /dev/sda1

# Create mount point
sudo mkdir -p /mnt/ssd

# Mount
sudo mount /dev/sda1 /mnt/ssd
```

### Add to `/etc/fstab` for auto-mount on boot

```bash
# Get UUID
sudo blkid /dev/sda1

# Add to fstab (replace UUID with yours)
echo 'UUID=your-uuid-here /mnt/ssd ext4 defaults,noatime 0 2' | sudo tee -a /etc/fstab
```

The `noatime` flag disables access-time writes, reducing unnecessary SSD wear.

### Create Scion data directory

```bash
sudo mkdir -p /mnt/ssd/scion-vault
sudo chown 1001:1001 /mnt/ssd/scion-vault
```

### Verify write speed

```bash
dd if=/dev/zero of=/mnt/ssd/test bs=4k count=10000 oflag=direct
# Expect: >30 MB/s for USB 3.0 SSD
rm /mnt/ssd/test
```

### Set Docker environment

In your `.env` or `docker-compose.yml`:

```bash
VAULT_HOST_PATH=/mnt/ssd/scion-vault
```

---

## 3. Cooling for Hot Climate (50°C Ambient)

Amravati summers hit 48–50°C. The Pi throttles at 80°C and shuts down at 85°C. With ambient at 50°C, you only have 30°C of thermal headroom.

### Mandatory

- **Aluminum heatsink case** — the entire case conducts heat away from the SoC. Passive cooling handles idle + moderate load at 50°C ambient.
- **Placement**: indoors, shaded room, away from walls and corners. Not in a closed cabinet or shelf — needs airflow.

### Monitor temperature

```bash
# Check current temperature
vcgencmd measure_temp

# Target: < 70°C under sustained load
# Warning: > 75°C = throttling imminent
# Critical: > 80°C = performance drops
```

### Optional: lower fan threshold

If your case has a fan (Argon ONE), lower the trigger temperature in `/boot/config.txt`:

```
# Default is usually 60°C, lower to 50°C for hot climate
dtparam=fan_temp0=45000
dtparam=fan_temp0_speed=75
```

### Monitoring script (add to cron)

```bash
#!/bin/bash
# /usr/local/bin/temp-monitor.sh
TEMP=$(vcgencmd measure_temp | grep -oP '[0-9.]+')
if (( $(echo "$TEMP > 75" | bc -l) )); then
  echo "WARNING: Pi temperature is ${TEMP}°C" | logger -t scion-temp
fi
```

```bash
# Run every 5 minutes
echo '*/5 * * * * /usr/local/bin/temp-monitor.sh' | sudo crontab -
```

---

## 4. Power Reliability

Power cuts are common in Amravati. Without a UPS, the Pi will hard-crash, risking SQLite WAL corruption and partial git writes.

### Option A: PiSugar 3 HAT (recommended)

- Mounts directly on the Pi GPIO header
- Provides ~2 hours of runtime on a full charge
- Has software that can trigger clean shutdown when battery is low

```bash
# Install PiSugar power manager
curl https://cdn.pisugar.com/release/pisugar-power-manager.sh | sudo bash

# Configure auto-shutdown at 20% battery
# Via web UI at http://<pi-ip>:8421
```

### Option B: USB-C Power Bank

- 10,000mAh bank between wall adapter and Pi
- Provides passthrough charging (make sure the bank supports it)
- No auto-shutdown — but buys 3–5 hours for power to return

### Scion's built-in protection

Even without a UPS, Scion's hardened storage layer protects against corruption:
- SQLite runs with `synchronous = FULL` — every write is fsynced
- File writes use fsync before git staging
- `manifest.json` uses atomic write-then-rename
- On startup, git state is validated and dirty state from crashes is reset
- Corrupt SQLite databases are auto-rebuilt from `manifest.json`

The UPS prevents the *need* for recovery. The hardening ensures recovery *works* when needed.

---

## 5. Network (Tailscale)

All devices connect via Tailscale — no port forwarding, no public exposure, no dynamic DNS.

### Install on Pi

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

### Note the Tailscale IP

```bash
tailscale ip -4
# Example: 100.64.x.x
```

### Connect clients

All clients point to the Tailscale IP:

| Client | Configuration |
|--------|--------------|
| **Mac (Obsidian)** | Plugin settings → Server URL: `http://100.64.x.x:3000` |
| **iPhone (Obsidian)** | Same URL — Tailscale runs as a VPN on iOS |
| **CLI agent** | `curl http://100.64.x.x:3000/vault/MyVault/manifest` |
| **Telegram bot** | Middleware service hitting same endpoints |

### Tailscale is always-on

```bash
# Ensure Tailscale starts on boot
sudo systemctl enable tailscaled
```

---

## 6. Docker Deployment

### docker-compose.yml (production)

The `server/docker-compose.yml` in this repo is production-ready. Key settings:

```yaml
services:
  scion-sync:
    image: scion-sync:latest
    restart: unless-stopped
    stop_signal: SIGTERM
    stop_grace_period: 10s     # Time for clean DB shutdown
    ports:
      - "3000:3000"
    environment:
      - PORT=3000
      - HOST=0.0.0.0
      - LOG_LEVEL=info
      - VAULT_PATH=/data/vault
    volumes:
      - /mnt/ssd/scion-vault:/data/vault   # SSD mount
```

### Build and start

```bash
cd /path/to/scion/server
docker compose build
docker compose up -d
```

### Auto-start on boot

Docker itself should auto-start. Verify:

```bash
sudo systemctl enable docker
```

The `restart: unless-stopped` policy means the container restarts after crashes and reboots, but stays stopped if you manually stop it.

### Systemd service (alternative to Docker restart policy)

If you prefer explicit systemd control, use the included `scion-sync.service`:

```bash
sudo cp server/scion-sync.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable scion-sync
sudo systemctl start scion-sync
```

### Log rotation

Already configured in `docker-compose.yml`:

```yaml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

This caps logs at 30MB total (3 × 10MB files). Enough for debugging without filling the SSD.

### View logs

```bash
docker compose logs -f scion-sync
docker compose logs --tail 100 scion-sync
```

---

## 7. Backup Strategy

### Primary: rclone to cloud (daily)

```bash
# Install rclone
curl https://rclone.org/install.sh | sudo bash

# Configure a remote (e.g., Google Drive)
rclone config
# Follow prompts to set up remote named "gdrive"

# Test
rclone ls gdrive:scion-backup
```

### Cron job

```bash
# Daily backup at 3 AM
echo '0 3 * * * rclone sync /mnt/ssd/scion-vault gdrive:scion-backup --log-file /var/log/scion-backup.log --log-level INFO' | sudo crontab -
```

This backs up the entire vault directory, including git history, so you get full file history on recovery.

### Supported rclone remotes

Any rclone remote works: Google Drive, S3, Backblaze B2, Dropbox, OneDrive, SFTP, etc.

### Dual-layer backup (recommended)

For maximum safety, use both git push and encrypted off-site backup:

| Layer | Tool | Target | Cost | Purpose |
|---|---|---|---|---|
| Primary | `git push` | GitHub private repo | $0 | Fast recovery, full commit history |
| Secondary | `restic` | Backblaze B2 (encrypted) | ~₹4/month | Encrypted off-site, survives GitHub issues |

#### Setup

```bash
# Add GitHub as a remote for each vault
cd /mnt/ssd/scion-vault/YourVault
git remote add backup git@github.com:youruser/scion-vault-backup.git

# Install restic
sudo apt install restic

# Initialize restic repo on Backblaze B2
export B2_ACCOUNT_ID=your-account-id
export B2_ACCOUNT_KEY=your-account-key
restic init -r b2:scion-backup
```

#### Cron schedule

```bash
# Every 6 hours: push git to GitHub
0 */6 * * * cd /mnt/ssd/scion-vault/YourVault && git push backup main 2>&1 | logger -t scion-git-backup

# Daily at 3 AM: encrypted backup to B2
0 3 * * * restic backup /mnt/ssd/scion-vault -r b2:scion-backup && restic forget --keep-daily 7 --keep-weekly 4 --keep-monthly 6 --prune 2>&1 | logger -t scion-restic-backup
```

The `restic forget` command prunes old snapshots: keeps 7 daily, 4 weekly, 6 monthly.

---

## 8. Multiple Access Points

Scion uses a simple REST protocol. Any HTTP client can sync.

| Client | How |
|--------|-----|
| **Mac / iPhone (Obsidian)** | Install the Scion Sync plugin. Set server URL to `http://<tailscale-ip>:3000`. Works on both platforms identically. |
| **CLI agent** | `curl` or a script hitting `/vault/:name/push`, `/vault/:name/status`, `/vault/:name/manifest`. See server README for API. |
| **Telegram bot** | A middleware service (Node.js, Python, etc.) that receives Telegram messages, writes them to a file, and pushes via the Scion API. |
| **Other devices** | Anything that can make HTTP requests over Tailscale can read/write vaults. |

All clients use the same push/pull protocol — no special configuration per client type. The server doesn't care what's connecting, only that it speaks the protocol.

---

## Quick Start Checklist

1. [ ] Flash Raspberry Pi OS Lite (64-bit) to SD card
2. [ ] Boot Pi, run `sudo apt update && sudo apt upgrade`
3. [ ] Connect and format USB SSD, add to `/etc/fstab` with `noatime`
4. [ ] Install Docker: `curl -fsSL https://get.docker.com | sh`
5. [ ] Install Tailscale: `curl -fsSL https://tailscale.com/install.sh | sh && sudo tailscale up`
6. [ ] Clone Scion repo, build Docker image, start with `docker compose up -d`
7. [ ] Configure Obsidian plugin with `http://<tailscale-ip>:3000`
8. [ ] Set up daily backup via rclone or restic
9. [ ] (Optional) Install PiSugar or connect UPS for power protection
10. [ ] Test: create a note on one device, verify it appears on another
