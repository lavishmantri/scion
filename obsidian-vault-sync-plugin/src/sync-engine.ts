/**
 * Sync engine for Obsidian Vault Sync plugin
 * Handles bidirectional synchronization between vault and GitHub
 */

import { TFile } from 'obsidian';
import { GitHubAPI } from './github-api';
import { VaultUtils } from './vault-utils';
import { VaultSyncSettings, SyncResult, FileComparison, ConflictInfo, GitHubTreeItem, SyncState } from './types';
import { sanitizePath, formatConflictTimestamp, decodeBase64, decodeBase64ToArrayBuffer, isBinaryFile } from './utils';

export class SyncEngine {
	private githubAPI: GitHubAPI;
	private vaultUtils: VaultUtils;
	private settings: VaultSyncSettings;
	private logger: (message: string, ...args: unknown[]) => void;

	constructor(
		githubAPI: GitHubAPI,
		vaultUtils: VaultUtils,
		settings: VaultSyncSettings,
		logger: (message: string, ...args: unknown[]) => void
	) {
		this.githubAPI = githubAPI;
		this.vaultUtils = vaultUtils;
		this.settings = settings;
		this.logger = logger;
	}

	/**
	 * Perform a full bidirectional sync
	 */
	async performFullSync(syncState: SyncState): Promise<SyncResult> {
		// If force push mode is enabled, use force push logic instead
		if (this.settings.forcePushMode) {
			this.logger('⚠️  Force push mode enabled, performing force push instead of normal sync...');
			return await this.performForcePush(syncState);
		}

		this.logger('Starting full sync...');

		const result: SyncResult = {
			success: false,
			filesAdded: 0,
			filesModified: 0,
			filesDeleted: 0,
			conflicts: [],
			errors: [],
		};

		try{
			// Step 1: Get all files from vault and GitHub
			this.logger('Fetching file lists...');
			let localFiles = await this.vaultUtils.listVaultFiles();
			let remoteFiles = await this.githubAPI.getRepoTree();

			this.logger(`Found ${localFiles.length} local files, ${remoteFiles.length} remote files`);

			// Step 2: Compare and categorize files
			const comparison = await this.compareFileLists(localFiles, remoteFiles);

			this.logger(`Local only: ${comparison.localOnly.length}, Remote only: ${comparison.remoteOnly.length}, Both: ${comparison.both.length}`);

			// Step 3: Upload files that only exist locally (preserves local changes)
			if (comparison.localOnly.length > 0) {
				this.logger(`Uploading ${comparison.localOnly.length} local-only files...`);
				const uploadResult = await this.uploadFiles(comparison.localOnly);
				result.filesAdded += uploadResult.added;
				result.errors.push(...uploadResult.errors);
			}

			// Step 4: Download files that only exist remotely (gets new remote files)
			if (comparison.remoteOnly.length > 0) {
				this.logger(`Downloading ${comparison.remoteOnly.length} remote-only files...`);
				const downloadResult = await this.downloadFiles(comparison.remoteOnly);
				result.filesAdded += downloadResult.added;
				result.errors.push(...downloadResult.errors);
			}

			// Step 5: Resolve conflicts for files that exist in both locations
			if (comparison.both.length > 0) {
				this.logger(`Resolving ${comparison.both.length} files that exist in both locations...`);
				const conflictResult = await this.resolveConflicts(comparison.both, syncState);
				result.filesModified += conflictResult.modified;
				result.conflicts.push(...conflictResult.conflicts);
				result.errors.push(...conflictResult.errors);
			}

			// Step 6: Detect and handle deletions AFTER all uploads/downloads (if enabled)
			// Re-fetch file lists to get CURRENT state including newly uploaded/downloaded files
			if (this.settings.syncDeletes && Object.keys(syncState.fileSHAs).length > 0) {
				this.logger('Re-fetching file lists for delete detection...');
				localFiles = await this.vaultUtils.listVaultFiles();
				remoteFiles = await this.githubAPI.getRepoTree();

				this.logger('Detecting deletions...');
				const deleteResult = await this.handleDeletions(localFiles, remoteFiles, syncState);
				result.filesDeleted += deleteResult.deleted;
				result.errors.push(...deleteResult.errors);
			}

			// Update sync state
			syncState.lastSyncTime = Date.now();
			if (remoteFiles.length > 0) {
				const latestCommit = await this.githubAPI.getLatestCommit();
				syncState.lastSyncSHA = latestCommit.sha;
			}

			// Update file SHAs
			const updatedLocalFiles = await this.vaultUtils.listVaultFiles();
			syncState.fileSHAs = {};
			for (const file of updatedLocalFiles) {
				const sha = await this.vaultUtils.getFileHash(file);
				syncState.fileSHAs[file.path] = sha;
			}

			result.success = result.errors.length === 0;
			this.logger('Sync complete:', result);

			return result;
		} catch (error) {
			this.logger('Sync error:', error);
			result.errors.push(`Sync failed: ${error.message}`);
			return result;
		}
	}

