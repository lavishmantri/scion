/**
 * Per-vault mutex to serialize write operations.
 * Prevents two concurrent pushes from interleaving git operations.
 */
import { vaultLogger } from './logger.js';

export class VaultLock {
  private locks = new Map<string, Promise<void>>();

  async acquire(vaultName: string): Promise<() => void> {
    const log = vaultLogger(vaultName, 'lock');
    const waitStart = performance.now();

    const current = this.locks.get(vaultName) ?? Promise.resolve();
    let release: () => void;
    const next = new Promise<void>(resolve => {
      release = resolve;
    });
    this.locks.set(vaultName, current.then(() => next));
    await current;

    const waitMs = Math.round(performance.now() - waitStart);
    if (waitMs > 5) {
      log.info({ waitMs }, 'lock acquired after wait');
    } else {
      log.debug({ waitMs }, 'lock acquired');
    }

    const holdStart = performance.now();
    return () => {
      const holdMs = Math.round(performance.now() - holdStart);
      log.debug({ holdMs }, 'lock released');
      release();
    };
  }
}

export const vaultLock = new VaultLock();
