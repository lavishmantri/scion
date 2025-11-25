/**
 * Vault Sync v2 - Obsidian Plugin
 * Manual push/pull sync with custom HTTP server
 */

import { Notice, Plugin } from 'obsidian';
import { VaultSyncV2Settings, DEFAULT_V2_SETTINGS, SyncStatus } from './types';
import { VaultSyncV2SettingTab } from './settings';
import { ServerAPI } from './server-api';
import { VaultUtils } from './vault-utils';
import { SyncEngine } from './sync-engine';
import { IgnorePatterns } from './ignore-patterns';
import { formatBytes, formatTime } from './utils';

export default class VaultSyncV2Plugin extends Plugin {
  settings: VaultSyncV2Settings;
  statusBarItem: HTMLElement;
  syncStatus: SyncStatus = SyncStatus.Idle;

  // Instances
  serverApi: ServerAPI;
  vaultUtils: VaultUtils;
  syncEngine: SyncEngine;
  ignorePatterns: IgnorePatterns;

  async onload() {
    // Load settings
    await this.loadSettings();

    // Initialize instances
    this.serverApi = new ServerAPI(this.settings.serverUrl, this.settings.apiKey);
    this.ignorePatterns = await IgnorePatterns.fromFile(this.app.vault, this.settings.nosyncPath);
    this.vaultUtils = new VaultUtils(this.app.vault, this.ignorePatterns);
    this.syncEngine = new SyncEngine(this.vaultUtils, this.serverApi);

    // Add status bar item
    this.statusBarItem = this.addStatusBarItem();
    this.updateStatusBar();

    // Add ribbon icons
    this.addRibbonIcon('arrow-up', 'Push to server', async () => {
      await this.performPush();
    });

    this.addRibbonIcon('arrow-down', 'Pull from server', async () => {
      await this.performPull();
    });

    // Add commands
    this.addCommand({
      id: 'push-vault',
      name: 'Push to server',
      callback: async () => {
        await this.performPush();
      }
    });

    this.addCommand({
      id: 'pull-vault',
      name: 'Pull from server',
      callback: async () => {
        await this.performPull();
      }
    });

    this.addCommand({
      id: 'test-connection',
      name: 'Test server connection',
      callback: async () => {
        await this.testConnection();
      }
    });

    this.addCommand({
      id: 'show-diff',
      name: 'Show sync diff',
      callback: async () => {
        await this.showDiff();
      }
    });

    // Add settings tab
    this.addSettingTab(new VaultSyncV2SettingTab(this.app, this));

    this.log('Vault Sync v2 plugin loaded');
  }

  onunload() {
    this.log('Vault Sync v2 plugin unloaded');
  }

  /**
   * Perform push operation
   */
  async performPush() {
    if (this.syncStatus !== SyncStatus.Idle) {
      new Notice('⟳ Sync already in progress');
      return;
    }

    try {
      this.syncStatus = SyncStatus.Pushing;
      this.updateStatusBar();

      // Validate server connection
      if (!this.settings.serverUrl || !this.settings.apiKey) {
        throw new Error('Server URL and API key must be configured in settings');
      }

      const startTime = Date.now();
      const result = await this.syncEngine.performPush();

      const elapsed = formatTime(Date.now() - startTime);
      const msg = `✓ Pushed ${result.uploaded} file(s) in ${elapsed}`;

      if (result.deleted > 0) {
        new Notice(`${msg}, deleted ${result.deleted} remote file(s)`);
      } else {
        new Notice(msg);
      }

      this.log(`Push complete: uploaded=${result.uploaded}, deleted=${result.deleted}, time=${elapsed}`);
      this.syncStatus = SyncStatus.Idle;
      this.updateStatusBar();
    } catch (err: any) {
      this.log(`Push error: ${err.message}`);

      // Check if it's a conflict error
      if (err.message.includes('Conflicts detected')) {
        new Notice(`⚠ ${err.message}`);
      } else {
        new Notice(`✗ Push failed: ${err.message}`);
      }

      this.syncStatus = SyncStatus.Error;
      this.updateStatusBar();

      // Reset status after 3 seconds
      setTimeout(() => {
        this.syncStatus = SyncStatus.Idle;
        this.updateStatusBar();
      }, 3000);
    }
  }

