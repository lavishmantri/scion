/**
 * Singleton logger utility wrapping Fastify's Pino instance.
 * Non-route code (db.ts, metadata.ts, etc.) imports this
 * instead of console.log.
 */
import type { FastifyBaseLogger } from 'fastify';

let _logger: FastifyBaseLogger;

/** Called once from server.ts after Fastify is created */
export function setLogger(logger: FastifyBaseLogger): void {
  _logger = logger;
}

/** Get the root logger (for non-route code) */
export function getLogger(): FastifyBaseLogger {
  return _logger;
}

/**
 * Create a child logger with vault context pre-bound.
 * Usage: const log = vaultLogger('my-vault', 'push');
 *        log.info({ path: 'foo.md' }, 'file created');
 */
export function vaultLogger(vaultName: string, operation?: string): FastifyBaseLogger {
  const bindings: Record<string, string> = { vault: vaultName };
  if (operation) bindings.op = operation;
  return _logger.child(bindings);
}
