Here is a comprehensive, step-by-step implementation plan designed for a coding agent. This plan assumes the **"State-Tracking" Approach** (Method 1) combined with **SQLite** and **Tailscale** as discussed. This strikes the best balance between complexity and reliability for a solo developer.

---

### **Project Architecture Overview**

* **Backend:** Node.js (Fastify) running on Raspberry Pi.
* **Database:** SQLite (managed via `better-sqlite3` or `Prisma`) to track file metadata (hashes, timestamps).
* **Storage:** Direct file system access on the Pi for the vault contents.
* **Connectivity:** Tailscale for secure, zero-config remote access (iOS/macOS).
* **Conflict Strategy:** Server-side "Last Known Revision" check + "Conflict File" creation (safest for Obsidian).

---

### **Phase 1: Raspberry Pi Server Setup (The "Source of Truth")**

**Goal:** Create a secure API that accepts files and serves the latest state.

1. **Initialize Project:**
* Set up a Node.js project using **Fastify** (low overhead).
* Install dependencies: `fastify`, `better-sqlite3`, `crypto` (for hashing), `fs-extra`.


2. **Database Schema (SQLite):**
* Create a table `files`:
* `path` (TEXT, Primary Key): Relative path in the vault (e.g., `Folder/Note.md`).
* `hash` (TEXT): SHA-256 hash of the content.
* `updated_at` (INTEGER): Unix timestamp of the last server-side write.
* `revision` (INTEGER): Incrementing number to track versions.




3. **API Endpoints:**
* `GET /manifest`: Returns the full list of files with their hashes and revision numbers.
* `GET /file/:path`: Downloads the raw content of a specific file.
* `POST /sync`: Accepts a file upload.
* **Logic:**
1. Receive `path`, `content`, `client_revision`.
2. Check DB: If `server_revision > client_revision`, **REJECT** (Client is out of date).
3. If revisions match (or file is new), write file to disk, update DB hash/revision.






4. **Security & Access:**
* **Agent Task:** Configure the server to listen on the Tailscale IP address only, or require a simple Bearer Token in headers to prevent unauthorized uploads.



---

### **Phase 2: Obsidian Plugin Core (The "Client")**

**Goal:** A plugin that watches for changes and maintains a local "sync state."

1. **Plugin Skeleton:**
* Initialize an Obsidian plugin using the standard TypeScript template.
* Create a `data.json` specifically for the plugin to store **Local Sync State** (a map of `path` -> `last_synced_hash`, `last_synced_revision`).


2. **File Watcher:**
* Hook into Obsidian's `vault.on('modify')`, `vault.on('create')`, and `vault.on('delete')` events.
* **Agent Task:** Implement a "debounce" function (wait 2 seconds after typing stops) before triggering a sync event to avoid spamming the server.


3. **The "Pull" Logic (Startup & Online):**
* When the plugin loads (or reconnects):
1. Fetch `/manifest` from the server.
2. Compare Server Manifest vs. Local Files.
3. **Download:** If server has a file we don't (or has a higher revision), download and overwrite local.
4. **Upload:** If we have a file the server doesn't (or our local file has changed since last sync), mark for upload.





---

### **Phase 3: Conflict Resolution & Offline Handling**

**Goal:** Handle the "I edited on iPad while offline, and on Mac while online" scenario.

1. **Offline Queue:**
* Implement an `UploadQueue` in the plugin.
* If a request fails (network error), add the file path to the queue.
* Retry mechanism: Attempt to process the queue every 60 seconds or when the window gains focus.


2. **Conflict Logic (The "Safe" Approach):**
* **Scenario:** Server rejects an upload because the server version is newer.
* **Action:**
1. Download the server version as `filename.sync-remote.md`.
2. Keep the local user version as `filename.md`.
3. **User Notification:** Display an Obsidian notice: *"Conflict detected in [filename]. Remote version saved as duplicate."*
4. Update the local sync state to match the server's revision for the remote file.





---

### **Phase 4: Testing & Deployment**

**Goal:** Verify the system works without data loss.

1. **Tailscale Setup:**
* **Agent Task:** Provide instructions to install Tailscale on the Pi and the iOS/Mac devices. The server URL will be `http://<tailscale-ip>:3000`.


2. **Test Scenarios:**
* **Basic:** Edit on Mac -> Appears on Pi -> Appears on iOS.
* **Offline:** Turn off Wi-Fi on Mac, edit a file. Edit same file on iOS (online). Turn on Mac Wi-Fi. Verify conflict file is created.
* **Binary Files:** Ensure images/PDFs sync correctly (handle as binary buffers, not text).



---

### **Summary of Agent Tasks**

To execute this, you can issue these specific prompts to your coding agent:

1. *"Create a Fastify server with SQLite that tracks file hashes and revisions. It needs `GET /manifest` and `POST /sync` endpoints."*
2. *"Write a TypeScript class for an Obsidian plugin that creates a debounced queue for file modifications."*
3. *"Implement a comparison function that takes a server manifest and local file list, identifying which files need to be downloaded or uploaded."*

