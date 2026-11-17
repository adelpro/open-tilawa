import { defineConfig } from 'wxt';

/**
 * A pinned identity for unpacked development builds.
 *
 * An unpacked extension's ID is derived from its folder path, so the site —
 * which can only target known IDs — cannot reach a debug build; that is how
 * the follow channel looked dead while it worked. Building with
 * `TILAWAH_DEV_KEY=1` embeds this public key and Chrome derives the same ID
 * (`opbhejfgfikjgnckojangiodobblkjfi`) on every machine.
 *
 * It must NEVER reach a store package: the Web Store may reject a manifest
 * that carries its own key, and a store build's ID comes from the account.
 */
const DEV_KEY =
  process.env.TILAWAH_DEV_KEY === '1'
    ? 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAq6cJ8TXiI9bq1JygT7bf7UKN6DWS9QM7XxcEfunQD/ToijOH1iIGMzo7a2IP/jZ2qWWcTWTekXg+n3rkSYoVOqrB2yRWPy0vxCdT6g/oX1bmpNsX0+aq+ZP2LNLnHUhs0uYb4ARoNFIfqgwTiImN5TIRQeUNBMQaCeajKAjareG6aq8rGy3gZgOj0Ku0abJeqFydP7osnuaWlesmmw8oLYmDk+3mevC4ifLXRhVk1UQfrczD8MygWOJGsZgrPGkVyyqpYJ2/jkW4hwVf6uquZLuVGgeh77+GikdkLY53SZTdDtS2lyCTxxf7bEM5ogsLJhUA3FsadIY2/Rtnn9cdEwIDAQAB'
    : undefined;

// The permission set is a product decision, not an implementation detail: the
// extension must never read pages, tabs, or history. `scripts/audit-manifest.mjs`
// fails the build when this list and the built manifest disagree, so adding a
// permission here means changing the audit in the same commit.
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  // `srcDir` is what makes `@/lib/...` mean `src/lib/...`, matching the site's
  // own alias. Entrypoints move with it (`src/entrypoints/**`).
  srcDir: 'src',
  publicDir: 'public',
  manifest: ({ browser, manifestVersion }) => ({
    name: '__MSG_extName__',
    description: '__MSG_extDescription__',
    short_name: 'Tilawah',
    // Manifest versions are integers only; the RC label is for humans and stores.
    version_name: '0.2.4',
    ...(DEV_KEY && browser === 'chrome' ? { key: DEV_KEY } : {}),
    default_locale: 'en',
    permissions: [
      'storage',
      'unlimitedStorage',
      'alarms',
      'notifications',
      // Chrome MV3 hosts the seed engine in an offscreen document; Firefox MV2
      // has a persistent background page and no offscreen API at all.
      ...(manifestVersion === 3 ? ['offscreen' as const] : []),
    ],
    host_permissions: ['https://console.tilawah.cc/*', 'https://tilawah.cc/*'],
    // The site may tell the companion which reciter is playing — one message,
    // no page access, no reply that carries anything. This is not a permission:
    // it grants tilawah.cc the right to *send*, and the background accepts
    // exactly one message shape (`tilawah:play` + a 40-hex infohash). Staging
    // is listed so the follow flow can be proved before it ships.
    externally_connectable: {
      matches: ['https://tilawah.cc/*', 'https://staging.tilawah.cc/*'],
    },
    // The picker is twelve rows tall; a 400px embedded panel is not a place to
    // choose what to keep for years.
    options_ui: { page: 'options.html', open_in_tab: true },
    // Firefox 140+ requires an explicit data-collection declaration. The
    // extension collects nothing, so `none` is the honest answer — and it is
    // the value AMO validates for a listing to be publishable.
    ...(browser === 'firefox'
      ? {
          browser_specific_settings: {
            gecko: {
              id: 'tilawah-companion@tilawah.cc',
              data_collection_permissions: { required: ['none'], optional: [] },
            },
          },
        }
      : {}),
    action: { default_title: 'Tilawah Companion' },
  }),
});
