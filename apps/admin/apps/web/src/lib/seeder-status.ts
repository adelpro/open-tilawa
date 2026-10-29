import type { MessageKey } from './i18n';
import type { Seeder } from './types-seeders';

/**
 * One node's health, in the words and the tone the whole console uses.
 *
 * Shared rather than duplicated: the fleet card and the node's own screen must
 * not describe the same state differently — and the node screen used to print the
 * API's `online` / `offline` verbatim, in Latin script, inside the Arabic UI.
 */
export function statusTone(status: Seeder['status']): 'ok' | 'bad' | 'notice' {
  return status === 'online' ? 'ok' : status === 'offline' ? 'bad' : 'notice';
}

export function statusKey(status: Seeder['status']): MessageKey {
  return status === 'online'
    ? 'seeders.statusOnline'
    : status === 'offline'
      ? 'seeders.statusOffline'
      : 'seeders.statusUnknown';
}
