(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __spreadValues = (a, b) => {
    for (var prop in b || (b = {}))
      if (__hasOwnProp.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    if (__getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(b)) {
        if (__propIsEnum.call(b, prop))
          __defNormalProp(a, prop, b[prop]);
      }
    return a;
  };
  var __markAsModule = (target) => __defProp(target, "__esModule", { value: true });
  var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
    get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
  }) : x)(function(x) {
    if (typeof require !== "undefined")
      return require.apply(this, arguments);
    throw new Error('Dynamic require of "' + x + '" is not supported');
  });
  var __reExport = (target, module, desc) => {
    if (module && typeof module === "object" || typeof module === "function") {
      for (let key of __getOwnPropNames(module))
        if (!__hasOwnProp.call(target, key) && key !== "default")
          __defProp(target, key, { get: () => module[key], enumerable: !(desc = __getOwnPropDesc(module, key)) || desc.enumerable });
    }
    return target;
  };
  var __toModule = (module) => {
    return __reExport(__markAsModule(__defProp(module != null ? __create(__getProtoOf(module)) : {}, "default", module && module.__esModule && "default" in module ? { get: () => module.default, enumerable: true } : { value: module, enumerable: true })), module);
  };
  var __async = (__this, __arguments, generator) => {
    return new Promise((resolve, reject) => {
      var fulfilled = (value) => {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      };
      var rejected = (value) => {
        try {
          step(generator.throw(value));
        } catch (e) {
          reject(e);
        }
      };
      var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
      step((generator = generator.apply(__this, __arguments)).next());
    });
  };

  // src/main.ts
  var import_obsidian6 = __toModule(__require("obsidian"));

  // src/types.ts
  var DEFAULT_V2_SETTINGS = {
    serverUrl: "http://localhost:3000",
    apiKey: "",
    nosyncPath: ".nosync",
    enableLogging: false,
    showNotifications: true
  };
  var SyncStatus;
  (function(SyncStatus2) {
    SyncStatus2["Idle"] = "idle";
    SyncStatus2["Pushing"] = "pushing";
    SyncStatus2["Pulling"] = "pulling";
    SyncStatus2["Error"] = "error";
  })(SyncStatus || (SyncStatus = {}));

  // src/settings.ts
  var import_obsidian = __toModule(__require("obsidian"));
  var VaultSyncV2SettingTab = class extends import_obsidian.PluginSettingTab {
    constructor(app, plugin) {
      super(app, plugin);
      this.plugin = plugin;
    }
    display() {
      const { containerEl } = this;
      containerEl.empty();
      containerEl.createEl("h2", { text: "Vault Sync v2 Settings" });
      containerEl.createEl("h3", { text: "Server Configuration" });
      new import_obsidian.Setting(containerEl).setName("Server URL").setDesc("URL of your Vault Sync server (e.g., http://localhost:3000 or http://192.168.1.100:3000)").addText((text) => text.setPlaceholder("http://localhost:3000").setValue(this.plugin.settings.serverUrl).onChange((value) => __async(this, null, function* () {
        this.plugin.settings.serverUrl = value.trim();
        yield this.plugin.saveSettings();
      })));
      new import_obsidian.Setting(containerEl).setName("API Key").setDesc("API key for authenticating with the server (keep this secret!)").addText((text) => text.setPlaceholder("your-api-key").setValue(this.plugin.settings.apiKey).onChange((value) => __async(this, null, function* () {
        this.plugin.settings.apiKey = value.trim();
        yield this.plugin.saveSettings();
      })).inputEl.type = "password");
      new import_obsidian.Setting(containerEl).setName("Test Connection").setDesc("Verify that the plugin can reach your server").addButton((button) => button.setButtonText("Test").onClick(() => __async(this, null, function* () {
        yield this.plugin.testConnection();
      })));
      containerEl.createEl("h3", { text: "Sync Configuration" });
      new import_obsidian.Setting(containerEl).setName(".nosync File Path").setDesc("Path to file containing patterns for files to exclude from sync (gitignore format)").addText((text) => text.setPlaceholder(".nosync").setValue(this.plugin.settings.nosyncPath).onChange((value) => __async(this, null, function* () {
        this.plugin.settings.nosyncPath = value.trim() || ".nosync";
        yield this.plugin.saveSettings();
      })));
      containerEl.createEl("h3", { text: "UI Settings" });
      new import_obsidian.Setting(containerEl).setName("Enable Logging").setDesc("Show detailed logs in console (Cmd+Option+I)").addToggle((toggle) => toggle.setValue(this.plugin.settings.enableLogging).onChange((value) => __async(this, null, function* () {
        this.plugin.settings.enableLogging = value;
        yield this.plugin.saveSettings();
      })));
      new import_obsidian.Setting(containerEl).setName("Show Notifications").setDesc("Display notifications for sync operations").addToggle((toggle) => toggle.setValue(this.plugin.settings.showNotifications).onChange((value) => __async(this, null, function* () {
        this.plugin.settings.showNotifications = value;
        yield this.plugin.saveSettings();
      })));
      containerEl.createEl("h3", { text: "Information" });
      containerEl.createEl("p", { text: "Push: Upload your local changes to the server" });
      containerEl.createEl("p", { text: "Pull: Download changes from the server to your vault" });
      containerEl.createEl("p", { text: "If conflicts are detected, you must manually resolve them before retrying." });
      const linksEl = containerEl.createEl("div", { cls: "vault-sync-links" });
      linksEl.createEl("a", {
        text: "Documentation",
        href: "#"
      }).onclick = (e) => {
        e.preventDefault();
      };
    }
  };

  // src/server-api.ts
  var import_obsidian2 = __toModule(__require("obsidian"));
  var ServerAPI = class {
    constructor(baseUrl, apiKey) {
      this.baseUrl = baseUrl.replace(/\/$/, "");
      this.apiKey = apiKey;
    }
    setApiKey(apiKey) {
      this.apiKey = apiKey;
    }
    getHeaders() {
      return {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/octet-stream"
      };
    }
    request(method, url, body) {
      return __async(this, null, function* () {
        const options = {
          method,
          headers: this.getHeaders()
        };
        if (body) {
          if (typeof body === "string") {
            options.body = (0, import_obsidian2.stringToArrayBuffer)(body);
          } else {
            options.body = body;
          }
        }
        try {
          const response = yield (0, import_obsidian2.requestUrl)(__spreadValues({ url }, options));
          return response;
        } catch (error) {
          throw new Error(`API request failed: ${error.message}`);
        }
      });
    }
    testConnection() {
      return __async(this, null, function* () {
        try {
          const url = `${this.baseUrl}/health`;
          const response = yield (0, import_obsidian2.requestUrl)({ url, method: "GET" });
          return response.status === 200;
        } catch (err) {
          return false;
        }
      });
    }
    listFiles() {
      return __async(this, null, function* () {
        try {
          const url = `${this.baseUrl}/api/files`;
          const response = yield (0, import_obsidian2.requestUrl)({
            url,
            method: "GET",
            headers: this.getHeaders()
          });
          if (response.status !== 200) {
            throw new Error(`HTTP ${response.status}`);
          }
          const text = (0, import_obsidian2.arrayBufferToString)(response.arrayBuffer);
          const data = JSON.parse(text);
          return data.files || [];
        } catch (err) {
          throw new Error(`Failed to list files: ${err.message}`);
        }
      });
    }
    downloadFile(filePath) {
      return __async(this, null, function* () {
        try {
          const encodedPath = encodeURIComponent(filePath).split("%2F").join("/");
          const url = `${this.baseUrl}/api/files/${encodedPath}`;
          const response = yield (0, import_obsidian2.requestUrl)({
            url,
            method: "GET",
            headers: this.getHeaders()
          });
          if (response.status === 404) {
            throw new Error("File not found on server");
          }
          if (response.status !== 200) {
            throw new Error(`HTTP ${response.status}`);
          }
          return response.arrayBuffer;
        } catch (err) {
          throw new Error(`Failed to download ${filePath}: ${err.message}`);
        }
      });
    }
    uploadFile(filePath, content) {
      return __async(this, null, function* () {
        try {
          const encodedPath = encodeURIComponent(filePath).split("%2F").join("/");
          const url = `${this.baseUrl}/api/files/${encodedPath}`;
          const response = yield (0, import_obsidian2.requestUrl)({
            url,
            method: "POST",
            headers: this.getHeaders(),
            body: content
          });
          if (response.status !== 200) {
            const text2 = (0, import_obsidian2.arrayBufferToString)(response.arrayBuffer);
            const data2 = JSON.parse(text2);
            throw new Error(data2.error || `HTTP ${response.status}`);
          }
          const text = (0, import_obsidian2.arrayBufferToString)(response.arrayBuffer);
          const data = JSON.parse(text);
          return data.hash;
        } catch (err) {
          throw new Error(`Failed to upload ${filePath}: ${err.message}`);
        }
      });
    }
    deleteFile(filePath) {
      return __async(this, null, function* () {
        try {
          const encodedPath = encodeURIComponent(filePath).split("%2F").join("/");
          const url = `${this.baseUrl}/api/files/${encodedPath}`;
          const response = yield (0, import_obsidian2.requestUrl)({
            url,
            method: "DELETE",
            headers: this.getHeaders()
          });
          if (response.status === 404) {
            throw new Error("File not found on server");
          }
          if (response.status !== 200) {
            const text = (0, import_obsidian2.arrayBufferToString)(response.arrayBuffer);
            const data = JSON.parse(text);
            throw new Error(data.error || `HTTP ${response.status}`);
          }
        } catch (err) {
          throw new Error(`Failed to delete ${filePath}: ${err.message}`);
        }
      });
    }
    batchUpload(files) {
      return __async(this, null, function* () {
        const hashes = new Map();
        for (const [filePath, content] of files) {
          const hash = yield this.uploadFile(filePath, content);
          hashes.set(filePath, hash);
        }
        return hashes;
      });
    }
    batchDelete(filePaths) {
      return __async(this, null, function* () {
        for (const filePath of filePaths) {
          yield this.deleteFile(filePath);
        }
      });
    }
  };

  // src/vault-utils.ts
  var import_obsidian4 = __toModule(__require("obsidian"));

  // src/utils.ts
  var import_obsidian3 = __toModule(__require("obsidian"));
  function calculateHash(content) {
    return __async(this, null, function* () {
      let buffer;
      if (typeof content === "string") {
        buffer = new TextEncoder().encode(content);
      } else {
        buffer = content;
      }
      const hashBuffer = yield crypto.subtle.digest("SHA-256", buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    });
  }
  function matchesPattern(filePath, pattern) {
    if (pattern === "*")
      return true;
    if (pattern.startsWith("/")) {
      const dir = pattern.substring(1);
      return filePath.startsWith(dir + "/");
    }
    if (pattern.includes("*")) {
      if (pattern === "**") {
        return true;
      }
      if (pattern.includes("**/")) {
        const remaining = pattern.substring(3);
        const lastSlash = filePath.lastIndexOf("/");
        if (lastSlash >= 0) {
          return globMatch(filePath.substring(lastSlash + 1), remaining);
        }
        return globMatch(filePath, remaining);
      }
      return globMatch(filePath, pattern);
    }
    return filePath === pattern || filePath.startsWith(pattern + "/");
  }
  function globMatch(text, pattern) {
    const regex = patternToRegex(pattern);
    return regex.test(text);
  }
  function patternToRegex(pattern) {
    let regex = "";
    for (let i = 0; i < pattern.length; i++) {
      const char = pattern[i];
      if (char === "*") {
        if (pattern[i + 1] === "*") {
          regex += ".*";
          i++;
        } else {
          regex += "[^/]*";
        }
      } else if (char === "?") {
        regex += ".";
      } else if (char === ".") {
        regex += "\\.";
      } else {
        regex += char;
      }
    }
    return new RegExp(`^${regex}$`);
  }
  function formatTime(ms) {
    if (ms < 1e3)
      return `${ms}ms`;
    if (ms < 6e4)
      return `${(ms / 1e3).toFixed(1)}s`;
    return `${(ms / 6e4).toFixed(1)}m`;
  }

  // src/vault-utils.ts
  var VaultUtils = class {
    constructor(vault, ignorePatterns) {
      this.vault = vault;
      this.ignorePatterns = ignorePatterns;
    }
    listVaultFiles() {
      return __async(this, null, function* () {
        const files = [];
        const vaultRoot = this.vault.getRoot();
        if (!vaultRoot)
          return files;
        yield this.walkDirectory(vaultRoot, "", files);
        return files;
      });
    }
    walkDirectory(folder, prefix, files) {
      return __async(this, null, function* () {
        for (const child of folder.children) {
          const relativePath = prefix ? `${prefix}/${child.name}` : child.name;
          if (this.ignorePatterns.shouldIgnore(relativePath)) {
            continue;
          }
          if (child instanceof import_obsidian4.TFile) {
            try {
              const content = yield this.vault.cachedRead(child);
              const hash = yield calculateHash(content);
              files.push({
                path: relativePath,
                hash,
                size: content.length
              });
            } catch (err) {
              console.error(`Error reading file ${relativePath}:`, err);
            }
          } else if (child instanceof import_obsidian4.TFolder) {
            yield this.walkDirectory(child, relativePath, files);
          }
        }
      });
    }
    readFile(filePath) {
      return __async(this, null, function* () {
        const file = this.vault.getAbstractFileByPath(filePath);
        if (!(file instanceof import_obsidian4.TFile)) {
          throw new Error(`File not found: ${filePath}`);
        }
        return yield this.vault.cachedRead(file);
      });
    }
    readFileAsBuffer(filePath) {
      return __async(this, null, function* () {
        const file = this.vault.getAbstractFileByPath(filePath);
        if (!(file instanceof import_obsidian4.TFile)) {
          throw new Error(`File not found: ${filePath}`);
        }
        const content = yield this.vault.cachedRead(file);
        const buffer = new ArrayBuffer(content.length);
        const view = new Uint8Array(buffer);
        for (let i = 0; i < content.length; i++) {
          view[i] = content.charCodeAt(i);
        }
        return buffer;
      });
    }
    writeFile(filePath, content) {
      return __async(this, null, function* () {
        const file = this.vault.getAbstractFileByPath(filePath);
        if (file instanceof import_obsidian4.TFile) {
          yield this.vault.modify(file, content);
        } else {
          yield this.vault.create(filePath, content);
        }
      });
    }
    writeFileFromBuffer(filePath, buffer) {
      return __async(this, null, function* () {
        const view = new Uint8Array(buffer);
        const content = String.fromCharCode.apply(null, Array.from(view));
        yield this.writeFile(filePath, content);
      });
    }
    deleteFile(filePath) {
      return __async(this, null, function* () {
        const file = this.vault.getAbstractFileByPath(filePath);
        if (!file) {
          throw new Error(`File not found: ${filePath}`);
        }
        yield this.vault.delete(file);
      });
    }
    fileExists(filePath) {
      const file = this.vault.getAbstractFileByPath(filePath);
      return file instanceof import_obsidian4.TFile;
    }
    ensureDirectory(filePath) {
      return __async(this, null, function* () {
        const lastSlash = filePath.lastIndexOf("/");
        if (lastSlash > 0) {
          const dirPath = filePath.substring(0, lastSlash);
          const folder = this.vault.getAbstractFileByPath(dirPath);
          if (!folder) {
            yield this.vault.createFolder(dirPath);
          }
        }
      });
    }
    getFileModTime(filePath) {
      const file = this.vault.getAbstractFileByPath(filePath);
      if (file instanceof import_obsidian4.TFile) {
        return file.stat.mtime;
      }
      return 0;
    }
    setIgnorePatterns(ignorePatterns) {
      this.ignorePatterns = ignorePatterns;
    }
  };

  // src/sync-engine.ts
  var SyncEngine = class {
    constructor(vaultUtils, serverApi) {
      this.vaultUtils = vaultUtils;
      this.serverApi = serverApi;
    }
    detectChanges() {
      return __async(this, null, function* () {
        const localFiles = yield this.vaultUtils.listVaultFiles();
        const remoteFiles = yield this.serverApi.listFiles();
        const localMap = new Map(localFiles.map((f) => [f.path, f]));
        const remoteMap = new Map(remoteFiles.map((f) => [f.path, f]));
        const localOnly = [];
        const remoteOnly = [];
        const conflicts = [];
        for (const [path, localFile] of localMap) {
          const remoteFile = remoteMap.get(path);
          if (!remoteFile) {
            localOnly.push(localFile);
          } else if (localFile.hash !== remoteFile.hash) {
            conflicts.push({
              path,
              localHash: localFile.hash,
              remoteHash: remoteFile.hash
            });
          }
        }
        for (const [path, remoteFile] of remoteMap) {
          if (!localMap.has(path)) {
            remoteOnly.push(remoteFile);
          }
        }
        return { localOnly, remoteOnly, conflicts };
      });
    }
    performPush() {
      return __async(this, null, function* () {
        const diff = yield this.detectChanges();
        if (diff.conflicts.length > 0) {
          throw new Error(`Conflicts detected:
${diff.conflicts.map((c) => c.path).join("\n")}

Please resolve manually and retry.`);
        }
        let uploaded = 0;
        let deleted = 0;
        for (const file of diff.localOnly) {
          try {
            const content = yield this.vaultUtils.readFileAsBuffer(file.path);
            yield this.serverApi.uploadFile(file.path, content);
            uploaded++;
          } catch (err) {
            console.error(`Failed to upload ${file.path}:`, err);
            throw err;
          }
        }
        for (const file of diff.remoteOnly) {
          try {
            yield this.serverApi.deleteFile(file.path);
            deleted++;
          } catch (err) {
            console.error(`Failed to delete ${file.path}:`, err);
            throw err;
          }
        }
        return { uploaded, deleted, conflicts: [] };
      });
    }
    performPull() {
      return __async(this, null, function* () {
        const diff = yield this.detectChanges();
        if (diff.conflicts.length > 0) {
          throw new Error(`Conflicts detected:
${diff.conflicts.map((c) => c.path).join("\n")}

Please resolve manually and retry.`);
        }
        let downloaded = 0;
        let deleted = 0;
        for (const file of diff.remoteOnly) {
          yield this.vaultUtils.ensureDirectory(file.path);
        }
        for (const file of diff.remoteOnly) {
          try {
            const content = yield this.serverApi.downloadFile(file.path);
            yield this.vaultUtils.writeFileFromBuffer(file.path, content);
            downloaded++;
          } catch (err) {
            console.error(`Failed to download ${file.path}:`, err);
            throw err;
          }
        }
        for (const file of diff.localOnly) {
          try {
            yield this.vaultUtils.deleteFile(file.path);
            deleted++;
          } catch (err) {
            console.error(`Failed to delete ${file.path}:`, err);
            throw err;
          }
        }
        return { downloaded, deleted, conflicts: [] };
      });
    }
    getDiff() {
      return __async(this, null, function* () {
        return this.detectChanges();
      });
    }
  };

  // src/ignore-patterns.ts
  var import_obsidian5 = __toModule(__require("obsidian"));
  var IgnorePatterns = class {
    constructor(patterns = []) {
      this.patterns = [];
      this.negatePatterns = [];
      this.parsePatterns(patterns);
    }
    parsePatterns(patterns) {
      this.patterns = [];
      this.negatePatterns = [];
      for (let pattern of patterns) {
        if (!pattern || pattern.startsWith("#"))
          continue;
        pattern = pattern.trim();
        if (pattern.startsWith("!")) {
          this.negatePatterns.push(pattern.substring(1));
        } else {
          this.patterns.push(pattern);
        }
      }
    }
    shouldIgnore(filePath) {
      for (const pattern of this.negatePatterns) {
        if (matchesPattern(filePath, pattern)) {
          return false;
        }
      }
      for (const pattern of this.patterns) {
        if (matchesPattern(filePath, pattern)) {
          return true;
        }
      }
      return false;
    }
    static fromFile(vault, nosyncPath) {
      return __async(this, null, function* () {
        try {
          const file = vault.getAbstractFileByPath(nosyncPath);
          if (file && file instanceof import_obsidian5.TFile) {
            const content = yield vault.cachedRead(file);
            const lines = content.split("\n");
            return new IgnorePatterns(lines);
          }
        } catch (err) {
          console.error("Error reading .nosync file:", err);
        }
        return new IgnorePatterns(IgnorePatterns.getDefaultPatterns());
      });
    }
    static getDefaultPatterns() {
      return [
        ".obsidian/workspace*.json",
        ".obsidian/cache/",
        ".obsidian/appearance.json",
        ".obsidian/app.json",
        ".trash/",
        ".git/",
        ".gitignore",
        "*.tmp",
        "*.temp",
        "*.swp",
        ".DS_Store",
        "Thumbs.db"
      ];
    }
    addPattern(pattern) {
      if (pattern.startsWith("!")) {
        this.negatePatterns.push(pattern.substring(1));
      } else {
        this.patterns.push(pattern);
      }
    }
    getPatterns() {
      return [
        ...this.patterns,
        ...this.negatePatterns.map((p) => "!" + p)
      ];
    }
    static createDefault() {
      return new IgnorePatterns(IgnorePatterns.getDefaultPatterns());
    }
  };

  // src/main.ts
  var VaultSyncV2Plugin = class extends import_obsidian6.Plugin {
    constructor() {
      super(...arguments);
      this.syncStatus = SyncStatus.Idle;
    }
    onload() {
      return __async(this, null, function* () {
        yield this.loadSettings();
        this.serverApi = new ServerAPI(this.settings.serverUrl, this.settings.apiKey);
        this.ignorePatterns = yield IgnorePatterns.fromFile(this.app.vault, this.settings.nosyncPath);
        this.vaultUtils = new VaultUtils(this.app.vault, this.ignorePatterns);
        this.syncEngine = new SyncEngine(this.vaultUtils, this.serverApi);
        this.statusBarItem = this.addStatusBarItem();
        this.updateStatusBar();
        this.addRibbonIcon("arrow-up", "Push to server", () => __async(this, null, function* () {
          yield this.performPush();
        }));
        this.addRibbonIcon("arrow-down", "Pull from server", () => __async(this, null, function* () {
          yield this.performPull();
        }));
        this.addCommand({
          id: "push-vault",
          name: "Push to server",
          callback: () => __async(this, null, function* () {
            yield this.performPush();
          })
        });
        this.addCommand({
          id: "pull-vault",
          name: "Pull from server",
          callback: () => __async(this, null, function* () {
            yield this.performPull();
          })
        });
        this.addCommand({
          id: "test-connection",
          name: "Test server connection",
          callback: () => __async(this, null, function* () {
            yield this.testConnection();
          })
        });
        this.addCommand({
          id: "show-diff",
          name: "Show sync diff",
          callback: () => __async(this, null, function* () {
            yield this.showDiff();
          })
        });
        this.addSettingTab(new VaultSyncV2SettingTab(this.app, this));
        this.log("Vault Sync v2 plugin loaded");
      });
    }
    onunload() {
      this.log("Vault Sync v2 plugin unloaded");
    }
    performPush() {
      return __async(this, null, function* () {
        if (this.syncStatus !== SyncStatus.Idle) {
          new import_obsidian6.Notice("\u27F3 Sync already in progress");
          return;
        }
        try {
          this.syncStatus = SyncStatus.Pushing;
          this.updateStatusBar();
          if (!this.settings.serverUrl || !this.settings.apiKey) {
            throw new Error("Server URL and API key must be configured in settings");
          }
          const startTime = Date.now();
          const result = yield this.syncEngine.performPush();
          const elapsed = formatTime(Date.now() - startTime);
          const msg = `\u2713 Pushed ${result.uploaded} file(s) in ${elapsed}`;
          if (result.deleted > 0) {
            new import_obsidian6.Notice(`${msg}, deleted ${result.deleted} remote file(s)`);
          } else {
            new import_obsidian6.Notice(msg);
          }
          this.log(`Push complete: uploaded=${result.uploaded}, deleted=${result.deleted}, time=${elapsed}`);
          this.syncStatus = SyncStatus.Idle;
          this.updateStatusBar();
        } catch (err) {
          this.log(`Push error: ${err.message}`);
          if (err.message.includes("Conflicts detected")) {
            new import_obsidian6.Notice(`\u26A0 ${err.message}`);
          } else {
            new import_obsidian6.Notice(`\u2717 Push failed: ${err.message}`);
          }
          this.syncStatus = SyncStatus.Error;
          this.updateStatusBar();
          setTimeout(() => {
            this.syncStatus = SyncStatus.Idle;
            this.updateStatusBar();
          }, 3e3);
        }
      });
    }
    performPull() {
      return __async(this, null, function* () {
        if (this.syncStatus !== SyncStatus.Idle) {
          new import_obsidian6.Notice("\u27F3 Sync already in progress");
          return;
        }
        try {
          this.syncStatus = SyncStatus.Pulling;
          this.updateStatusBar();
          if (!this.settings.serverUrl || !this.settings.apiKey) {
            throw new Error("Server URL and API key must be configured in settings");
          }
          const startTime = Date.now();
          const result = yield this.syncEngine.performPull();
          const elapsed = formatTime(Date.now() - startTime);
          const msg = `\u2713 Pulled ${result.downloaded} file(s) in ${elapsed}`;
          if (result.deleted > 0) {
            new import_obsidian6.Notice(`${msg}, deleted ${result.deleted} local file(s)`);
          } else {
            new import_obsidian6.Notice(msg);
          }
          this.log(`Pull complete: downloaded=${result.downloaded}, deleted=${result.deleted}, time=${elapsed}`);
          this.syncStatus = SyncStatus.Idle;
          this.updateStatusBar();
        } catch (err) {
          this.log(`Pull error: ${err.message}`);
          if (err.message.includes("Conflicts detected")) {
            new import_obsidian6.Notice(`\u26A0 ${err.message}`);
          } else {
            new import_obsidian6.Notice(`\u2717 Pull failed: ${err.message}`);
          }
          this.syncStatus = SyncStatus.Error;
          this.updateStatusBar();
          setTimeout(() => {
            this.syncStatus = SyncStatus.Idle;
            this.updateStatusBar();
          }, 3e3);
        }
      });
    }
    testConnection() {
      return __async(this, null, function* () {
        try {
          if (!this.settings.serverUrl) {
            new import_obsidian6.Notice("\u2717 Server URL not configured");
            return;
          }
          const isConnected = yield this.serverApi.testConnection();
          if (isConnected) {
            new import_obsidian6.Notice("\u2713 Connection successful!");
            this.log("Server connection test passed");
          } else {
            new import_obsidian6.Notice("\u2717 Cannot reach server");
            this.log("Server connection test failed");
          }
        } catch (err) {
          new import_obsidian6.Notice(`\u2717 Connection error: ${err.message}`);
          this.log(`Connection test error: ${err.message}`);
        }
      });
    }
    showDiff() {
      return __async(this, null, function* () {
        try {
          const diff = yield this.syncEngine.getDiff();
          const msg = `Local only: ${diff.localOnly.length}
Remote only: ${diff.remoteOnly.length}
Conflicts: ${diff.conflicts.length}`;
          new import_obsidian6.Notice(msg);
          this.log(`Diff: ${msg.replace(/\n/g, ", ")}`);
          if (diff.conflicts.length > 0) {
            console.log("Conflicts:", diff.conflicts.map((c) => c.path).join(", "));
          }
        } catch (err) {
          new import_obsidian6.Notice(`\u2717 Error: ${err.message}`);
          this.log(`Diff error: ${err.message}`);
        }
      });
    }
    updateStatusBar() {
      const statusText = {
        [SyncStatus.Idle]: "\u2713 Ready",
        [SyncStatus.Pushing]: "\u27F3 Pushing...",
        [SyncStatus.Pulling]: "\u27F3 Pulling...",
        [SyncStatus.Error]: "\u2717 Error"
      };
      this.statusBarItem.setText(`Vault Sync: ${statusText[this.syncStatus]}`);
    }
    loadSettings() {
      return __async(this, null, function* () {
        const data = yield this.loadData();
        this.settings = Object.assign({}, DEFAULT_V2_SETTINGS, data);
      });
    }
    saveSettings() {
      return __async(this, null, function* () {
        yield this.saveData(this.settings);
        this.serverApi.setApiKey(this.settings.apiKey);
        this.ignorePatterns = yield IgnorePatterns.fromFile(this.app.vault, this.settings.nosyncPath);
        this.vaultUtils.setIgnorePatterns(this.ignorePatterns);
      });
    }
    log(message) {
      if (this.settings.enableLogging) {
        console.log(`[Vault Sync v2] ${message}`);
      }
    }
  };
})();