	/**
	 * Compare local and remote file lists to categorize files
	 */
	private async compareFileLists(localFiles: TFile[], remoteFiles: GitHubTreeItem[]): Promise<FileComparison> {
		const localPaths = new Set(localFiles.map(f => sanitizePath(f.path)));
		const remotePaths = new Set(remoteFiles.map(f => sanitizePath(f.path)));

		// Files only in vault
		const localOnly = localFiles
			.filter(f => !remotePaths.has(sanitizePath(f.path)))
			.map(f => f.path);

		// Files only on GitHub
		const remoteOnly = remoteFiles.filter(f => !localPaths.has(sanitizePath(f.path)));

		// Files in both locations - need SHA comparison
		const both: Array<{ path: string; localSHA: string; remoteSHA: string }> = [];
		for (const localFile of localFiles) {
			const localPath = sanitizePath(localFile.path);
			const remoteFile = remoteFiles.find(f => sanitizePath(f.path) === localPath);

			if (remoteFile) {
				const localSHA = await this.vaultUtils.getFileHash(localFile);
				both.push({
					path: localFile.path,
					localSHA,
					remoteSHA: remoteFile.sha,
				});
			}
		}

		return { localOnly, remoteOnly, both };
	}

	/**
	 * Upload local-only files to GitHub
	 * Uses batch commits for efficiency when uploading multiple files
	 */
	private async uploadFiles(paths: string[]): Promise<{ added: number; errors: string[] }> {
		let added = 0;
		const errors: string[] = [];

		// Use batch upload for multiple files (more efficient)
		if (paths.length >= 5) {
			this.logger(`Using batch upload for ${paths.length} files`);

			try {
				// Prepare all files for batch upload
				const filesToUpload: Array<{ path: string; content: string | ArrayBuffer }> = [];

				for (const path of paths) {
					const file = this.vaultUtils.getFile(path);
					if (!file) {
						errors.push(`File not found: ${path}`);
						continue;
					}

					const content = await this.vaultUtils.readVaultFile(file);
					filesToUpload.push({ path, content });
				}

				// Batch upload in chunks of 20 files
				const chunkSize = 20;
				for (let i = 0; i < filesToUpload.length; i += chunkSize) {
					const chunk = filesToUpload.slice(i, i + chunkSize);
					const fileCount = chunk.length;

					try {
						await this.githubAPI.batchUpdateFiles(
							chunk,
							`Add ${fileCount} files (${i + 1}-${i + fileCount})`
						);
						added += fileCount;
						this.logger(`Batch uploaded ${fileCount} files`);
					} catch (error) {
						// If batch fails, fall back to individual uploads for this chunk
						this.logger(`Batch upload failed, falling back to individual uploads:`, error);
						for (const fileData of chunk) {
							try {
								await this.githubAPI.createFile(fileData.path, fileData.content, `Add ${fileData.path}`);
								added++;
								this.logger(`Uploaded: ${fileData.path}`);
							} catch (individualError) {
								this.logger(`Failed to upload ${fileData.path}:`, individualError);
								errors.push(`Upload failed for ${fileData.path}: ${individualError.message}`);
							}
						}
					}
				}
			} catch (error) {
				this.logger(`Batch upload preparation failed:`, error);
				errors.push(`Batch upload failed: ${error.message}`);
			}
		} else {
			// For small number of files, use individual uploads
			for (const path of paths) {
				try {
					const file = this.vaultUtils.getFile(path);
					if (!file) {
						errors.push(`File not found: ${path}`);
						continue;
					}

					const content = await this.vaultUtils.readVaultFile(file);
					await this.githubAPI.createFile(path, content, `Add ${path}`);
					added++;
					this.logger(`Uploaded: ${path}`);
				} catch (error) {
					this.logger(`Failed to upload ${path}:`, error);
					errors.push(`Upload failed for ${path}: ${error.message}`);
				}
			}
		}

		return { added, errors };
	}

