/**
 * Vault file operations for Obsidian Vault Sync plugin
 */

import { Vault, TFile, TFolder, normalizePath } from 'obsidian';
import { VaultSyncSettings } from './types';
import { isExcluded, sanitizePath, calculateSHA, isBinaryFile } from './utils';

export class VaultUtils {
	private vault: Vault;
	private settings: VaultSyncSettings;

	constructor(vault: Vault, settings: VaultSyncSettings) {
		this.vault = vault;
		this.settings = settings;
	}

	/**
	 * List all files in the vault that should be synced
	 * Respects excluded folders setting
	 */
	async listVaultFiles(): Promise<TFile[]> {
		const allFiles = this.vault.getFiles();

		// Filter out excluded files
		const syncableFiles = allFiles.filter(file => {
			const shouldExclude = isExcluded(file.path, this.settings.excludedFolders);
			return !shouldExclude;
		});

		return syncableFiles;
	}

	/**
	 * Read a file's content from the vault
	 * Returns string for text files, ArrayBuffer for binary files
	 */
	async readVaultFile(file: TFile): Promise<string | ArrayBuffer> {
		if (isBinaryFile(file.path)) {
			// Read as binary
			return await this.vault.readBinary(file);
		} else {
			// Read as text
			return await this.vault.read(file);
		}
	}

	/**
	 * Write content to a file in the vault
	 * Creates parent directories if needed
	 */
	async writeVaultFile(path: string, content: string | ArrayBuffer): Promise<TFile> {
		const normalizedPath = normalizePath(sanitizePath(path));

		// Check if file already exists
		const existingFile = this.vault.getAbstractFileByPath(normalizedPath);
		if (existingFile && existingFile instanceof TFile) {
			// Update existing file
			if (typeof content === 'string') {
				await this.vault.modify(existingFile, content);
			} else {
				await this.vault.modifyBinary(existingFile, content);
			}
			return existingFile;
		}

		// Create parent directories if needed
		const parentPath = this.getParentPath(normalizedPath);
		if (parentPath) {
			await this.createFolder(parentPath);
		}

		// Create new file
		if (typeof content === 'string') {
			return await this.vault.create(normalizedPath, content);
		} else {
			return await this.vault.createBinary(normalizedPath, content);
		}
	}

	/**
	 * Delete a file from the vault
	 */
	async deleteVaultFile(file: TFile): Promise<void> {
		await this.vault.delete(file);
	}

	/**
	 * Get the SHA hash of a file in the vault
	 */
	async getFileHash(file: TFile): Promise<string> {
		const content = await this.readVaultFile(file);
		return await calculateSHA(content);
	}

	/**
	 * Check if a file exists in the vault
	 */
	fileExists(path: string): boolean {
		const normalizedPath = normalizePath(sanitizePath(path));
		const file = this.vault.getAbstractFileByPath(normalizedPath);
		return file !== null && file instanceof TFile;
	}

	/**
	 * Get a file by path
	 */
	getFile(path: string): TFile | null {
		const normalizedPath = normalizePath(sanitizePath(path));
		const file = this.vault.getAbstractFileByPath(normalizedPath);
		if (file && file instanceof TFile) {
			return file;
		}
		return null;
	}

	/**
	 * Create a folder and all parent folders if they don't exist
	 */
	private async createFolder(path: string): Promise<void> {
		const normalizedPath = normalizePath(sanitizePath(path));

		// Check if folder already exists
		const existingFolder = this.vault.getAbstractFileByPath(normalizedPath);
		if (existingFolder && existingFolder instanceof TFolder) {
			return;
		}

		// Create parent folders recursively
		const parentPath = this.getParentPath(normalizedPath);
		if (parentPath) {
			await this.createFolder(parentPath);
		}

		// Create this folder
		try {
			await this.vault.createFolder(normalizedPath);
		} catch (error) {
			// Ignore error if folder already exists
			if (!error.message?.includes('already exists')) {
				throw error;
			}
		}
	}

	/**
	 * Get the parent path of a file or folder
	 */
	private getParentPath(path: string): string | null {
		const lastSlash = path.lastIndexOf('/');
		if (lastSlash === -1) {
			return null;
		}
		return path.substring(0, lastSlash);
	}

	/**
	 * Get file metadata (size, modified time)
	 */
	getFileMetadata(file: TFile): { size: number; modified: number } {
		return {
			size: file.stat.size,
			modified: file.stat.mtime,
		};
	}

	/**
	 * Create a conflict file with timestamp
	 */
	async createConflictFile(originalPath: string, content: string | ArrayBuffer, timestamp: string): Promise<TFile> {
		// Extract file name and extension
		const lastDot = originalPath.lastIndexOf('.');
		const lastSlash = originalPath.lastIndexOf('/');

		let conflictPath: string;
		if (lastDot > lastSlash) {
			// Has extension
			const basePath = originalPath.substring(0, lastDot);
			const extension = originalPath.substring(lastDot);
			conflictPath = `${basePath}.conflict-${timestamp}${extension}`;
		} else {
			// No extension
			conflictPath = `${originalPath}.conflict-${timestamp}`;
		}

		return await this.writeVaultFile(conflictPath, content);
	}

	/**
	 * Move a file to trash folder (safe delete)
	 */
	async moveToTrash(file: TFile): Promise<void> {
		await this.vault.trash(file, true);
	}

	/**
	 * Get total number of files in vault (including excluded)
	 */
	getTotalFileCount(): number {
		return this.vault.getFiles().length;
	}

	/**
	 * Get total number of syncable files (excluding excluded folders)
	 */
	async getSyncableFileCount(): Promise<number> {
		const syncableFiles = await this.listVaultFiles();
		return syncableFiles.length;
	}
}
