# How the audio gets to you

![How the audio gets to you](02-audio-path.png)

The request is small; the audio is not.

1. The browser asks for the app. That path is short: Cloudflare → edge → `web`,
   and what comes back is HTML and JavaScript.
2. The app then asks the tracker who has the recitation. The tracker answers with
   addresses, not audio.
3. The audio arrives over BitTorrent — from the seeder, and from other listeners
   who already have the file.

So `web` never streams megabytes per second per listener. Most of the traffic
never touches the box at all, which is why one small host can serve a catalogue
that would need a CDN otherwise.

The exception is `/media`: `web` serves it from `seed_downloads` at 1 MB/s as a
last-resort HTTP fallback, for the case where BitTorrent cannot connect. It serves
the local node only, not the whole fleet.

Details: [STREAMING.md](../STREAMING.md), [INFRASTRUCTURE.md](../INFRASTRUCTURE.md) §1.
