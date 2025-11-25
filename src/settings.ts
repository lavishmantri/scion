/**
 * Settings UI for Vault Sync v2 plugin
 */

import { App, PluginSettingTab, Setting } from 'obsidian';
import { VaultSyncV2Settings } from './types';
import VaultSyncV2Plugin from './main';

export class VaultSyncV2SettingTab extends PluginSettingTab {
  plugin: VaultSyncV2Plugin;

  constructor(app: App, plugin: VaultSyncV2Plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Vault Sync v2 Settings' });

    // Server configuration section
    containerEl.createEl('h3', { text: 'Server Configuration' });

    new Setting(containerEl)
      .setName('Server URL')
      .setDesc('URL of your Vault Sync server (e.g., http://localhost:3000 or http://192.168.1.100:3000)')
      .addText(text =>
        text
          .setPlaceholder('http://localhost:3000')
          .setValue(this.plugin.settings.serverUrl)
          .onChange(async value => {
            this.plugin.settings.serverUrl = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('API Key')
      .setDesc('API key for authenticating with the server (keep this secret!)')
      .addText(text =>
        text
          .setPlaceholder('your-api-key')
          .setValue(this.plugin.settings.apiKey)
          .onChange(async value => {
            this.plugin.settings.apiKey = value.trim();
            await this.plugin.saveSettings();
          })
          .inputEl.type = 'password'
      );

    new Setting(containerEl)
      .setName('Test Connection')
      .setDesc('Verify that the plugin can reach your server')
      .addButton(button =>
        button
          .setButtonText('Test')
          .onClick(async () => {
            await this.plugin.testConnection();
          })
      );

    // Sync configuration section
    containerEl.createEl('h3', { text: 'Sync Configuration' });

    new Setting(containerEl)
      .setName('.nosync File Path')
      .setDesc('Path to file containing patterns for files to exclude from sync (gitignore format)')
      .addText(text =>
        text
          .setPlaceholder('.nosync')
          .setValue(this.plugin.settings.nosyncPath)
          .onChange(async value => {
            this.plugin.settings.nosyncPath = value.trim() || '.nosync';
            await this.plugin.saveSettings();
          })
      );

    // UI settings section
    containerEl.createEl('h3', { text: 'UI Settings' });

    new Setting(containerEl)
      .setName('Enable Logging')
      .setDesc('Show detailed logs in console (Cmd+Option+I)')
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.enableLogging)
          .onChange(async value => {
            this.plugin.settings.enableLogging = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Show Notifications')
      .setDesc('Display notifications for sync operations')
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.showNotifications)
          .onChange(async value => {
            this.plugin.settings.showNotifications = value;
            await this.plugin.saveSettings();
          })
      );

    // Information section
    containerEl.createEl('h3', { text: 'Information' });

    containerEl.createEl('p', { text: 'Push: Upload your local changes to the server' });
    containerEl.createEl('p', { text: 'Pull: Download changes from the server to your vault' });
    containerEl.createEl('p', { text: 'If conflicts are detected, you must manually resolve them before retrying.' });

    const linksEl = containerEl.createEl('div', { cls: 'vault-sync-links' });
    linksEl.createEl('a', {
      text: 'Documentation',
      href: '#'
    }).onclick = (e) => {
      e.preventDefault();
      // Open documentation
    };
  }
}
