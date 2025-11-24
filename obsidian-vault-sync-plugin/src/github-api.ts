/**
 * GitHub API wrapper for Obsidian Vault Sync plugin
 */

import { requestUrl } from 'obsidian';
import { VaultSyncSettings, GitHubTree, GitHubFile, GitHubCommit, GitHubTreeItem } from './types';
import { retryWithBackoff, encodeBase64 } from './utils';

export class GitHubAPI {
	private settings: VaultSyncSettings;
	private baseUrl: string;

	constructor(settings: VaultSyncSettings) {
		this.settings = settings;
		this.baseUrl = `https://api.github.com/repos/${settings.githubOwner}/${settings.githubRepo}`;
	}

	/**
	 * Get request headers with authentication
	 */
	private getHeaders(): Record<string, string> {
		return {
			'Authorization': `Bearer ${this.settings.githubToken}`,
			'Accept': 'application/vnd.github.v3+json',
			'Content-Type': 'application/json',
		};
	}

	/**
	 * Get the entire repository tree (all files)
	 * Handles empty repository gracefully
	 */
	async getRepoTree(): Promise<GitHubTreeItem[]> {
		return retryWithBackoff(async () => {
			try {
				// First, get the default branch's latest commit
				const branchUrl = `${this.baseUrl}/branches/${this.settings.githubBranch}`;
				const branchResponse = await requestUrl({
					url: branchUrl,
					method: 'GET',
					headers: this.getHeaders(),
				});

				const treeSHA = branchResponse.json.commit.commit.tree.sha;

				// Then get the tree recursively
				const treeUrl = `${this.baseUrl}/git/trees/${treeSHA}?recursive=1`;
				const treeResponse = await requestUrl({
					url: treeUrl,
					method: 'GET',
					headers: this.getHeaders(),
				});

				const tree: GitHubTree = treeResponse.json;

				// Filter to only include files (blobs), not directories (trees)
				return tree.tree.filter(item => item.type === 'blob');
			} catch (error: unknown) {
				// Handle empty repository (no commits yet)
				if (typeof error === 'object' && error !== null) {
					const err = error as { status?: number; message?: string };
					if (err.status === 409 || err.status === 404) {
						// Repository is empty or branch doesn't exist yet
						return [];
					}
				}
				throw error;
			}
		});
	}

	/**
	 * Get a single file's content from GitHub
	 */
	async getFile(path: string): Promise<GitHubFile> {
		return retryWithBackoff(async () => {
			const url = `${this.baseUrl}/contents/${encodeURIComponent(path)}?ref=${this.settings.githubBranch}`;
			const response = await requestUrl({
				url,
				method: 'GET',
				headers: this.getHeaders(),
			});

			return response.json;
		});
	}

	/**
	 * Create a new file on GitHub
	 */
	async createFile(path: string, content: string | ArrayBuffer, message?: string): Promise<void> {
		return retryWithBackoff(async () => {
			const url = `${this.baseUrl}/contents/${encodeURIComponent(path)}`;

			const base64Content = encodeBase64(content);

			const body = {
				message: message || `Create ${path}`,
				content: base64Content,
				branch: this.settings.githubBranch,
			};

			await requestUrl({
				url,
				method: 'PUT',
				headers: this.getHeaders(),
				body: JSON.stringify(body),
			});
		});
	}

	/**
	 * Update an existing file on GitHub
	 */
	async updateFile(path: string, content: string | ArrayBuffer, sha: string, message?: string): Promise<void> {
		return retryWithBackoff(async () => {
			const url = `${this.baseUrl}/contents/${encodeURIComponent(path)}`;

			const base64Content = encodeBase64(content);

			const body = {
				message: message || `Update ${path}`,
				content: base64Content,
				sha: sha,
				branch: this.settings.githubBranch,
			};

			await requestUrl({
				url,
				method: 'PUT',
				headers: this.getHeaders(),
				body: JSON.stringify(body),
			});
		});
	}

	/**
	 * Delete a file from GitHub
	 */
	async deleteFile(path: string, sha: string, message?: string): Promise<void> {
		return retryWithBackoff(async () => {
			const url = `${this.baseUrl}/contents/${encodeURIComponent(path)}`;

			const body = {
				message: message || `Delete ${path}`,
				sha: sha,
				branch: this.settings.githubBranch,
			};

			await requestUrl({
				url,
				method: 'DELETE',
				headers: this.getHeaders(),
				body: JSON.stringify(body),
			});
		});
	}

	/**
	 * Get the latest commit on the branch
	 */
	async getLatestCommit(): Promise<GitHubCommit> {
		return retryWithBackoff(async () => {
			const url = `${this.baseUrl}/commits/${this.settings.githubBranch}`;
			const response = await requestUrl({
				url,
				method: 'GET',
				headers: this.getHeaders(),
			});

			return response.json;
		});
	}

	/**
	 * Get repository metadata (for connection testing)
	 */
	async getRepoMetadata(): Promise<unknown> {
		return retryWithBackoff(async () => {
			const response = await requestUrl({
				url: this.baseUrl,
				method: 'GET',
				headers: this.getHeaders(),
			});

			return response.json;
		});
	}

	/**
	 * Batch create/update multiple files in a single commit
	 * More efficient than individual file operations
	 */
	async batchUpdateFiles(
		files: Array<{ path: string; content: string | ArrayBuffer }>,
		message: string
	): Promise<void> {
		return retryWithBackoff(async () => {
			// Get the current commit SHA
			const latestCommit = await this.getLatestCommit();
			const baseTreeSHA = latestCommit.tree.sha;

			// Create blobs for each file
			const blobs = await Promise.all(
				files.map(async file => {
					const base64Content = encodeBase64(file.content);
					const blobUrl = `${this.baseUrl}/git/blobs`;

					const response = await requestUrl({
						url: blobUrl,
						method: 'POST',
						headers: this.getHeaders(),
						body: JSON.stringify({
							content: base64Content,
							encoding: 'base64',
						}),
					});

					return {
						path: file.path,
						mode: '100644',
						type: 'blob',
						sha: response.json.sha,
					};
				})
			);

			// Create a new tree with all the blobs
			const treeUrl = `${this.baseUrl}/git/trees`;
			const treeResponse = await requestUrl({
				url: treeUrl,
				method: 'POST',
				headers: this.getHeaders(),
				body: JSON.stringify({
					base_tree: baseTreeSHA,
					tree: blobs,
				}),
			});

			const newTreeSHA = treeResponse.json.sha;

			// Create a new commit
			const commitUrl = `${this.baseUrl}/git/commits`;
			const commitResponse = await requestUrl({
				url: commitUrl,
				method: 'POST',
				headers: this.getHeaders(),
				body: JSON.stringify({
					message,
					tree: newTreeSHA,
					parents: [latestCommit.sha],
				}),
			});

			const newCommitSHA = commitResponse.json.sha;

			// Update the branch reference
			const refUrl = `${this.baseUrl}/git/refs/heads/${this.settings.githubBranch}`;
			await requestUrl({
				url: refUrl,
				method: 'PATCH',
				headers: this.getHeaders(),
				body: JSON.stringify({
					sha: newCommitSHA,
				}),
			});
		});
	}
}
