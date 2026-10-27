/**
 * Node announce list. `ws://tracker:8083` is the tracker in this compose stack;
 * the rest are the public WebSocket trackers that still answer, plus three UDP
 * trackers for TCP peers. The long list of dead UDP trackers (coppersurfer,
 * mg64, zer0day, empire-js, …) is gone: they only produced timeout noise.
 */
const TRACKERS = [
  'ws://tracker:8083',
  'wss://tracker.quran.us.kg',
  'wss://tracker.webtorrent.dev:443/announce',
  'wss://tracker.files.fm:7073/announce',
  'wss://tracker.openwebtorrent.com:443/announce',
  'udp://tracker.opentrackr.org:1337',
  'udp://tracker.torrent.eu.org:451',
  'udp://open.stealth.si:80',
];

export default TRACKERS;
