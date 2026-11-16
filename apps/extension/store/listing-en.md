# Tilawah Companion — store listing (English)

**Name:** Tilawah Companion
**Short description (132 max):** Holds the recitations you choose and shares them with Tilawa listeners while your browser runs.

## Long description

Tilawah Companion keeps a copy of the Qur'an recitations you choose on your own computer, and
shares them with people listening at tilawah.cc.

Tilawa streams every recitation from one server and from other listeners' browsers. A browser can
only swap pieces with another browser, so listeners are the only peers that can help each other.
This extension is one of those peers: it holds a recitation you picked, stays connected while your
browser is open, and hands pieces to anyone listening to the same reciter.

**What it asks of you, and what it never asks.** Disk space and a share of your upload, both capped
by you: how many reciters to keep (two by default), the upload rate (1 Mbps by default), and the
hours it may run. Nothing is chosen for you — the roster is shown, nothing is pre-ticked, and a new
reciter is a notification, not a download.

**What it does not do.** No account. No persistent identifier. No analytics. It does not read your
pages, your tabs, or your history; it has no content script and no permission to do so. Like every
torrent client it joins with a random per-session protocol peer id, which names nobody and changes
each run, and the torrent's announce list includes public trackers beside Tilawa's. Removing a reciter
deletes its copy from your disk. Uninstalling deletes everything.

The recitations are freely distributed recordings. The extension grants no rights over them and
claims none.

Privacy policy: https://adelpro.us.kg/open-tilawa/privacy.html
Terms: https://adelpro.us.kg/open-tilawa/terms.html

## Single purpose statement (for review)

To hold recitations the user selects and seed them to Tilawa listeners over WebRTC.

## Permission justifications

| Permission | Why |
| --- | --- |
| `storage` | Keeps the user's settings and the list of reciters they chose. |
| `unlimitedStorage` | One recitation is 0.1–2.6 GB; a website's storage allowance cannot hold it. |
| `alarms` | One daily check of the public reciter list, and a wake-up for the seed engine. |
| `notifications` | Tells the user when the catalogue publishes a new reciter, if they opted in. |
| `offscreen` (Chrome) | Hosts the WebRTC seed engine in a hidden document so sharing continues after the service worker is evicted. Justification string: "Keeps a WebRTC seed alive for the Tilawa Qur'an corpus while the extension is running." |
| `host_permissions` `https://console.tilawah.cc/*` | Reads the public reciter list. |
| `host_permissions` `https://tilawah.cc/*` | Fetches the selected reciter's `.torrent` file and its audio from the site's published web seed. |

Three holding modes, a disk limit you set, and a meter showing what's held.

No content scripts. No `tabs`, no `history`, no `<all_urls>`, no remote code — the WebTorrent bundle
is shipped inside the extension.