	/**
	 * Download remote-only files from GitHub
	 */
	private async downloadFiles(files: GitHubTreeItem[]): Promise<{ added: number; errors: string[] }> {
		let added = 0;
		const errors: string[] = [];

		for (const remoteFile of files) {
			try {
				const fileData = await this.githubAPI.getFile(remoteFile.path);

				if (!fileData.content) {
					errors.push(`No content for ${remoteFile.path}`);
					continue;
				}

				// Decode content
				let content: string | ArrayBuffer;
				if (isBinaryFile(remoteFile.path)) {
					content = decodeBase64ToArrayBuffer(fileData.content);
				} else {
					content = decodeBase64(fileData.content);
				}

				await this.vaultUtils.writeVaultFile(remoteFile.path, content);
				added++;
				this.logger(`Downloaded: ${remoteFile.path}`);
			} catch (error) {
				this.logger(`Failed to download ${remoteFile.path}:`, error);
				errors.push(`Download failed for ${remoteFile.path}: ${error.message}`);
			}
		}

		return { added, errors };
	}

	/**
	 * Resolve conflicts for files that exist in both locations
	 */
	private async resolveConflicts(
		files: Array<{ path: string; localSHA: string; remoteSHA: string }>,
		syncState: SyncState
	): Promise<{ modified: number; conflicts: string[]; errors: string[] }> {
		let modified = 0;
		const conflicts: string[] = [];
		const errors: string[] = [];

		for (const fileInfo of files) {
			try {
				// If SHAs match, no conflict
				if (fileInfo.localSHA === fileInfo.remoteSHA) {
					this.logger(`No changes: ${fileInfo.path}`);
					continue;
				}

				// Check if file was seen before
				const lastSeenSHA = syncState.fileSHAs[fileInfo.path];

				if (lastSeenSHA) {
					// We have history - determine who changed
					const localChanged = fileInfo.localSHA !== lastSeenSHA;
					const remoteChanged = fileInfo.remoteSHA !== lastSeenSHA;

					if (localChanged && !remoteChanged) {
						// Only local changed - upload
						await this.uploadLocalChanges(fileInfo.path, fileInfo.remoteSHA);
						modified++;
						this.logger(`Uploaded changes: ${fileInfo.path}`);
						continue;
					}

					if (remoteChanged && !localChanged) {
						// Only remote changed - download
						await this.downloadRemoteChanges(fileInfo.path);
						modified++;
						this.logger(`Downloaded changes: ${fileInfo.path}`);
						continue;
					}

					// Both changed - real conflict
				}

				// No history or both changed - use conflict resolution strategy
				const conflictInfo = await this.getConflictInfo(fileInfo.path);
				await this.applyConflictResolution(conflictInfo);
				conflicts.push(fileInfo.path);
				modified++;
			} catch (error) {
				this.logger(`Failed to resolve conflict for ${fileInfo.path}:`, error);
				errors.push(`Conflict resolution failed for ${fileInfo.path}: ${error.message}`);
			}
		}

		return { modified, conflicts, errors };
	}

