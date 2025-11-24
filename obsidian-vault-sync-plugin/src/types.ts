/**
 * Type definitions for Obsidian Vault Sync plugin
 */

export interface VaultSyncSettings {
	// Sync mode
	syncMode: 'github' | 'server';

	// GitHub settings
	githubToken: string;
	githubOwner: string;
	githubRepo: string;
	githubBranch: string;

	// Local server settings
	serverUrl: string;
	serverApiKey: string;

	// Sync behavior
	autoSyncInterval: number; // minutes, 0 = disabled
	excludedFolders: string[]; // folders to exclude from sync
	conflictResolution: 'last-write-wins' | 'create-conflict-file';

	// UI settings
	enableLogging: boolean;
	showNotifications: boolean;

	// Delete synchronization settings
	syncDeletes: boolean; // Whether to sync file deletions
	useTrashForDeletes: boolean; // Move deleted files to trash instead of permanent delete

	// Force sync options
	forcePushMode: boolean; // When true, all syncs overwrite remote with local (DANGEROUS)
}

export const DEFAULT_SETTINGS: VaultSyncSettings = {
	syncMode: 'github',
	githubToken: '',
	githubOwner: '',
	githubRepo: '',
	githubBranch: 'main',
	serverUrl: '',
	serverApiKey: '',
	autoSyncInterval: 5, // 5 minutes
	excludedFolders: ['.obsidian', '.trash', '.git'],
	conflictResolution: 'last-write-wins',
	enableLogging: false,
	showNotifications: true,
	syncDeletes: true, // Enable delete sync by default
	useTrashForDeletes: true, // Use trash by default (safer)
	forcePushMode: false, // Disabled by default (SAFETY)
};

export interface FileMetadata {
	path: string;
	sha: string; // Git SHA or file hash
	size: number;
	modified: number; // timestamp
	content?: string; // Optional: file content
}

export interface SyncResult {
	success: boolean;
	filesAdded: number;
	filesModified: number;
	filesDeleted: number;
	conflicts: string[];
	errors: string[];
}

export interface QueuedOperation {
	id: string;
	type: 'create' | 'update' | 'delete';
	path: string;
	content?: string;
	sha?: string;
	timestamp: number;
	retries: number;
}

export enum SyncStatus {
	Idle = 'idle',
	Syncing = 'syncing',
	Offline = 'offline',
	Error = 'error',
	Conflict = 'conflict',
}

export interface GitHubTreeItem {
	path: string;
	mode: string;
	type: 'blob' | 'tree';
	sha: string;
	size?: number;
	url: string;
}

export interface GitHubTree {
	sha: string;
	url: string;
	tree: GitHubTreeItem[];
	truncated: boolean;
}

export interface GitHubFile {
	name: string;
	path: string;
	sha: string;
	size: number;
	url: string;
	html_url: string;
	git_url: string;
	download_url: string;
	type: 'file' | 'dir';
	content?: string; // base64 encoded
	encoding?: string;
}

export interface GitHubCommit {
	sha: string;
	node_id: string;
	url: string;
	html_url: string;
	author: {
		name: string;
		email: string;
		date: string;
	};
	committer: {
		name: string;
		email: string;
		date: string;
	};
	message: string;
	tree: {
		sha: string;
		url: string;
	};
	parents: Array<{
		sha: string;
		url: string;
		html_url: string;
	}>;
}

export interface GitHubError {
	message: string;
	documentation_url?: string;
	status: number;
}

export interface SyncState {
	lastSyncTime: number;
	lastSyncSHA: string; // SHA of last successful commit
	fileSHAs: Record<string, string>; // path -> SHA mapping for change detection
}

export interface FileComparison {
	localOnly: string[]; // Files only in vault
	remoteOnly: GitHubTreeItem[]; // Files only on GitHub
	both: Array<{ path: string; localSHA: string; remoteSHA: string }>; // Files in both locations
}

export interface ConflictInfo {
	path: string;
	localContent: string | ArrayBuffer;
	remoteContent: string | ArrayBuffer;
	localModified: number;
	remoteModified: number;
	resolution: 'keep-local' | 'keep-remote' | 'create-conflict-file';
}
