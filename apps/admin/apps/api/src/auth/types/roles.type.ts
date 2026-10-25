/**
 * The role vocabulary lives in `@tilawa-admin/core` so the store, the guards and the
 * admin CLI cannot drift apart. Re-exported here to keep the ported imports
 * (`./types/roles.type`) working.
 */
export { ROLE_RANK, type Role } from '@tilawa-admin/core';
