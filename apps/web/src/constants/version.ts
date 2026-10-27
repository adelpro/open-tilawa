import pkg from '../../package.json';

/**
 * The release's version, read from `package.json` — one string to bump, and the
 * top bar, the about page and any identifying header always agree with it.
 */
export const APP_VERSION: string = pkg.version;
