import { MagnetlinkSource, Reciter } from "@/types";
import badrAlturkiPlaylist from "./itqan-badr-alturki.json";
import majidAlzamilPlaylist from "./itqan-majid-alzamil.json";

const RAW_RECITERS: Reciter[] = [
  {
    id: 1,
    name: "سعد الغامدي",
    magnet: `magnet:?xt=urn:btih:5e0becf35d91ea4602f04db90d74621a172aa396&dn=Saad_Alghamdi&tr=wss://tracker.btorrent.xyz&tr=wss://tracker.openwebtorrent.com&tr=wss://trackerf.quran.us.kg&xs=https://tilawa.quran.us.kg/torrents/5e0becf35d91ea4602f04db90d74621a172aa396.torrent`,
    complet: true,
    source: MagnetlinkSource.MP3QURAN,
  },
  {
    id: 3,
    name: "محمود خليل الحصري",
    magnet:
      "magnet:?xt=urn:btih:87c83e0b4432d70565e2dbc4e20988285778e189&dn=Mahmoud_Khalil_Al-Hussary_%28warsh%29&tr=wss://tracker.btorrent.xyz&tr=wss://tracker.openwebtorrent.com&tr=wss://tracker.quran.us.kg&tr=wss://trackerf.quran.us.kg&xs=https://tilawa.quran.us.kg/torrents/87c83e0b4432d70565e2dbc4e20988285778e189.torrent",
    complet: true,
    source: MagnetlinkSource.MP3QURAN,
  },
  {
    id: 5,
    name: "ماهر المعيقلي",
    magnet:
      "magnet:?xt=urn:btih:465aa4a5cc2dafe86cd616f1dc9e94b1dce36496&dn=Maher_Al-Muaiqly&tr=https://torrent.islamhouse.com/announce&tr=wss://tracker.btorrent.xyz&tr=wss://tracker.openwebtorrent.com&tr=wss://tracker.quran.us.kg&tr=wss://trackerf.quran.us.kg&xs=https://tilawa.quran.us.kg/torrents/465aa4a5cc2dafe86cd616f1dc9e94b1dce36496.torrent",
    complet: true,
    source: MagnetlinkSource.ISLAMHOUSE,
  },
  {
    id: 6,
    name: "عبد الباسط عبد الصمد",
    magnet:
      "magnet:?xt=urn:btih:110eedff1111d5028bfb853dd13ca903cffd4d10&dn=Abdulbasit_Abdussamad_Warsh_an_Nafi&tr=wss://tracker.btorrent.xyz&tr=wss://tracker.openwebtorrent.com&tr=wss://tracker.quran.us.kg&tr=wss://trackerf.quran.us.kg&xs=https://tilawa.quran.us.kg/torrents/110eedff1111d5028bfb853dd13ca903cffd4d10.torrent",
    complet: true,
    source: MagnetlinkSource.MP3QURAN,
  },
  {
    id: 8,
    name: "ياسين الجزائري",
    magnet:
      "magnet:?xt=urn:btih:012101c66ee42d7c5905ab910e2b129335f4f30d&dn=Yassine_El_Jazairi_Warsh&tr=https://torrent.islamhouse.com/announce&tr=wss://tracker.btorrent.xyz&tr=wss://tracker.openwebtorrent.com&tr=wss://tracker.quran.us.kg&tr=wss://trackerf.quran.us.kg&xs=https://tilawa.quran.us.kg/torrents/012101c66ee42d7c5905ab910e2b129335f4f30d.torrent",
    complet: true,
    source: MagnetlinkSource.ISLAMHOUSE,
  },
  {
    id: 9,
    name: "محمد الكنتاوي",
    magnet:
      "magnet:?xt=urn:btih:bb7093b290ac61d10b5a6357087cd670bb6ba931&dn=Mohammed_El_Kantaoui_Warsh&tr=wss%3A%2F%2Ftracker.btorrent.xyz&tr=wss%3A%2F%2Ftracker.openwebtorrent.com&tr=wss://tracker.quran.us.kg&tr=wss://trackerf.quran.us.kg&xs=https://tilawa.quran.us.kg/torrents/bb7093b290ac61d10b5a6357087cd670bb6ba931.torrent",
    complet: true,
    source: MagnetlinkSource.ISLAMHOUSE,
  },
  {
    id: 10,
    name: "محمود خليل الحصري",
    magnet:
      "magnet:?xt=urn:btih:c4ac5dece90004fb389a2fc378847dab54d9f1d3&dn=ar_Alhosari_Qalon&tr=https%3A%2F%2Ftorrent.islamhouse.com%2Fannounce.php&tr=wss%3A%2F%2Ftracker.btorrent.xyz&tr=wss%3A%2F%2Ftracker.openwebtorrent.com&tr=wss://tracker.quran.us.kg&tr=wss://trackerf.quran.us.kg&xs=https://tilawa.quran.us.kg/torrents/c4ac5dece90004fb389a2fc378847dab54d9f1d3.torrent",
    complet: true,
    source: MagnetlinkSource.ISLAMHOUSE,
  },
  {
    id: 11,
    name: "بدر التركي",
    magnet: "",
    complet: false,
    source: MagnetlinkSource.ITQAN,
    itqanPlaylist: badrAlturkiPlaylist,
  },
  {
    id: 12,
    name: 'ماجد الزميل',
    magnet: '',
    complet: false,
    source: MagnetlinkSource.ITQAN,
    itqanPlaylist: majidAlzamilPlaylist,
  },
];

export const RECITERS = RAW_RECITERS;
