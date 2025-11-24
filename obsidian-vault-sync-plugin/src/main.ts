import { Notice, Plugin, TFile, requestUrl } from 'obsidian';
import { VaultSyncSettingTab } from './settings';
import { VaultSyncSettings, DEFAULT_SETTINGS, SyncStatus, SyncState } from './types';
import { GitHubAPI } from './github-api';
import { VaultUtils } from './vault-utils';
import { SyncEngine } from './sync-engine';
import { Debouncer } from './debouncer';
import { ConfirmModal } from './confirm-modal';

export default class VaultSyncPlugin extends Plugin {
	settings: VaultSyncSettings;
	syncStatus: SyncStatus = SyncStatus.Idle;
	statusBarItem: HTMLElement;
	autoSyncInterval: number | null = null;
	syncState: SyncState = {
		lastSyncTime: 0,
		lastSyncSHA: '',
		fileSHAs: {},
	};
	syncDebouncer: Debouncer<string>;
	isSyncingFromWatch: boolean = false;

	async onload() {
		await this.loadSettings();

		// Add status bar item
		this.statusBarItem = this.addStatusBarItem();
		this.updateStatusBar(SyncStatus.Idle);

		// Add ribbon icon
		this.addRibbonIcon('sync', 'Sync vault', async () => {
			await this.performSync();
		});

		// Add command
		this.addCommand({
			id: 'sync-vault',
			name: 'Sync vault',
			callback: async () => {
				await this.performSync();
			}
		});

		// Add command to test connection
		this.addCommand({
			id: 'test-connection',
			name: 'Test sync connection',
			callback: async () => {
				const result = await this.testGitHubConnection();
				if (result.success) {
					new Notice('✓ Connection successful!');
				} else {
					new Notice(`✗ Connection failed: ${result.message}`);
				}
			}
		});

		// Add force push command
		this.addCommand({
			id: 'force-push-vault',
			name: 'Force push vault to GitHub (⚠️ overwrites remote)',
			callback: async () => {
				const confirmed = await this.confirmForcePush();
				if (confirmed) {
					await this.performForcePush();
				}
			}
		});

		// Add settings tab
		this.addSettingTab(new VaultSyncSettingTab(this.app, this));

		// Initialize debouncer for file watching
		this.syncDebouncer = new Debouncer<string>(async (changedPaths) => {
			this.log(`Debouncer triggered with ${changedPaths.size} changed files`);
			await this.performSync();
		}, 2000); // 2 second delay

		// Register vault event listeners for auto-sync
		this.registerVaultEvents();

		// Start auto-sync if enabled
		this.startAutoSync();

		this.log('Vault Sync plugin loaded');
	}

	onunload() {
		this.stopAutoSync();
		this.syncDebouncer.cancel();
		this.log('Vault Sync plugin unloaded');
	}

	registerVaultEvents() {
		// File created
		this.registerEvent(
			this.app.vault.on('create', (file) => {
				if (file instanceof TFile) {
					this.log(`File created: ${file.path}`);
					this.queueSync(file.path);
				}
			})
		);

		// File modified
		this.registerEvent(
			this.app.vault.on('modify', (file) => {
				if (file instanceof TFile) {
					this.log(`File modified: ${file.path}`);
					this.queueSync(file.path);
				}
			})
		);

		// File deleted
		this.registerEvent(
			this.app.vault.on('delete', (file) => {
				if (file instanceof TFile) {
					this.log(`File deleted: ${file.path}`);
					this.queueSync(file.path);
				}
			})
		);

		// File renamed (treat as delete + create)
		this.registerEvent(
			this.app.vault.on('rename', (file, oldPath) => {
				if (file instanceof TFile) {
					this.log(`File renamed: ${oldPath} → ${file.path}`);
					this.queueSync(oldPath);
					this.queueSync(file.path);
				}
			})
		);
	}

	queueSync(path: string) {
		// Don't queue if sync is already in progress
		if (this.syncStatus === SyncStatus.Syncing) {
			return;
		}

		// Don't queue if this is a sync operation itself
		if (this.isSyncingFromWatch) {
			return;
		}

		this.syncDebouncer.add(path);
	}

