# Tilawah Desktop Seeder

The first slice of the Electron desktop seeder: **port checks and an opt-in UPnP
mapping**. It does not seed torrents yet; the next slice embeds the existing
`apps/seeder` service (WebTorrent + the console admin contract).

## Run

```bash
cd apps/desktop-seeder
npm install
npm start
```

## What it does

- Checks whether **6881 TCP**, **6881 UDP** and **8085 TCP** can be bound locally.
- Has one checkbox, **off by default**: “Try to open port 6881 automatically
  (UPnP)”.
- When enabled, asks the router to map **6881 TCP and UDP** with `nat-upnp`.
  It never maps 8085. On disable or quit it removes the mapping.
- If the router has no UPnP IGD, it reports the failure and leaves the manual
  forward instruction in place.

## Deliberately not here

- No auto-start with Windows yet; use `app.setLoginItemSettings` in the next
  slice, opt-in.
- No QR code: the user and the administrator are different people. The desktop
  app will offer a copyable connection card instead.
- No seeder engine, tray, installer, code signing or auto-update yet.
