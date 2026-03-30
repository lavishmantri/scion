import { App, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile } from 'obsidian';
import { SyncService, SyncStatus, ScionSyncSettings } from './sync-service';

interface ScionSyncData {
  settings: ScionSyncSettings;
  syncState: Record<string, { hash: string; commit: string; file_id?: string }>;
  lastSyncedCommit: string | null;
}

const DEFAULT_SETTINGS: ScionSyncSettings = {
  serverUrl: 'http://localhost:3000',
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
        const d = data as { syncState: typeof this.syncState; lastSyncedCommit: string | null };
        this.syncState = d.syncState;
        this.lastSyncedCommit = d.lastSyncedCommit;
        await this.saveData({
          settings: this.settings,
          syncState: this.syncState,
          lastSyncedCommit: this.lastSyncedCommit,
        });
      }
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
  }

  async saveSettings() {
    await this.saveData({
      settings: this.settings,
      syncState: this.syncState,
      lastSyncedCommit: this.lastSyncedCommit,
    });
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
      .setName('Server URL')
      .setDesc('The URL of your Scion sync server')
      .addText((text) =>
        text
          .setPlaceholder('http://localhost:3000')
          .setValue(this.plugin.settings.serverUrl)
          .onChange(async (value) => {
            this.plugin.settings.serverUrl = value;
            await this.plugin.saveSettings();
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
    infoEl.createEl('p', { text: `Server: ${this.plugin.settings.serverUrl}` });
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