	async loadSettings() {
		const data = await this.loadData();
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data?.settings || {});
		this.syncState = Object.assign(
			{ lastSyncTime: 0, lastSyncSHA: '', fileSHAs: {} },
			data?.syncState || {}
		);
	}

	async saveSettings() {
		await this.saveData({
			settings: this.settings,
			syncState: this.syncState,
		});
	}

	log(message: string, ...args: any[]) {
		if (this.settings.enableLogging) {
			console.log(`[Vault Sync] ${message}`, ...args);
		}
	}

	showNotification(message: string) {
		if (this.settings.showNotifications) {
			new Notice(message);
		}
	}

	updateStatusBar(status: SyncStatus, details?: string) {
		this.syncStatus = status;

		const statusIcons = {
			[SyncStatus.Idle]: '✓',
			[SyncStatus.Syncing]: '⟳',
			[SyncStatus.Offline]: '⚠',
			[SyncStatus.Error]: '✗',
			[SyncStatus.Conflict]: '⚠',
		};

		const statusTexts = {
			[SyncStatus.Idle]: 'Synced',
			[SyncStatus.Syncing]: 'Syncing',
			[SyncStatus.Offline]: 'Offline',
			[SyncStatus.Error]: 'Error',
			[SyncStatus.Conflict]: 'Conflict',
		};

		const icon = statusIcons[status];
		const text = statusTexts[status];
		const display = details ? `${icon} ${text}: ${details}` : `${icon} ${text}`;

		this.statusBarItem.setText(display);
	}

	async performSync() {
		if (this.syncStatus === SyncStatus.Syncing) {
			this.log('Sync already in progress, skipping');
			return;
		}

		this.log('Starting sync');
		this.updateStatusBar(SyncStatus.Syncing);

		// Set flag to prevent sync loops
		this.isSyncingFromWatch = true;

		try {
			// Validate settings
			if (this.settings.syncMode === 'github') {
				if (!this.settings.githubToken || !this.settings.githubOwner || !this.settings.githubRepo) {
					throw new Error('GitHub settings not configured. Please check plugin settings.');
				}
			} else if (this.settings.syncMode === 'server') {
				throw new Error('Local server sync not implemented yet (Phase 2)');
			}

			// Initialize sync components
			const githubAPI = new GitHubAPI(this.settings);
			const vaultUtils = new VaultUtils(this.app.vault, this.settings);
			const syncEngine = new SyncEngine(
				githubAPI,
				vaultUtils,
				this.settings,
				this.log.bind(this)
			);

			// Perform sync
			const result = await syncEngine.performFullSync(this.syncState);

			// Save updated sync state
			await this.saveSettings();

			// Update status bar and notify user
			if (result.success) {
				const totalChanges = result.filesAdded + result.filesModified + result.filesDeleted;
				if (totalChanges === 0) {
					this.updateStatusBar(SyncStatus.Idle);
					this.log('Sync complete: No changes');
				} else {
					this.updateStatusBar(SyncStatus.Idle);
					const summary = [
						result.filesAdded > 0 ? `${result.filesAdded} added` : '',
						result.filesModified > 0 ? `${result.filesModified} modified` : '',
						result.filesDeleted > 0 ? `${result.filesDeleted} deleted` : '',
					].filter(s => s).join(', ');
					this.showNotification(`Sync complete: ${summary}`);
					this.log('Sync complete:', summary);
				}

				if (result.conflicts.length > 0) {
					this.updateStatusBar(SyncStatus.Conflict, `${result.conflicts.length} conflicts`);
					this.showNotification(`⚠ ${result.conflicts.length} conflicts detected. Check conflict files.`);
				}
			} else {
				this.updateStatusBar(SyncStatus.Error, `${result.errors.length} errors`);
				this.showNotification(`Sync failed with ${result.errors.length} errors. Check console.`);
				this.log('Sync failed with errors:', result.errors);
			}
		} catch (error) {
			this.log('Sync error:', error);
			this.updateStatusBar(SyncStatus.Error, error.message);
			this.showNotification(`Sync failed: ${error.message}`);
		} finally {
			// Reset flag to allow file watching again
			this.isSyncingFromWatch = false;
		}
	}

	async testGitHubConnection(): Promise<{ success: boolean; message?: string }> {
		if (!this.settings.githubToken || !this.settings.githubOwner || !this.settings.githubRepo) {
			return {
				success: false,
				message: 'Please configure GitHub settings first'
			};
		}

		try {
			this.log('Testing GitHub connection...');

			// Test by fetching repository info
			const url = `https://api.github.com/repos/${this.settings.githubOwner}/${this.settings.githubRepo}`;

			const response = await requestUrl({
				url,
				method: 'GET',
				headers: {
					'Authorization': `Bearer ${this.settings.githubToken}`,
					'Accept': 'application/vnd.github+json',
					'X-GitHub-Api-Version': '2022-11-28'
				}
			});

			if (response.status === 200) {
				this.log('GitHub connection successful');
				return { success: true };
			} else {
				this.log('GitHub connection failed:', response.status, response.text);
				return {
					success: false,
					message: `HTTP ${response.status}: ${response.text}`
				};
			}
		} catch (error) {
			this.log('GitHub connection error:', error);
			return {
				success: false,
				message: error.message || 'Unknown error'
			};
		}
	}

	startAutoSync() {
		if (this.settings.autoSyncInterval > 0) {
			this.log(`Starting auto-sync with ${this.settings.autoSyncInterval} minute interval`);
			this.autoSyncInterval = window.setInterval(
				() => this.performSync(),
				this.settings.autoSyncInterval * 60 * 1000
			);
		}
	}

	stopAutoSync() {
		if (this.autoSyncInterval !== null) {
			this.log('Stopping auto-sync');
			window.clearInterval(this.autoSyncInterval);
			this.autoSyncInterval = null;
		}
	}

	restartAutoSync() {
		this.stopAutoSync();
		this.startAutoSync();
	}

	async confirmForcePush(): Promise<boolean> {
		return new Promise((resolve) => {
			const modal = new ConfirmModal(
				this.app,
				'⚠️  Force Push Warning',
				'This will OVERWRITE all files on GitHub with your local vault.\n\n' +
				'Remote changes will be LOST.\n\n' +
				'Are you absolutely sure you want to proceed?',
				(confirmed) => resolve(confirmed)
			);
			modal.open();
		});
	}

	async performForcePush(): Promise<void> {
		this.log('🚀 Starting force push...');
		this.updateStatusBar(SyncStatus.Syncing);

		// Set flag to prevent sync loops
		this.isSyncingFromWatch = true;

		try {
			// Validate settings
			if (this.settings.syncMode === 'github') {
				if (!this.settings.githubToken || !this.settings.githubOwner || !this.settings.githubRepo) {
					throw new Error('GitHub settings not configured. Please check plugin settings.');
				}
			} else if (this.settings.syncMode === 'server') {
				throw new Error('Local server sync not implemented yet (Phase 2)');
			}

			// Initialize sync components
			const githubAPI = new GitHubAPI(this.settings);
			const vaultUtils = new VaultUtils(this.app.vault, this.settings);
			const syncEngine = new SyncEngine(
				githubAPI,
				vaultUtils,
				this.settings,
				this.log.bind(this)
			);

			// Perform force push
			const result = await syncEngine.performForcePush(this.syncState);

			// Save updated sync state
			await this.saveSettings();

			// Update status bar and notify user
			if (result.success) {
				this.updateStatusBar(SyncStatus.Idle);
				const summary = [
					result.filesAdded > 0 ? `${result.filesAdded} added` : '',
					result.filesModified > 0 ? `${result.filesModified} updated` : '',
					result.filesDeleted > 0 ? `${result.filesDeleted} deleted` : '',
				].filter(s => s).join(', ');
				this.showNotification(`✅ Force push complete: ${summary}`);
				this.log('Force push complete:', summary);
			} else {
				this.updateStatusBar(SyncStatus.Error, `${result.errors.length} errors`);
				this.showNotification(`❌ Force push failed with ${result.errors.length} errors. Check console.`);
				this.log('Force push failed with errors:', result.errors);
			}
		} catch (error) {
			this.log('Force push error:', error);
			this.updateStatusBar(SyncStatus.Error, error.message);
			this.showNotification(`❌ Force push failed: ${error.message}`);
		} finally {
			// Reset flag to allow file watching again
			this.isSyncingFromWatch = false;
		}
	}
}
