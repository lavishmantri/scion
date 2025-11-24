import { App, PluginSettingTab, Setting } from 'obsidian';
import VaultSyncPlugin from './main';
import { VaultSyncSettings } from './types';

export class VaultSyncSettingTab extends PluginSettingTab {
	plugin: VaultSyncPlugin;

	constructor(app: App, plugin: VaultSyncPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		// Header
		containerEl.createEl('h2', { text: 'Vault Sync Settings' });

		// Sync Mode Selection
		new Setting(containerEl)
			.setName('Sync mode')
			.setDesc('Choose sync backend: GitHub API or Local Server')
			.addDropdown(dropdown => dropdown
				.addOption('github', 'GitHub API')
				.addOption('server', 'Local Server (coming soon)')
				.setValue(this.plugin.settings.syncMode)
				.onChange(async (value: 'github' | 'server') => {
					this.plugin.settings.syncMode = value;
					await this.plugin.saveSettings();
					this.display(); // Refresh to show/hide relevant settings
				}));

		// GitHub Settings
		if (this.plugin.settings.syncMode === 'github') {
			containerEl.createEl('h3', { text: 'GitHub Settings' });

			new Setting(containerEl)
				.setName('Personal Access Token')
				.setDesc('GitHub fine-grained PAT with Contents: Read and Write permission')
				.addText(text => text
					.setPlaceholder('ghp_xxxxxxxxxxxxx')
					.setValue(this.plugin.settings.githubToken)
					.onChange(async (value) => {
						this.plugin.settings.githubToken = value;
						await this.plugin.saveSettings();
					})
					.inputEl.type = 'password');

			new Setting(containerEl)
				.setName('Repository owner')
				.setDesc('Your GitHub username or organization')
				.addText(text => text
					.setPlaceholder('username')
					.setValue(this.plugin.settings.githubOwner)
					.onChange(async (value) => {
						this.plugin.settings.githubOwner = value;
						await this.plugin.saveSettings();
					}));

			new Setting(containerEl)
				.setName('Repository name')
				.setDesc('Name of the repository to sync with')
				.addText(text => text
					.setPlaceholder('my-vault')
					.setValue(this.plugin.settings.githubRepo)
					.onChange(async (value) => {
						this.plugin.settings.githubRepo = value;
						await this.plugin.saveSettings();
					}));

			new Setting(containerEl)
				.setName('Branch')
				.setDesc('Branch to sync (usually "main" or "master")')
				.addText(text => text
					.setPlaceholder('main')
					.setValue(this.plugin.settings.githubBranch)
					.onChange(async (value) => {
						this.plugin.settings.githubBranch = value;
						await this.plugin.saveSettings();
					}));

			// Test connection button
			new Setting(containerEl)
				.setName('Test connection')
				.setDesc('Verify GitHub API access')
				.addButton(button => button
					.setButtonText('Test')
					.onClick(async () => {
						button.setButtonText('Testing...');
						button.setDisabled(true);
						const result = await this.plugin.testGitHubConnection();
						button.setButtonText(result.success ? '✓ Success' : '✗ Failed');
						button.setDisabled(false);

						if (result.success) {
							// Reset button text after 2 seconds
							setTimeout(() => button.setButtonText('Test'), 2000);
						}
					}));
		}

		// Local Server Settings (coming soon)
		if (this.plugin.settings.syncMode === 'server') {
			containerEl.createEl('h3', { text: 'Local Server Settings' });

			containerEl.createEl('p', {
				text: 'Local server sync is coming in Phase 2. Stay tuned!',
				cls: 'mod-warning'
			});

			new Setting(containerEl)
				.setName('Server URL')
				.setDesc('HTTPS URL of your local sync server (e.g., https://100.x.x.x:3000)')
				.addText(text => text
					.setPlaceholder('https://100.x.x.x:3000')
					.setValue(this.plugin.settings.serverUrl)
					.setDisabled(true)
					.onChange(async (value) => {
						this.plugin.settings.serverUrl = value;
						await this.plugin.saveSettings();
					}));

			new Setting(containerEl)
				.setName('API Key')
				.setDesc('API key for server authentication')
				.addText(text => {
					text
						.setPlaceholder('your-api-key')
						.setValue(this.plugin.settings.serverApiKey)
						.setDisabled(true)
						.onChange(async (value) => {
							this.plugin.settings.serverApiKey = value;
							await this.plugin.saveSettings();
						});
					text.inputEl.type = 'password';
					return text;
				});
		}

		// Sync Behavior Settings
		containerEl.createEl('h3', { text: 'Sync Behavior' });

		new Setting(containerEl)
			.setName('Auto-sync interval')
			.setDesc('Automatic sync interval in minutes (0 to disable)')
			.addText(text => text
				.setPlaceholder('5')
				.setValue(String(this.plugin.settings.autoSyncInterval))
				.onChange(async (value) => {
					const num = parseInt(value);
					if (!isNaN(num) && num >= 0) {
						this.plugin.settings.autoSyncInterval = num;
						await this.plugin.saveSettings();
						this.plugin.restartAutoSync();
					}
				}));

		new Setting(containerEl)
			.setName('Excluded folders')
			.setDesc('Folders to exclude from sync (comma-separated)')
			.addTextArea(text => text
				.setPlaceholder('.obsidian, .trash, .git')
				.setValue(this.plugin.settings.excludedFolders.join(', '))
				.onChange(async (value) => {
					this.plugin.settings.excludedFolders = value
						.split(',')
						.map(f => f.trim())
						.filter(f => f.length > 0);
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Conflict resolution')
			.setDesc('How to handle conflicts when file is modified on both sides')
			.addDropdown(dropdown => dropdown
				.addOption('last-write-wins', 'Last write wins (simpler)')
				.addOption('create-conflict-file', 'Create conflict file (safer)')
				.setValue(this.plugin.settings.conflictResolution)
				.onChange(async (value: 'last-write-wins' | 'create-conflict-file') => {
					this.plugin.settings.conflictResolution = value;
					await this.plugin.saveSettings();
				}));

		// Delete Sync Settings
		containerEl.createEl('h3', { text: 'Delete Synchronization' });

		new Setting(containerEl)
			.setName('Sync deletions')
			.setDesc('Synchronize file deletions between vault and GitHub (delete locally → delete remotely, and vice versa)')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.syncDeletes)
				.onChange(async (value) => {
					this.plugin.settings.syncDeletes = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Use trash for deletions')
			.setDesc('Move deleted files to trash instead of permanent deletion (safer, recommended)')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.useTrashForDeletes)
				.onChange(async (value) => {
					this.plugin.settings.useTrashForDeletes = value;
					await this.plugin.saveSettings();
				}));

		// Force Push Settings
		containerEl.createEl('h3', { text: '⚠️  Force Push (Advanced)' });

		new Setting(containerEl)
			.setName('Force push mode')
			.setDesc('⚠️  DANGER: When enabled, ALL syncs will overwrite remote with local files. Remote changes will be LOST. Use with extreme caution!')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.forcePushMode)
				.onChange(async (value) => {
					this.plugin.settings.forcePushMode = value;
					await this.plugin.saveSettings();
				}));

		// UI Settings
		containerEl.createEl('h3', { text: 'User Interface' });

		new Setting(containerEl)
			.setName('Enable logging')
			.setDesc('Show detailed logs in developer console')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableLogging)
				.onChange(async (value) => {
					this.plugin.settings.enableLogging = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Show notifications')
			.setDesc('Show notifications for sync events')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showNotifications)
				.onChange(async (value) => {
					this.plugin.settings.showNotifications = value;
					await this.plugin.saveSettings();
				}));

		// Manual sync button
		containerEl.createEl('h3', { text: 'Manual Sync' });

		new Setting(containerEl)
			.setName('Sync now')
			.setDesc('Trigger manual sync (also available via ribbon icon)')
			.addButton(button => button
				.setButtonText('Sync')
				.setCta()
				.onClick(async () => {
					button.setButtonText('Syncing...');
					button.setDisabled(true);
					await this.plugin.performSync();
					button.setButtonText('Sync');
					button.setDisabled(false);
				}));
	}
}
