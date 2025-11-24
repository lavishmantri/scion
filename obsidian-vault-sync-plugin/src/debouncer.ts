/**
 * Debouncer for batching file changes
 * Prevents rapid-fire sync operations by batching changes within a time window
 */

export class Debouncer<T> {
	private timeout: NodeJS.Timeout | null = null;
	private pendingItems: Set<T> = new Set();
	private callback: (items: Set<T>) => void;
	private delayMs: number;
	private isProcessing: boolean = false;

	constructor(callback: (items: Set<T>) => void, delayMs: number = 2000) {
		this.callback = callback;
		this.delayMs = delayMs;
	}

	/**
	 * Add an item to the debounce queue
	 */
	add(item: T): void {
		// Don't queue new items while processing
		if (this.isProcessing) {
			return;
		}

		this.pendingItems.add(item);

		// Clear existing timeout
		if (this.timeout) {
			clearTimeout(this.timeout);
		}

		// Set new timeout
		this.timeout = setTimeout(() => {
			this.flush();
		}, this.delayMs);
	}

	/**
	 * Immediately flush all pending items
	 */
	async flush(): Promise<void> {
		if (this.pendingItems.size === 0 || this.isProcessing) {
			return;
		}

		// Clear timeout
		if (this.timeout) {
			clearTimeout(this.timeout);
			this.timeout = null;
		}

		// Mark as processing
		this.isProcessing = true;

		// Get items and clear the queue
		const itemsToProcess = new Set(this.pendingItems);
		this.pendingItems.clear();

		// Process items
		try {
			await this.callback(itemsToProcess);
		} finally {
			this.isProcessing = false;
		}
	}

	/**
	 * Cancel pending flush
	 */
	cancel(): void {
		if (this.timeout) {
			clearTimeout(this.timeout);
			this.timeout = null;
		}
		this.pendingItems.clear();
	}

	/**
	 * Get number of pending items
	 */
	getPendingCount(): number {
		return this.pendingItems.size;
	}

	/**
	 * Check if currently processing
	 */
	isActive(): boolean {
		return this.isProcessing;
	}
}
