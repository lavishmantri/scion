/**
 * Per-vault mutex to serialize write operations.
 * Prevents two concurrent pushes from interleaving git operations.
 */
export class VaultLock {
  private locks = new Map<string, Promise<void>>();

  async acquire(vaultName: string): Promise<() => void> {
    const current = this.locks.get(vaultName) ?? Promise.resolve();
    let release: () => void;
    const next = new Promise<void>(resolve => {
      release = resolve;
    });
    this.locks.set(vaultName, current.then(() => next));
    await current;
    return release!;
  }
}

export const vaultLock = new VaultLock();