  /**
   * Perform pull operation
   */
  async performPull() {
    if (this.syncStatus !== SyncStatus.Idle) {
      new Notice('⟳ Sync already in progress');
      return;
    }

    try {
      this.syncStatus = SyncStatus.Pulling;
      this.updateStatusBar();

      // Validate server connection
      if (!this.settings.serverUrl || !this.settings.apiKey) {
        throw new Error('Server URL and API key must be configured in settings');
      }

      const startTime = Date.now();
      const result = await this.syncEngine.performPull();

      const elapsed = formatTime(Date.now() - startTime);
      const msg = `✓ Pulled ${result.downloaded} file(s) in ${elapsed}`;

      if (result.deleted > 0) {
        new Notice(`${msg}, deleted ${result.deleted} local file(s)`);
      } else {
        new Notice(msg);
      }

      this.log(`Pull complete: downloaded=${result.downloaded}, deleted=${result.deleted}, time=${elapsed}`);
      this.syncStatus = SyncStatus.Idle;
      this.updateStatusBar();
    } catch (err: any) {
      this.log(`Pull error: ${err.message}`);

      // Check if it's a conflict error
      if (err.message.includes('Conflicts detected')) {
        new Notice(`⚠ ${err.message}`);
      } else {
        new Notice(`✗ Pull failed: ${err.message}`);
      }

      this.syncStatus = SyncStatus.Error;
      this.updateStatusBar();

      // Reset status after 3 seconds
      setTimeout(() => {
        this.syncStatus = SyncStatus.Idle;
        this.updateStatusBar();
      }, 3000);
    }
  }

  /**
   * Test server connection
   */
  async testConnection() {
    try {
      if (!this.settings.serverUrl) {
        new Notice('✗ Server URL not configured');
        return;
      }

      const isConnected = await this.serverApi.testConnection();

      if (isConnected) {
        new Notice('✓ Connection successful!');
        this.log('Server connection test passed');
      } else {
        new Notice('✗ Cannot reach server');
        this.log('Server connection test failed');
      }
    } catch (err: any) {
      new Notice(`✗ Connection error: ${err.message}`);
      this.log(`Connection test error: ${err.message}`);
    }
  }

  /**
   * Show diff between local and remote
   */
  async showDiff() {
    try {
      const diff = await this.syncEngine.getDiff();

      const msg = `Local only: ${diff.localOnly.length}\nRemote only: ${diff.remoteOnly.length}\nConflicts: ${diff.conflicts.length}`;
      new Notice(msg);

      this.log(`Diff: ${msg.replace(/\n/g, ', ')}`);

      if (diff.conflicts.length > 0) {
        console.log('Conflicts:', diff.conflicts.map(c => c.path).join(', '));
      }
    } catch (err: any) {
      new Notice(`✗ Error: ${err.message}`);
      this.log(`Diff error: ${err.message}`);
    }
  }

  /**
   * Update status bar
   */
  private updateStatusBar() {
    const statusText = {
      [SyncStatus.Idle]: '✓ Ready',
      [SyncStatus.Pushing]: '⟳ Pushing...',
      [SyncStatus.Pulling]: '⟳ Pulling...',
      [SyncStatus.Error]: '✗ Error'
    };

    this.statusBarItem.setText(`Vault Sync: ${statusText[this.syncStatus]}`);
  }

  /**
   * Load settings
   */
  private async loadSettings() {
    const data = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_V2_SETTINGS, data);
  }

  /**
   * Save settings
   */
  async saveSettings() {
    await this.saveData(this.settings);

    // Update instances with new settings
    this.serverApi.setApiKey(this.settings.apiKey);
    this.ignorePatterns = await IgnorePatterns.fromFile(this.app.vault, this.settings.nosyncPath);
    this.vaultUtils.setIgnorePatterns(this.ignorePatterns);
  }

  /**
   * Logging utility
   */
  log(message: string) {
    if (this.settings.enableLogging) {
      console.log(`[Vault Sync v2] ${message}`);
    }
  }
}
