/**
 * Utility functions for Vault Sync v2 plugin
 */

import { arrayBufferToString, stringToArrayBuffer } from 'obsidian';

/**
 * Calculate SHA-256 hash of content using Web Crypto API
 */
export async function calculateHash(content: ArrayBuffer | string): Promise<string> {
  let buffer: ArrayBuffer;

  if (typeof content === 'string') {
    buffer = new TextEncoder().encode(content);
  } else {
    buffer = content;
  }

  // Use SubtleCrypto for SHA-256
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);

  // Convert to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Convert ArrayBuffer to string
 */
export function arrayBufferToStr(buffer: ArrayBuffer): string {
  return arrayBufferToString(buffer);
}

/**
 * Convert string to ArrayBuffer
 */
export function strToArrayBuffer(str: string): ArrayBuffer {
  return stringToArrayBuffer(str);
}

/**
 * Extract file extension
 */
export function getFileExtension(filePath: string): string {
  const lastDot = filePath.lastIndexOf('.');
  if (lastDot === -1) return '';
  return filePath.substring(lastDot).toLowerCase();
}

/**
 * Check if file is text based on extension
 */
export function isTextFile(filePath: string): boolean {
  const textExtensions = [
    '.md', '.txt', '.json', '.yaml', '.yml', '.xml', '.html', '.css',
    '.js', '.ts', '.tsx', '.jsx', '.py', '.java', '.c', '.cpp', '.h',
    '.sh', '.bash', '.sql', '.csv', '.log', '.env', '.properties'
  ];

  const ext = getFileExtension(filePath);
  return textExtensions.includes(ext);
}

/**
 * Escape special characters in file path for regex
 */
export function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Check if file path matches pattern (simple glob)
 */
export function matchesPattern(filePath: string, pattern: string): boolean {
  // Handle simple patterns
  if (pattern === '*') return true;

  // Handle directory matching
  if (pattern.startsWith('/')) {
    // Absolute path
    const dir = pattern.substring(1);
    return filePath.startsWith(dir + '/');
  }

  // Handle wildcard patterns
  if (pattern.includes('*')) {
    if (pattern === '**') {
      // Match everything
      return true;
    }

    if (pattern.includes('**/')) {
      // Match anywhere in path
      const remaining = pattern.substring(3);
      const lastSlash = filePath.lastIndexOf('/');
      if (lastSlash >= 0) {
        return globMatch(filePath.substring(lastSlash + 1), remaining);
      }
      return globMatch(filePath, remaining);
    }

    // Simple wildcard match
    return globMatch(filePath, pattern);
  }

  // Exact match (as file or directory)
  return filePath === pattern || filePath.startsWith(pattern + '/');
}

/**
 * Simple glob pattern matching
 */
function globMatch(text: string, pattern: string): boolean {
  const regex = patternToRegex(pattern);
  return regex.test(text);
}

/**
 * Convert glob pattern to regex
 */
function patternToRegex(pattern: string): RegExp {
  let regex = '';
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i];
    if (char === '*') {
      if (pattern[i + 1] === '*') {
        regex += '.*';
        i++;
      } else {
        regex += '[^/]*';
      }
    } else if (char === '?') {
      regex += '.';
    } else if (char === '.') {
      regex += '\\.';
    } else {
      regex += char;
    }
  }
  return new RegExp(`^${regex}$`);
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Format elapsed time
 */
export function formatTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

/**
 * Deduplicate array
 */
export function deduplicate<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

/**
 * Group items by key
 */
export function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    if (!groups.has(k)) {
      groups.set(k, []);
    }
    groups.get(k)!.push(item);
  }
  return groups;
}
