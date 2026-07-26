import { App, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile } from 'obsidian';
import { SyncService, SyncStatus, ScionSyncSettings } from './sync-service';

interface ScionSyncData {
  settings: ScionSyncSettings;
  syncState: Record<string, { hash: string; commit: string; file_id?: string }>;
  lastSyncedCommit: string | null;
  lastBackend: 'server' | 'r2' | null;
}

const DEFAULT_SETTINGS: ScionSyncSettings = {
  backend: 'server', // existing installs must keep working against the Pi unchanged
  serverUrl: 'http://localhost:3000',
  r2AccountId: '',
  r2Bucket: '',
  r2AccessKeyId: '',
  r2SecretAccessKey: '',
  deviceName: '',
  pollInterval: 300, // 5 minutes
  autoSync: true,
  syncOnStartup: true,
  debounceInterval: 3,
};

export default class ScionSyncPlugin extends Plugin {
  settings: ScionSyncSettings = DEFAULT_SETTINGS;
  private syncService: SyncService | null = null;
  private syncState: Record<string, { hash: string; commit: string; file_id?: string }> = {};
  private lastSyncedCommit: string | null = null;
  private lastBackend: 'server' | 'r2' | null = null;
  private statusBarItem: HTMLElement | null = null;

  async onload() {
    await this.loadSettings();

    const vaultName = this.app.vault.getName();

    // Status bar
    this.statusBarItem = this.addStatusBarItem();
    this.statusBarItem.addClass('scion-sync-status');
    this.statusBarItem.setText('Scion: Ready');
    this.statusBarItem.addEventListener('click', () => {
      new SyncStatusModal(this.app, this).open();
    });

    // Initialize sync service
    this.syncService = new SyncService(
      this.app,
      this.settings,
      vaultName,
      this.syncState,
      this.lastSyncedCommit,
      async (data) => {
        const d = data as {
          syncState: typeof this.syncState;
          lastSyncedCommit: string | null;
          lastBackend?: 'server' | 'r2' | null;
        };
        this.syncState = d.syncState;
        this.lastSyncedCommit = d.lastSyncedCommit;
        if (d.lastBackend !== undefined) this.lastBackend = d.lastBackend;
        await this.saveData({
          settings: this.settings,
          syncState: this.syncState,
          lastSyncedCommit: this.lastSyncedCommit,
          lastBackend: this.lastBackend,
        });
      },
      this.lastBackend
    );

    this.syncService.setStatusCallback((status, message) => {
      this.updateStatusBar(status, message);
    });

    this.syncService.initialize();

    // Settings tab
    this.addSettingTab(new ScionSyncSettingTab(this.app, this));

    // Ribbon icon
    this.addRibbonIcon('refresh-cw', 'Scion Sync', async () => {
      await this.syncService?.syncAll();
    });

    // Commands
    this.addCommand({
      id: 'sync-now',
      name: 'Sync Now',
      callback: async () => {
        await this.syncService?.syncAll();
      },
    });

    this.addCommand({
      id: 'toggle-auto-sync',
      name: 'Toggle Auto-Sync',
      callback: async () => {
        this.settings.autoSync = !this.settings.autoSync;
        await this.saveSettings();
        this.syncService?.updateSettings(this.settings);
      },
    });

    this.addCommand({
      id: 'show-sync-status',
      name: 'Show Sync Status',
      callback: () => {
        new SyncStatusModal(this.app, this).open();
      },
    });

    this.addCommand({
      id: 'show-conflict-files',
      name: 'Show Conflict Files',
      callback: () => {
        const conflictFiles = this.app.vault.getFiles().filter(
          (f: TFile) => f.path.includes('.conflict.')
        );
        if (conflictFiles.length === 0) {
          new Notice('No conflict files found.');
          return;
        }
        new ConflictListModal(this.app, conflictFiles).open();
      },
    });
  }

  onunload() {
    this.syncService?.destroy();
  }

  async loadSettings() {
    const data = (await this.loadData()) as ScionSyncData | null;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data?.settings);
    this.syncState = data?.syncState || {};
    this.lastSyncedCommit = data?.lastSyncedCommit || null;
    this.lastBackend = data?.lastBackend ?? null;
  }

  async saveSettings() {
    await this.saveData({
      settings: this.settings,
      syncState: this.syncState,
      lastSyncedCommit: this.lastSyncedCommit,
      lastBackend: this.lastBackend,
    });
  }

  /** Wipes local sync bookkeeping so this device can bootstrap fresh against
   * whichever backend is currently selected. Used when switching backends —
   * see the split-brain guard in SyncService.syncAll(). Does not touch any
   * remote data on either backend. */
  async resetLocalSyncState() {
    await this.syncService?.resetSyncState();
    new Notice('Local sync state cleared. Next sync will do a full pull from the current backend.');
  }

  getSyncService(): SyncService | null {
    return this.syncService;
  }

  private updateStatusBar(status: SyncStatus, message?: string): void {
    if (!this.statusBarItem) return;

    this.statusBarItem.removeClass('syncing', 'success', 'error');

    switch (status) {
      case 'idle':
        this.statusBarItem.setText('Scion: Synced');
        break;
      case 'syncing':
        this.statusBarItem.addClass('syncing');
        this.statusBarItem.setText('Scion: Syncing...');
        break;
      case 'success':
        this.statusBarItem.addClass('success');
        this.statusBarItem.setText('Scion: Synced');
        setTimeout(() => this.statusBarItem?.removeClass('success'), 3000);
        break;
      case 'error':
        this.statusBarItem.addClass('error');
        this.statusBarItem.setText('Scion: Error');
        this.statusBarItem.setAttr('title', message || 'Unknown error');
        break;
    }
  }
}