	/**
	 * Upload local changes for a file
	 */
	private async uploadLocalChanges(path: string, remoteSHA: string): Promise<void> {
		const file = this.vaultUtils.getFile(path);
		if (!file) {
			throw new Error(`File not found: ${path}`);
		}

		const content = await this.vaultUtils.readVaultFile(file);
		await this.githubAPI.updateFile(path, content, remoteSHA, `Update ${path}`);
	}

	/**
	 * Download remote changes for a file
	 */
	private async downloadRemoteChanges(path: string): Promise<void> {
		const fileData = await this.githubAPI.getFile(path);

		if (!fileData.content) {
			throw new Error(`No content for ${path}`);
		}

		let content: string | ArrayBuffer;
		if (isBinaryFile(path)) {
			content = decodeBase64ToArrayBuffer(fileData.content);
		} else {
			content = decodeBase64(fileData.content);
		}

		await this.vaultUtils.writeVaultFile(path, content);
	}

	/**
	 * Get conflict information for a file
	 */
	private async getConflictInfo(path: string): Promise<ConflictInfo> {
		// Get local version
		const localFile = this.vaultUtils.getFile(path);
		if (!localFile) {
			throw new Error(`Local file not found: ${path}`);
		}

		const localContent = await this.vaultUtils.readVaultFile(localFile);
		const localMetadata = this.vaultUtils.getFileMetadata(localFile);

		// Get remote version
		const remoteFile = await this.githubAPI.getFile(path);
		if (!remoteFile.content) {
			throw new Error(`Remote file has no content: ${path}`);
		}

		let remoteContent: string | ArrayBuffer;
		if (isBinaryFile(path)) {
			remoteContent = decodeBase64ToArrayBuffer(remoteFile.content);
		} else {
			remoteContent = decodeBase64(remoteFile.content);
		}

		// Get remote modified time from commit
		const latestCommit = await this.githubAPI.getLatestCommit();
		const remoteModified = new Date(latestCommit.author.date).getTime();

		return {
			path,
			localContent,
			remoteContent,
			localModified: localMetadata.modified,
			remoteModified,
			resolution: this.settings.conflictResolution === 'last-write-wins' ? 'keep-local' : 'create-conflict-file',
		};
	}

	/**
	 * Apply conflict resolution strategy
	 */
	private async applyConflictResolution(conflict: ConflictInfo): Promise<void> {
		if (this.settings.conflictResolution === 'last-write-wins') {
			// Compare timestamps and keep newer
			if (conflict.localModified > conflict.remoteModified) {
				// Local is newer - upload
				this.logger(`Keeping local version (newer): ${conflict.path}`);
				const fileData = await this.githubAPI.getFile(conflict.path);
				const file = this.vaultUtils.getFile(conflict.path);
				if (file) {
					const content = await this.vaultUtils.readVaultFile(file);
					await this.githubAPI.updateFile(conflict.path, content, fileData.sha, `Resolve conflict: ${conflict.path}`);
				}
			} else {
				// Remote is newer - download
				this.logger(`Keeping remote version (newer): ${conflict.path}`);
				await this.vaultUtils.writeVaultFile(conflict.path, conflict.remoteContent);
			}
		} else {
			// Create conflict file for manual resolution
			this.logger(`Creating conflict file: ${conflict.path}`);
			const timestamp = formatConflictTimestamp();

			// Keep local version in original file
			// Save remote version as conflict file
			await this.vaultUtils.createConflictFile(conflict.path, conflict.remoteContent, timestamp);

			// Upload local version to GitHub
			const fileData = await this.githubAPI.getFile(conflict.path);
			const file = this.vaultUtils.getFile(conflict.path);
			if (file) {
				const content = await this.vaultUtils.readVaultFile(file);
				await this.githubAPI.updateFile(conflict.path, content, fileData.sha, `Resolve conflict (keep local): ${conflict.path}`);
			}
		}
	}

