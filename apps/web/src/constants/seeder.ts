/**
 * The installer command, in one place.
 *
 * The console prints the same line; the two apps do not share code, so this file is
 * the web copy and `test/seeder-commands.test.ts` pins the values. `--admin-pass` is
 * deliberately absent: the script generates one and prints it once, which is the only
 * moment the operator can read it.
 */
export const INSTALL_URL =
  'https://raw.githubusercontent.com/adelpro/open-tilawa/main/deploy-node.sh';

/** The one port a seeder opens; 8085 answers admin credentials and never leaves the LAN. */
export const PEER_PORT_COMMAND = 'sudo ufw allow 6881/tcp && sudo ufw allow 6881/udp';

export const CONSOLE_SEEDERS_URL = 'https://console.tilawah.cc/console/seeders';

export function installCommand({ diskGb, uploadKbps }: { diskGb: number; uploadKbps: number }): string {
  if (!Number.isInteger(diskGb) || diskGb <= 0) throw new Error('diskGb must be a positive integer');
  if (!Number.isInteger(uploadKbps) || uploadKbps <= 0) {
    throw new Error('uploadKbps must be a positive integer');
  }
  return (
    `curl -fsSL ${INSTALL_URL} | sudo bash -s -- --type seeder ` +
    `--disk ${diskGb} --upload-kbps ${uploadKbps}`
  );
}


/**
 * What the installer prints, as an example.
 *
 * The password is masked: the script generates one and prints it once, and a page
 * that shows a real-looking secret teaches the wrong thing. The tailnet name is
 * the address the console should receive.
 */
export const INSTALLER_OUTPUT = `=== Seeder deployed ===
Admin UI:  http://192.168.1.10:8085
Health:    http://192.168.1.10:8085/health  (answering)
Username:  admin
Password:  ********

=== Add to the console ===
Name:      node-1
URL:       http://node-1.tailnet.ts.net:8085   (tailnet — survives IP changes)
LAN only:  http://192.168.1.10:8085
User:      admin
Password:  ********

Tailscale: install it on the node and on the console host, then use the MagicDNS name.`;
