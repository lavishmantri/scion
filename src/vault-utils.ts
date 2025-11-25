/**
 * Vault file operations
 */

import { Vault, TFile, TFolder } from 'obsidian';
import { calculateHash } from './utils';
import { IgnorePatterns } from './ignore-patterns';
import { FileInfo } from './types';

export class VaultUtils {
  private vault: Vault;
  private ignorePatterns: IgnorePatterns;

  constructor(vault: Vault, ignorePatterns: IgnorePatterns) {
    this.vault = vault;
    this.ignorePatterns = ignorePatterns;
  }

  /**
   * Get all vault files (excluding ignored patterns)
   */
  async listVaultFiles(): Promise<FileInfo[]> {
    const files: FileInfo[] = [];
    const vaultRoot = this.vault.getRoot();

    if (!vaultRoot) return files;

    await this.walkDirectory(vaultRoot, '', files);
    return files;
  }

  /**
   * Recursively walk directory and collect files
   */
  private async walkDirectory(folder: TFolder, prefix: string, files: FileInfo[]): Promise<void> {
    for (const child of folder.children) {
      const relativePath = prefix ? `${prefix}/${child.name}` : child.name;

      // Check if should be ignored
      if (this.ignorePatterns.shouldIgnore(relativePath)) {
        continue;
      }

      if (child instanceof TFile) {
        try {
          const content = await this.vault.cachedRead(child);
          const hash = await calculateHash(content);

          files.push({
            path: relativePath,
            hash: hash,
            size: content.length
          });
        } catch (err) {
          console.error(`Error reading file ${relativePath}:`, err);
        }
      } else if (child instanceof TFolder) {
        await this.walkDirectory(child, relativePath, files);
      }
    }
  }

  /**
   * Read a file from vault
   */
  async readFile(filePath: string): Promise<string> {
    const file = this.vault.getAbstractFileByPath(filePath);

    if (!(file instanceof TFile)) {
      throw new Error(`File not found: ${filePath}`);
    }

    return await this.vault.cachedRead(file);
  }

  /**
   * Read file as ArrayBuffer
   */
  async readFileAsBuffer(filePath: string): Promise<ArrayBuffer> {
    const file = this.vault.getAbstractFileByPath(filePath);

    if (!(file instanceof TFile)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const content = await this.vault.cachedRead(file);
    const buffer = new ArrayBuffer(content.length);
    const view = new Uint8Array(buffer);

    for (let i = 0; i < content.length; i++) {
      view[i] = content.charCodeAt(i);
    }

    return buffer;
  }

  /**
   * Write a file to vault
   */
  async writeFile(filePath: string, content: string): Promise<void> {
    const file = this.vault.getAbstractFileByPath(filePath);

    if (file instanceof TFile) {
      // File exists, update it
      await this.vault.modify(file, content);
    } else {
      // File doesn't exist, create it
      await this.vault.create(filePath, content);
    }
  }

  /**
   * Write file from ArrayBuffer
   */
  async writeFileFromBuffer(filePath: string, buffer: ArrayBuffer): Promise<void> {
    // Convert ArrayBuffer to string for Obsidian API
    const view = new Uint8Array(buffer);
    const content = String.fromCharCode.apply(null, Array.from(view));

    await this.writeFile(filePath, content);
  }

  /**
   * Delete a file from vault
   */
  async deleteFile(filePath: string): Promise<void> {
    const file = this.vault.getAbstractFileByPath(filePath);

    if (!file) {
      throw new Error(`File not found: ${filePath}`);
    }

    await this.vault.delete(file);
  }

  /**
   * Check if file exists in vault
   */
  fileExists(filePath: string): boolean {
    const file = this.vault.getAbstractFileByPath(filePath);
    return file instanceof TFile;
  }

  /**
   * Create directory structure for a file path
   */
  async ensureDirectory(filePath: string): Promise<void> {
    const lastSlash = filePath.lastIndexOf('/');
    if (lastSlash > 0) {
      const dirPath = filePath.substring(0, lastSlash);
      const folder = this.vault.getAbstractFileByPath(dirPath);

      if (!folder) {
        await this.vault.createFolder(dirPath);
      }
    }
  }

  /**
   * Get file modification time
   */
  getFileModTime(filePath: string): number {
    const file = this.vault.getAbstractFileByPath(filePath);

    if (file instanceof TFile) {
      return file.stat.mtime;
    }

    return 0;
  }

  /**
   * Update ignore patterns
   */
  setIgnorePatterns(ignorePatterns: IgnorePatterns): void {
    this.ignorePatterns = ignorePatterns;
  }
}