	/**
	 * Handle file deletions (detect and propagate)
	 */
	private async handleDeletions(
		localFiles: TFile[],
		remoteFiles: GitHubTreeItem[],
		syncState: SyncState
	): Promise<{ deleted: number; errors: string[] }> {
		let deleted = 0;
		const errors: string[] = [];

		// Get previous file list from sync state
		const previousPaths = Object.keys(syncState.fileSHAs);
		const currentLocalPaths = localFiles.map(f => sanitizePath(f.path));
		const currentRemotePaths = remoteFiles.map(f => sanitizePath(f.path));

		// Detect local deletions (files that were tracked but no longer exist locally)
		const localDeleted = previousPaths.filter(p => {
			const normalized = sanitizePath(p);
			return !currentLocalPaths.includes(normalized) && currentRemotePaths.includes(normalized);
		});

		// Detect remote deletions (files that were tracked but no longer exist remotely)
		const remoteDeleted = previousPaths.filter(p => {
			const normalized = sanitizePath(p);
			return !currentRemotePaths.includes(normalized) && currentLocalPaths.includes(normalized);
		});

		this.logger(`Detected deletions - Local: ${localDeleted.length}, Remote: ${remoteDeleted.length}`);

		// Handle local deletions (delete from remote)
		if (localDeleted.length > 0) {
			this.logger(`Deleting ${localDeleted.length} files from GitHub...`);
			for (const path of localDeleted) {
				try {
					// Get the file's current SHA from GitHub
					const remoteFile = remoteFiles.find(f => sanitizePath(f.path) === sanitizePath(path));
					if (remoteFile) {
						await this.githubAPI.deleteFile(path, remoteFile.sha, `Delete ${path}`);
						deleted++;
						this.logger(`Deleted from GitHub: ${path}`);

						// Remove from sync state
						delete syncState.fileSHAs[path];
					}
				} catch (error) {
					// Ignore 404 errors (file already deleted)
					if (error.status !== 404) {
						this.logger(`Failed to delete ${path} from GitHub:`, error);
						errors.push(`Failed to delete ${path} from GitHub: ${error.message}`);
					}
				}
			}
		}

		// Handle remote deletions (delete from local or move to trash)
		if (remoteDeleted.length > 0) {
			this.logger(`Deleting ${remoteDeleted.length} files from vault...`);
			for (const path of remoteDeleted) {
				try {
					const file = this.vaultUtils.getFile(path);
					if (file) {
						if (this.settings.useTrashForDeletes) {
							await this.vaultUtils.moveToTrash(file);
							this.logger(`Moved to trash: ${path}`);
						} else {
							await this.vaultUtils.deleteVaultFile(file);
							this.logger(`Deleted from vault: ${path}`);
						}
						deleted++;

						// Remove from sync state
						delete syncState.fileSHAs[path];
					}
				} catch (error) {
					this.logger(`Failed to delete ${path} from vault:`, error);
					errors.push(`Failed to delete ${path} from vault: ${error.message}`);
				}
			}
		}

		return { deleted, errors };
	}

