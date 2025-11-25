/**
 * .nosync pattern support (gitignore-style)
 */

import { Vault, TFile } from 'obsidian';
import { matchesPattern } from './utils';

export class IgnorePatterns {
  private patterns: string[] = [];
  private negatePatterns: string[] = [];

  constructor(patterns: string[] = []) {
    this.parsePatterns(patterns);
  }

  /**
   * Parse pattern list and separate regular patterns from negation patterns
   */
  private parsePatterns(patterns: string[]) {
    this.patterns = [];
    this.negatePatterns = [];

    for (let pattern of patterns) {
      // Skip empty lines and comments
      if (!pattern || pattern.startsWith('#')) continue;

      // Trim whitespace
      pattern = pattern.trim();

      // Handle negation patterns
      if (pattern.startsWith('!')) {
        this.negatePatterns.push(pattern.substring(1));
      } else {
        this.patterns.push(pattern);
      }
    }
  }

  /**
   * Check if a file path should be ignored
   */
  shouldIgnore(filePath: string): boolean {
    // First check if explicitly included (negation pattern)
    for (const pattern of this.negatePatterns) {
      if (matchesPattern(filePath, pattern)) {
        return false;
      }
    }

    // Then check if should be ignored (regular pattern)
    for (const pattern of this.patterns) {
      if (matchesPattern(filePath, pattern)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Load patterns from .nosync file in vault
   */
  static async fromFile(vault: Vault, nosyncPath: string): Promise<IgnorePatterns> {
    try {
      const file = vault.getAbstractFileByPath(nosyncPath);

      if (file && file instanceof TFile) {
        const content = await vault.cachedRead(file);
        const lines = content.split('\n');
        return new IgnorePatterns(lines);
      }
    } catch (err) {
      console.error('Error reading .nosync file:', err);
    }

    // If file doesn't exist or error, use defaults
    return new IgnorePatterns(IgnorePatterns.getDefaultPatterns());
  }

  /**
   * Get default patterns (common exclusions)
   */
  static getDefaultPatterns(): string[] {
    return [
      // Obsidian settings
      '.obsidian/workspace*.json',
      '.obsidian/cache/',
      '.obsidian/appearance.json',
      '.obsidian/app.json',

      // Vault trash
      '.trash/',

      // Git
      '.git/',
      '.gitignore',

      // Temporary files
      '*.tmp',
      '*.temp',
      '*.swp',
      '.DS_Store',
      'Thumbs.db'
    ];
  }

  /**
   * Add pattern
   */
  addPattern(pattern: string) {
    if (pattern.startsWith('!')) {
      this.negatePatterns.push(pattern.substring(1));
    } else {
      this.patterns.push(pattern);
    }
  }

  /**
   * Get all patterns
   */
  getPatterns(): string[] {
    return [
      ...this.patterns,
      ...this.negatePatterns.map(p => '!' + p)
    ];
  }

  /**
   * Create from default patterns
   */
  static createDefault(): IgnorePatterns {
    return new IgnorePatterns(IgnorePatterns.getDefaultPatterns());
  }
}
