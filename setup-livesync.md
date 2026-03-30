# Obsidian LiveSync Setup Guide

Self-hosted sync solution using Raspberry Pi as the central server with CouchDB.

## Architecture

```
┌─────────┐     ┌─────────────────┐     ┌─────────┐
│  macOS  │────▶│  Raspberry Pi   │◀────│   iOS   │
└─────────┘     │   (CouchDB)     │     └─────────┘
                └────────┬────────┘
                         │
                ┌────────┴────────┐
                │     Android     │
                └─────────────────┘
```

All devices connect via Tailscale network.

---

## Step 1: Raspberry Pi - Install Docker

SSH into your Pi:

```bash
ssh pi@YOUR_PI_TAILSCALE_IP
```

Install Docker:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh

# Add your user to docker group
sudo usermod -aG docker $USER

# Apply group changes (or logout/login)
newgrp docker

# Verify
docker --version
```

---

## Step 2: Setup CouchDB

Create project directory:

```bash
mkdir -p ~/obsidian-sync && cd ~/obsidian-sync
```

Create `docker-compose.yml`:

```bash
cat > docker-compose.yml << 'EOF'
version: "3.8"
services:
  couchdb:
    image: couchdb:3
    container_name: obsidian-couchdb
    environment:
      - COUCHDB_USER=admin
      - COUCHDB_PASSWORD=CHANGE_THIS_PASSWORD
    volumes:
      - ./couchdb-data:/opt/couchdb/data
      - ./couchdb-config:/opt/couchdb/etc/local.d
    ports:
      - "5984:5984"
    restart: unless-stopped
EOF
```

**Important**: Change `CHANGE_THIS_PASSWORD` to a secure password!

```bash
# Edit the file to set your password
nano docker-compose.yml
```

Start CouchDB:

```bash
docker compose up -d

# Verify it's running
docker ps

# Check logs if needed
docker logs obsidian-couchdb
```

Verify CouchDB is accessible:

```bash
curl http://localhost:5984/
# Should return: {"couchdb":"Welcome",...}
```

---

## Step 3: Configure CouchDB for LiveSync

Create a setup script (replace `YOUR_PASSWORD` with the password you set):

```bash
cat > setup-couchdb.sh << 'EOF'
#!/bin/bash
COUCHDB_URL="http://admin:YOUR_PASSWORD@localhost:5984"

echo "Creating system databases..."
curl -X PUT "$COUCHDB_URL/_users"
curl -X PUT "$COUCHDB_URL/_replicator"

echo "Creating obsidian database..."
curl -X PUT "$COUCHDB_URL/obsidian"

echo "Configuring CORS..."
curl -X PUT "$COUCHDB_URL/_node/_local/_config/httpd/enable_cors" -d '"true"'
curl -X PUT "$COUCHDB_URL/_node/_local/_config/cors/origins" -d '"app://obsidian.md,capacitor://localhost,http://localhost"'
curl -X PUT "$COUCHDB_URL/_node/_local/_config/cors/credentials" -d '"true"'
curl -X PUT "$COUCHDB_URL/_node/_local/_config/cors/methods" -d '"GET, PUT, POST, HEAD, DELETE"'
curl -X PUT "$COUCHDB_URL/_node/_local/_config/cors/headers" -d '"accept, authorization, content-type, origin, referer"'

echo "Configuring max document size (100MB)..."
curl -X PUT "$COUCHDB_URL/_node/_local/_config/httpd/max_http_request_size" -d '"4294967296"'

echo "Done! CouchDB is configured for LiveSync."
EOF
```

Edit and run:

```bash
# Replace YOUR_PASSWORD in the script
nano setup-couchdb.sh

# Make executable and run
chmod +x setup-couchdb.sh
./setup-couchdb.sh
```

Verify database was created:

```bash
curl http://admin:YOUR_PASSWORD@localhost:5984/_all_dbs
# Should show: ["_replicator","_users","obsidian"]
```

---

## Step 4: Get Your Pi's Tailscale Hostname

```bash
# On Pi, get your Tailscale IP and hostname
tailscale ip -4
tailscale status