	/**
	 * Force push: Overwrite ALL remote files with local vault
	 * - Uploads/updates ALL local files (ignores conflicts)
	 * - Deletes ALL remote-only files
	 * - Makes remote an exact copy of local
	 *
	 * USE WITH CAUTION: This will OVERWRITE remote changes!
	 */
	async performForcePush(syncState: SyncState): Promise<SyncResult> {
		this.logger('⚠️  Starting FORCE PUSH (will overwrite remote)...');

		const result: SyncResult = {
			success: false,
			filesAdded: 0,
			filesModified: 0,
			filesDeleted: 0,
			conflicts: [],
			errors: [],
		};

		try {
			// Step 1: Get all files
			this.logger('Fetching file lists...');
			const localFiles = await this.vaultUtils.listVaultFiles();
			let remoteFiles = await this.githubAPI.getRepoTree();

			this.logger(`Found ${localFiles.length} local files, ${remoteFiles.length} remote files`);

			// Step 2: Upload/update ALL local files (force overwrite)
			if (localFiles.length > 0) {
				this.logger(`Force uploading/updating ${localFiles.length} local files...`);

				for (const localFile of localFiles) {
					try {
						const content = await this.vaultUtils.readVaultFile(localFile);
						const remoteFile = remoteFiles.find(rf => sanitizePath(rf.path) === sanitizePath(localFile.path));

						if (remoteFile) {
							// File exists remotely - update it (force)
							await this.githubAPI.updateFile(
								localFile.path,
								content,
								remoteFile.sha,
								`Force push: Update ${localFile.path}`
							);
							result.filesModified++;
							this.logger(`✓ Force updated: ${localFile.path}`);
						} else {
							// File doesn't exist remotely - create it
							await this.githubAPI.createFile(
								localFile.path,
								content,
								`Force push: Add ${localFile.path}`
							);
							result.filesAdded++;
							this.logger(`✓ Force added: ${localFile.path}`);
						}
					} catch (error) {
						this.logger(`✗ Failed to force push ${localFile.path}:`, error);
						result.errors.push(`Failed to push ${localFile.path}: ${error.message}`);
					}
				}
			}

			// Step 3: Delete remote-only files (not in local vault)
			const localPaths = new Set(localFiles.map(f => sanitizePath(f.path)));
			const remoteOnlyFiles = remoteFiles.filter(rf => !localPaths.has(sanitizePath(rf.path)));

			if (remoteOnlyFiles.length > 0) {
				this.logger(`Deleting ${remoteOnlyFiles.length} remote-only files...`);

				// Re-fetch remote files after uploads to get current SHAs
				remoteFiles = await this.githubAPI.getRepoTree();

				for (const remoteFile of remoteOnlyFiles) {
					try {
						// Find updated SHA
						const currentRemoteFile = remoteFiles.find(rf => sanitizePath(rf.path) === sanitizePath(remoteFile.path));
						const sha = currentRemoteFile ? currentRemoteFile.sha : remoteFile.sha;

						await this.githubAPI.deleteFile(
							remoteFile.path,
							sha,
							`Force push: Delete ${remoteFile.path}`
						);
						result.filesDeleted++;
						this.logger(`✓ Force deleted: ${remoteFile.path}`);
					} catch (error) {
						// Ignore 404 errors (file already deleted)
						if (error.status !== 404) {
							this.logger(`✗ Failed to delete ${remoteFile.path}:`, error);
							result.errors.push(`Failed to delete ${remoteFile.path}: ${error.message}`);
						}
					}
				}
			}

			// Step 4: Update sync state
			syncState.lastSyncTime = Date.now();

			const updatedRemoteFiles = await this.githubAPI.getRepoTree();
			if (updatedRemoteFiles.length > 0) {
				const latestCommit = await this.githubAPI.getLatestCommit();
				syncState.lastSyncSHA = latestCommit.sha;
			}

			syncState.fileSHAs = {};
			for (const file of localFiles) {
				const sha = await this.vaultUtils.getFileHash(file);
				syncState.fileSHAs[file.path] = sha;
			}

			result.success = result.errors.length === 0;
			this.logger('✅ Force push complete:', result);

			return result;
		} catch (error) {
			this.logger('❌ Force push error:', error);
			result.errors.push(`Force push failed: ${error.message}`);
			return result;
		}
	}
}
