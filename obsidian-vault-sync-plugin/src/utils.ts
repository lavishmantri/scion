/**
 * Utility functions for Obsidian Vault Sync plugin
 */

/**
 * Calculate SHA-1 hash of content (Git-compatible)
 */
export async function calculateSHA(content: string | ArrayBuffer): Promise<string> {
	const encoder = new TextEncoder();
	let bytes: Uint8Array;

	if (typeof content === 'string') {
		// Git blob format: "blob <size>\0<content>"
		const blobContent = `blob ${content.length}\0${content}`;
		bytes = encoder.encode(blobContent);
	} else {
		// Binary content
		const size = content.byteLength;
		const header = `blob ${size}\0`;
		const headerBytes = encoder.encode(header);
		const contentBytes = new Uint8Array(content);
		bytes = new Uint8Array(headerBytes.length + contentBytes.length);
		bytes.set(headerBytes);
		bytes.set(contentBytes, headerBytes.length);
	}

	const hashBuffer = await crypto.subtle.digest('SHA-1', bytes);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Encode content to base64
 */
export function encodeBase64(content: string | ArrayBuffer): string {
	if (typeof content === 'string') {
		// Text content
		return btoa(unescape(encodeURIComponent(content)));
	} else {
		// Binary content
		const bytes = new Uint8Array(content);
		let binary = '';
		for (let i = 0; i < bytes.length; i++) {
			binary += String.fromCharCode(bytes[i]);
		}
		return btoa(binary);
	}
}

/**
 * Decode base64 to string
 */
export function decodeBase64(base64: string): string {
	try {
		return decodeURIComponent(escape(atob(base64)));
	} catch (e) {
		// If UTF-8 decode fails, return raw decoded string
		return atob(base64);
	}
}

/**
 * Decode base64 to ArrayBuffer (for binary files)
 */
export function decodeBase64ToArrayBuffer(base64: string): ArrayBuffer {
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes.buffer;
}

/**
 * Check if a path matches excluded patterns
 */
export function isExcluded(path: string, excludedFolders: string[]): boolean {
	const normalizedPath = path.replace(/\\/g, '/');

	for (const pattern of excludedFolders) {
		const normalizedPattern = pattern.trim().replace(/\\/g, '/');

		// Exact match
		if (normalizedPath === normalizedPattern) {
			return true;
		}

		// Folder prefix match (folder/ or folder/subfolder/file.md)
		if (normalizedPath.startsWith(normalizedPattern + '/')) {
			return true;
		}

		// Pattern match for subfolders (.obsidian matches any .obsidian folder)
		if (normalizedPath.split('/').includes(normalizedPattern)) {
			return true;
		}
	}

	return false;
}

/**
 * Sanitize path for cross-platform compatibility
 */
export function sanitizePath(path: string): string {
	// Normalize slashes to forward slashes
	let normalized = path.replace(/\\/g, '/');

	// Remove leading slash
	normalized = normalized.replace(/^\/+/, '');

	// Remove trailing slash
	normalized = normalized.replace(/\/+$/, '');

	// Replace multiple slashes with single slash
	normalized = normalized.replace(/\/+/g, '/');

	return normalized;
}

/**
 * Sleep for specified milliseconds (for exponential backoff)
 */
export function sleep(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Exponential backoff retry helper
 */
export async function retryWithBackoff<T>(
	fn: () => Promise<T>,
	maxRetries: number = 3,
	initialDelayMs: number = 1000
): Promise<T> {
	let lastError: Error | undefined;

	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		try {
			return await fn();
		} catch (error) {
			lastError = error as Error;

			// Don't retry on final attempt
			if (attempt === maxRetries) {
				break;
			}

			// Check if error is retryable (rate limit, network error)
			const shouldRetry = isRetryableError(error);
			if (!shouldRetry) {
				throw error;
			}

			// Exponential backoff: 1s, 2s, 4s, 8s...
			const delayMs = initialDelayMs * Math.pow(2, attempt);
			await sleep(delayMs);
		}
	}

	throw lastError;
}

/**
 * Check if error is retryable (rate limit, network error, etc.)
 */
function isRetryableError(error: unknown): boolean {
	if (typeof error === 'object' && error !== null) {
		const err = error as { status?: number; message?: string };

		// GitHub rate limit
		if (err.status === 429) {
			return true;
		}

		// Server errors (500-599)
		if (err.status && err.status >= 500 && err.status < 600) {
			return true;
		}

		// Network errors
		if (err.message?.includes('network') || err.message?.includes('timeout')) {
			return true;
		}
	}

	return false;
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
	const units = ['B', 'KB', 'MB', 'GB'];
	let size = bytes;
	let unitIndex = 0;

	while (size >= 1024 && unitIndex < units.length - 1) {
		size /= 1024;
		unitIndex++;
	}

	return `${size.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Check if file is binary based on extension
 */
export function isBinaryFile(path: string): boolean {
	const binaryExtensions = [
		'.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp',
		'.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
		'.zip', '.tar', '.gz', '.7z', '.rar',
		'.mp3', '.mp4', '.avi', '.mov', '.mkv',
		'.ttf', '.otf', '.woff', '.woff2',
		'.exe', '.dll', '.so', '.dylib'
	];

	const ext = path.substring(path.lastIndexOf('.')).toLowerCase();
	return binaryExtensions.includes(ext);
}

/**
 * Get current timestamp in ISO format
 */
export function getCurrentTimestamp(): string {
	return new Date().toISOString();
}

/**
 * Format timestamp for conflict file names
 */
export function formatConflictTimestamp(date: Date = new Date()): string {
	return date.toISOString()
		.replace(/[:.]/g, '-')
		.replace('T', '_')
		.substring(0, 19);
}