// Settings Tab
class ScionSyncSettingTab extends PluginSettingTab {
  plugin: ScionSyncPlugin;

  constructor(app: App, plugin: ScionSyncPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl('h2', { text: 'Scion Sync Settings' });

    new Setting(containerEl)
      .setName('Backend')
      .setDesc(
        'Server = the Pi-hosted scion server (unchanged). R2 = sync straight to a Cloudflare R2 ' +
          'bucket, no server needed. Move ALL of a vault\'s devices to the same backend together — ' +
          'the two do not talk to each other.'
      )
      .addDropdown((dropdown) =>
        dropdown
          .addOption('server', 'Scion server (Pi)')
          .addOption('r2', 'Cloudflare R2 (serverless)')
          .setValue(this.plugin.settings.backend)
          .onChange(async (value) => {
            this.plugin.settings.backend = value as 'server' | 'r2';
            await this.plugin.saveSettings();
            this.plugin.getSyncService()?.updateSettings(this.plugin.settings);
            this.display();
          })
      );

    if (this.plugin.settings.backend === 'server') {
      new Setting(containerEl)
        .setName('Server URL')
        .setDesc('The URL of your Scion sync server')
        .addText((text) =>
          text
            .setPlaceholder('http://localhost:3000')
            .setValue(this.plugin.settings.serverUrl)
            .onChange(async (value) => {
              this.plugin.settings.serverUrl = value;
              await this.plugin.saveSettings();
              this.plugin.getSyncService()?.updateSettings(this.plugin.settings);
            })
        );
    } else {
      containerEl.createEl('h3', { text: 'R2 bucket' });

      new Setting(containerEl).setName('Account ID').addText((text) =>
        text
          .setPlaceholder('Cloudflare account ID')
          .setValue(this.plugin.settings.r2AccountId)
          .onChange(async (value) => {
            this.plugin.settings.r2AccountId = value;
            await this.plugin.saveSettings();
            this.plugin.getSyncService()?.updateSettings(this.plugin.settings);
          })
      );

      new Setting(containerEl).setName('Bucket').addText((text) =>
        text
          .setPlaceholder('scion-vault')
          .setValue(this.plugin.settings.r2Bucket)
          .onChange(async (value) => {
            this.plugin.settings.r2Bucket = value;
            await this.plugin.saveSettings();
            this.plugin.getSyncService()?.updateSettings(this.plugin.settings);
          })
      );

      new Setting(containerEl)
        .setName('Access key ID')
        .setDesc('From an R2 API token scoped to this one bucket, Object Read & Write')
        .addText((text) =>
          text
            .setValue(this.plugin.settings.r2AccessKeyId)
            .onChange(async (value) => {
              this.plugin.settings.r2AccessKeyId = value;
              await this.plugin.saveSettings();
              this.plugin.getSyncService()?.updateSettings(this.plugin.settings);
            })
        );

      new Setting(containerEl)
        .setName('Secret access key')
        .setDesc('Stored in plain text in this vault\'s plugin data, same as the server URL is today')
        .addText((text) => {
          text.inputEl.type = 'password';
          text
            .setValue(this.plugin.settings.r2SecretAccessKey)
            .onChange(async (value) => {
              this.plugin.settings.r2SecretAccessKey = value;
              await this.plugin.saveSettings();
              this.plugin.getSyncService()?.updateSettings(this.plugin.settings);
            });
        });
    }

    new Setting(containerEl)
      .setName('Device name')
      .setDesc('Identifies this device in server logs (e.g. "iPhone", "MacBook")')
      .addText((text) =>
        text
          .setPlaceholder('e.g. iPhone, MacBook')
          .setValue(this.plugin.settings.deviceName)
          .onChange(async (value) => {
            this.plugin.settings.deviceName = value;
            await this.plugin.saveSettings();
            this.plugin.getSyncService()?.updateSettings(this.plugin.settings);
          })
      );

    new Setting(containerEl)
      .setName('Poll interval (seconds)')
      .setDesc(`Check for changes every ${this.plugin.settings.pollInterval} seconds`)
      .addSlider((slider) =>
        slider
          .setLimits(30, 600, 30)
          .setValue(this.plugin.settings.pollInterval)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.pollInterval = value;
            await this.plugin.saveSettings();
            this.plugin.getSyncService()?.updateSettings(this.plugin.settings);
            this.display();
          })
      );

    new Setting(containerEl)
      .setName('Edit debounce (seconds)')
      .setDesc(`Wait ${this.plugin.settings.debounceInterval}s after editing before syncing`)
      .addSlider((slider) =>
        slider
          .setLimits(1, 10, 1)
          .setValue(this.plugin.settings.debounceInterval)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.debounceInterval = value;
            await this.plugin.saveSettings();
            this.plugin.getSyncService()?.updateSettings(this.plugin.settings);
            this.display();
          })
      );

    new Setting(containerEl)
      .setName('Auto-sync')
      .setDesc('Automatically sync changes in background')
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.autoSync).onChange(async (value) => {
          this.plugin.settings.autoSync = value;
          await this.plugin.saveSettings();
          this.plugin.getSyncService()?.updateSettings(this.plugin.settings);
        })
      );

    new Setting(containerEl)
      .setName('Sync on startup')
      .setDesc('Perform full sync when Obsidian opens')
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.syncOnStartup).onChange(async (value) => {
          this.plugin.settings.syncOnStartup = value;
          await this.plugin.saveSettings();
        })
      );

    // Actions
    containerEl.createEl('h3', { text: 'Actions' });

    new Setting(containerEl)
      .setName('Sync now')
      .setDesc('Manually trigger a full sync')
      .addButton((btn) =>
        btn
          .setButtonText('Sync Now')
          .setCta()
          .onClick(async () => {
            await this.plugin.getSyncService()?.syncAll();
          })
      );

    new Setting(containerEl)
      .setName('Reset local sync state')
      .setDesc(
        'Clears this device\'s sync bookkeeping and does a fresh full pull on next sync. ' +
          'Use this after switching this device to a different backend (see the error the status bar ' +
          'shows if you forget). Does not delete anything remote.'
      )
      .addButton((btn) =>
        btn.setButtonText('Reset').onClick(async () => {
          await this.plugin.resetLocalSyncState();
          this.display();
        })
      );

    // Status
    const stats = this.plugin.getSyncService()?.getStats();
    if (stats) {
      containerEl.createEl('h3', { text: 'Status' });
      const statusEl = containerEl.createDiv({ cls: 'scion-sync-status-info' });
      statusEl.createEl('p', { text: `Tracked files: ${stats.trackedFiles}` });
      statusEl.createEl('p', { text: `Last commit: ${stats.lastCommit?.substring(0, 8) || 'None'}` });
    }
  }
}

