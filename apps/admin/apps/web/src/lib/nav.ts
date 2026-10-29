import type { IconName } from '../components/icons';
import type { MessageKey } from './i18n';

/** The console's role vocabulary, mirrored from the session payload. */
export type AppRole = 'user' | 'admin' | 'super_admin';

export interface NavEntry {
  to: string;
  labelKey: MessageKey;
  icon: IconName;
  group: 'workspace' | 'admin';
}

/**
 * One navigation for every role.
 *
 * A super admin gets the super-admin console, an admin gets the lighter admin
 * console, and neither gets both. The duplication that used to render "Admin" and
 * "Super admin" side by side for the same person is a property of the list now,
 * not of four conditionals inside the shell.
 */
export function navItemsFor(role: AppRole | null): NavEntry[] {
  const items: NavEntry[] = [
    { to: '/console/seeders', labelKey: 'nav.seeders', icon: 'monitor', group: 'workspace' },
    { to: '/console/turns', labelKey: 'nav.turns', icon: 'globe', group: 'workspace' },
    { to: '/console/reciters', labelKey: 'nav.reciters', icon: 'user', group: 'workspace' },
    { to: '/console/status', labelKey: 'nav.status', icon: 'pulse', group: 'workspace' },
    { to: '/console/tools', labelKey: 'nav.tools', icon: 'key', group: 'workspace' },
    { to: '/console/account', labelKey: 'nav.account', icon: 'settings', group: 'workspace' },
    { to: '/help', labelKey: 'nav.help', icon: 'info', group: 'workspace' },
  ];

  if (role === 'admin') {
    items.push({
      to: '/console/admin',
      labelKey: 'nav.admin',
      icon: 'shield',
      group: 'admin',
    });
  } else if (role === 'super_admin') {
    items.push({
      to: '/console/superadmin',
      labelKey: 'nav.superadmin',
      icon: 'shield',
      group: 'admin',
    });
  }

  return items;
}

/** The console URL for a role, or null when the role has no console. */
export function consolePathFor(role: AppRole): string | null {
  if (role === 'admin') return '/console/admin';
  if (role === 'super_admin') return '/console/superadmin';
  return null;
}
