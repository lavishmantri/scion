/**
 * REST API client for Vault Sync Server
 */

import { requestUrl, arrayBufferToString, stringToArrayBuffer } from 'obsidian';
import { FileInfo, ServerResponse } from './types';

export class ServerAPI {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = apiKey;
  }

  /**
   * Set API key
   */
  setApiKey(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Get common headers for requests
   */
  private getHeaders() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/octet-stream'
    };
  }

  /**
   * Make HTTP request
   */
  private async request(method: string, url: string, body?: ArrayBuffer | string): Promise<any> {
    const options: any = {
      method,
      headers: this.getHeaders()
    };

    if (body) {
      if (typeof body === 'string') {
        options.body = stringToArrayBuffer(body);
      } else {
        options.body = body;
      }
    }

    try {
      const response = await requestUrl({ url, ...options });
      return response;
    } catch (error: any) {
      throw new Error(`API request failed: ${error.message}`);
    }
  }

  /**
   * Test connection to server
   */
  async testConnection(): Promise<boolean> {
    try {
      const url = `${this.baseUrl}/health`;
      const response = await requestUrl({ url, method: 'GET' });
      return response.status === 200;
    } catch (err) {
      return false;
    }
  }

  /**
   * List all files on server
   */
  async listFiles(): Promise<FileInfo[]> {
    try {
      const url = `${this.baseUrl}/api/files`;
      const response = await requestUrl({
        url,
        method: 'GET',
        headers: this.getHeaders()
      });

      if (response.status !== 200) {
        throw new Error(`HTTP ${response.status}`);
      }

      const text = arrayBufferToString(response.arrayBuffer);
      const data = JSON.parse(text);
      return data.files || [];
    } catch (err: any) {
      throw new Error(`Failed to list files: ${err.message}`);
    }
  }

  /**
   * Download a file from server
   */
  async downloadFile(filePath: string): Promise<ArrayBuffer> {
    try {
      const encodedPath = encodeURIComponent(filePath).split('%2F').join('/');
      const url = `${this.baseUrl}/api/files/${encodedPath}`;

      const response = await requestUrl({
        url,
        method: 'GET',
        headers: this.getHeaders()
      });

      if (response.status === 404) {
        throw new Error('File not found on server');
      }

      if (response.status !== 200) {
        throw new Error(`HTTP ${response.status}`);
      }

      return response.arrayBuffer;
    } catch (err: any) {
      throw new Error(`Failed to download ${filePath}: ${err.message}`);
    }
  }

  /**
   * Upload a file to server
   */
  async uploadFile(filePath: string, content: ArrayBuffer): Promise<string> {
    try {
      const encodedPath = encodeURIComponent(filePath).split('%2F').join('/');
      const url = `${this.baseUrl}/api/files/${encodedPath}`;

      const response = await requestUrl({
        url,
        method: 'POST',
        headers: this.getHeaders(),
        body: content
      });

      if (response.status !== 200) {
        const text = arrayBufferToString(response.arrayBuffer);
        const data = JSON.parse(text);
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      const text = arrayBufferToString(response.arrayBuffer);
      const data = JSON.parse(text);
      return data.hash;
    } catch (err: any) {
      throw new Error(`Failed to upload ${filePath}: ${err.message}`);
    }
  }

  /**
   * Delete a file from server
   */
  async deleteFile(filePath: string): Promise<void> {
    try {
      const encodedPath = encodeURIComponent(filePath).split('%2F').join('/');
      const url = `${this.baseUrl}/api/files/${encodedPath}`;

      const response = await requestUrl({
        url,
        method: 'DELETE',
        headers: this.getHeaders()
      });

      if (response.status === 404) {
        throw new Error('File not found on server');
      }

      if (response.status !== 200) {
        const text = arrayBufferToString(response.arrayBuffer);
        const data = JSON.parse(text);
        throw new Error(data.error || `HTTP ${response.status}`);
      }
    } catch (err: any) {
      throw new Error(`Failed to delete ${filePath}: ${err.message}`);
    }
  }

  /**
   * Batch upload files
   */
  async batchUpload(files: Map<string, ArrayBuffer>): Promise<Map<string, string>> {
    const hashes = new Map<string, string>();

    // Upload files sequentially to avoid overwhelming server
    for (const [filePath, content] of files) {
      const hash = await this.uploadFile(filePath, content);
      hashes.set(filePath, hash);
    }

    return hashes;
  }

  /**
   * Batch delete files
   */
  async batchDelete(filePaths: string[]): Promise<void> {
    // Delete files sequentially
    for (const filePath of filePaths) {
      await this.deleteFile(filePath);
    }
  }
}
