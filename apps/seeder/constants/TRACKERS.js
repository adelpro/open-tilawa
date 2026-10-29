/**
 * Node announce list. Our own tracker is reached through the public origin, not
 * the compose hostname: the same list is written into the `.torrent` files the
 * browser downloads, and `tracker:8083` does not resolve there.
 *
 * The rest are public WebSocket trackers that still answer, plus three UDP
 * trackers for TCP peers. The long list of dead ones (coppersurfer, mg64,
 * zer0day, empire-js, …) is gone: they only produced timeout noise.
 */
const TRACKERS = [
  'wss://tracker.tilawah.cc',
  'wss://tracker.webtorrent.dev:443/announce',
  'wss://tracker.files.fm:7073/announce',
  'wss://tracker.openwebtorrent.com:443/announce',
  'udp://tracker.opentrackr.org:1337',
  'udp://tracker.torrent.eu.org:451',
  'udp://open.stealth.si:80',
];

export default TRACKERS;