# Your URL will be something like:
# http://raspberrypi.tailnet-name.ts.net:5984
# or
# http://100.x.x.x:5984
```

Note this down - you'll use it on all devices. Example format:

```
http://YOUR_PI_TAILSCALE_IP:5984
```

Test from your Mac (should work over Tailscale):

```bash
curl http://YOUR_PI_TAILSCALE_IP:5984/
```

---

## Step 5: Setup macOS (Primary Device)

### 5.1 Install the Plugin

1. Open Obsidian
2. Go to **Settings → Community Plugins → Browse**
3. Search for **"Self-hosted LiveSync"**
4. Click **Install**, then **Enable**

### 5.2 Configure the Plugin

1. Go to **Settings → Self-hosted LiveSync**
2. Click **🧙‍♂️ Setup wizard** button
3. Select **"Use the copied setup URI"** → **No, I don't have one**
4. Select **"Do you have a remote database?"** → **Yes**
5. Enter connection details:

   ```
   URI: http://YOUR_PI_TAILSCALE_IP:5984
   Username: admin
   Password: YOUR_PASSWORD
   Database name: obsidian
   ```

6. Click **Check** to verify connection
7. Select **"Enable End-to-End Encryption"** → **Yes** (recommended)
   - Set a strong passphrase (you'll need this on all devices)
8. **Important**: Select **"This is my first device"** or **"Setup as primary device"**
9. Choose sync mode: **"LiveSync"** for real-time sync

### 5.3 Initial Upload

1. After wizard completes, go to plugin settings
2. Under **Sync Settings**:
   - Enable **LiveSync**
   - Enable **Sync on Save**
   - Enable **Sync on Editor Save**
   - Enable **Sync on File Open**
3. Click **"Replicate Now"** to upload your vault
4. Wait for initial sync to complete (check the status bar)

---

## Step 6: Setup iOS

### 6.1 Generate Setup URI on macOS

This is the easiest way - export config from Mac and import on iOS.

On **macOS Obsidian**:

1. Go to **Settings → Self-hosted LiveSync**
2. Scroll to **"Setup URI"** section
3. Click **"Copy setup URI"**
4. Send this to your iOS device (AirDrop, Notes, or any secure method)

### 6.2 Setup on iOS

1. **Ensure Tailscale is connected** on your iPhone/iPad
2. Open **Obsidian** on iOS
   - Create a new vault with the **same name** as your Mac vault
   - Or create any empty vault first
3. Go to **Settings → Community Plugins**
   - Turn OFF **Restricted Mode**
   - Go to **Browse** → Search **"Self-hosted LiveSync"**
   - Install and Enable
4. Go to **Settings → Self-hosted LiveSync**
5. Click **🧙‍♂️ Setup wizard**
6. Select **"Use the copied setup URI"** → **Yes**
   - Paste the URI from Mac
   - Enter your encryption passphrase
7. Select **"This is a secondary device"** or **"Fetch from remote"**
8. The plugin will download your vault from the Pi

### 6.3 iOS-Specific Settings

In plugin settings, ensure:

- **Sync on Save**: Enabled
- **LiveSync**: Enabled
- **Periodic Sync**: Enable as backup (every 5 minutes)

---

## Step 7: Setup Android

1. Install Tailscale, ensure connected
2. Install Obsidian
3. Create vault with same name
4. Install Self-hosted LiveSync plugin
5. Use Setup URI from Mac, or manually enter:

   ```
   URI: http://YOUR_PI_TAILSCALE_IP:5984
   Username: admin
   Password: YOUR_PASSWORD
   Database name: obsidian
   Passphrase: YOUR_ENCRYPTION_PASSPHRASE
   ```

6. Select "Secondary device" / "Fetch from remote"

---

## Step 8: Verify Everything Works

### Test 1: Create a Note

1. On **Mac**: Create a new note "Test Sync"
2. Add some text
3. Check **iOS** - it should appear within seconds

### Test 2: Rename a File

1. On **Mac**: Rename "Test Sync" to "Test Sync Renamed"
2. Check **iOS** - verify only ONE file exists with new name
3. Repeat from iOS → Mac

### Test 3: Conflict Resolution

1. Put iOS in **Airplane Mode**
2. Edit the same note on both Mac and iOS
3. Re-enable network on iOS
4. LiveSync should auto-merge or show conflict dialog

---

## Quick Reference

| Setting        | Value                                |
| -------------- | ------------------------------------ |
| CouchDB URL    | `http://YOUR_PI_TAILSCALE_IP:5984`   |
| Username       | `admin`                              |
| Password       | (your password)                      |
| Database       | `obsidian`                           |
| Encryption     | Enabled (same passphrase everywhere) |

---

## Maintenance Commands

```bash
# Check CouchDB status
docker ps
docker logs obsidian-couchdb

# Restart CouchDB
cd ~/obsidian-sync
docker compose restart

# Backup database
docker exec obsidian-couchdb tar -cvf - /opt/couchdb/data > couchdb-backup.tar

# View database stats
curl http://admin:YOUR_PASSWORD@localhost:5984/obsidian

# Compact database (run periodically to reclaim space)
curl -X POST http://admin:YOUR_PASSWORD@localhost:5984/obsidian/_compact
```

---

## Troubleshooting

| Issue                    | Solution                                            |
| ------------------------ | --------------------------------------------------- |
| Can't connect from Mac/iOS | Verify Tailscale is connected: `tailscale status` |
| "Database not found"     | Run `setup-couchdb.sh` again                        |
| Sync stuck               | Click "Replicate Now" in plugin settings            |
| Conflicts appearing      | Check "Show conflict dialog" in settings            |
| Slow sync                | Enable "Batch size" increase in advanced settings   |
| CORS errors              | Re-run the CORS configuration in setup script       |

---

## Resources

- [Self-hosted LiveSync GitHub](https://github.com/vrtmrz/obsidian-livesync)
- [CouchDB Documentation](https://docs.couchdb.org/)
- [Tailscale Documentation](https://tailscale.com/kb/)
