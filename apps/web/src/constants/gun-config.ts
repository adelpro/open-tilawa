import { getGunPeers } from './gun-peers';

export const GUNCONFIG = {
  peers: getGunPeers(),
  localStorage: false,
  radisk: false,
};