// Sync Status Modal
class SyncStatusModal extends Modal {
  plugin: ScionSyncPlugin;

  constructor(app: App, plugin: ScionSyncPlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: 'Scion Sync Status' });

    const stats = this.plugin.getSyncService()?.getStats();
    const infoEl = contentEl.createDiv({ cls: 'scion-status-info' });
    infoEl.createEl('p', { text: `Backend: ${this.plugin.settings.backend === 'r2' ? 'Cloudflare R2' : 'Scion server (Pi)'}` });
    if (this.plugin.settings.backend === 'server') {
      infoEl.createEl('p', { text: `Server: ${this.plugin.settings.serverUrl}` });
    }
    infoEl.createEl('p', { text: `Vault: ${this.app.vault.getName()}` });
    infoEl.createEl('p', { text: `Auto-sync: ${this.plugin.settings.autoSync ? 'Enabled' : 'Disabled'}` });
    infoEl.createEl('p', { text: `Poll interval: ${this.plugin.settings.pollInterval}s` });

    if (stats) {
      contentEl.createEl('hr');
      const statsEl = contentEl.createDiv({ cls: 'scion-status-stats' });
      statsEl.createEl('p', { text: `Files tracked: ${stats.trackedFiles}` });
      statsEl.createEl('p', { text: `Last server commit: ${stats.lastCommit?.substring(0, 8) || 'None'}` });
    }

    contentEl.createEl('hr');

    new Setting(contentEl)
      .addButton((btn) =>
        btn
          .setButtonText('Sync Now')
          .setCta()
          .onClick(async () => {
            this.close();
            await this.plugin.getSyncService()?.syncAll();
          })
      )
      .addButton((btn) =>
        btn.setButtonText('Close').onClick(() => this.close())
      );
  }

  onClose() {
    this.contentEl.empty();
  }
}

// Conflict List Modal
class ConflictListModal extends Modal {
  files: TFile[];

  constructor(app: App, files: TFile[]) {
    super(app);
    this.files = files;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl('h2', { text: 'Conflict Files' });
    contentEl.createEl('p', { text: `Found ${this.files.length} conflict file(s):` });

    const list = contentEl.createEl('ul');
    for (const file of this.files) {
      const li = list.createEl('li');
      const link = li.createEl('a', { text: file.path, href: '#' });
      link.addEventListener('click', (e) => {
        e.preventDefault();
        this.app.workspace.openLinkText(file.path, '');
        this.close();
      });
    }

    new Setting(contentEl).addButton((btn) =>
      btn.setButtonText('Close').onClick(() => this.close())
    );
  }

  onClose() {
    this.contentEl.empty();
  }
}
