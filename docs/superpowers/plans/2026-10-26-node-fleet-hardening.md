# Node fleet hardening — plan of record (2026-10-26)

Locked scope after the brainstorm. Stage 1 is implemented; 2 and 3 are the
agreed next steps, in this order.

## Stage 1 — done (this release)

- Seeder refuses to start without a real `ADMIN_PASS`.
- Node-side disk quota (`DISK_QUOTA_GB` / `MAX_DISK_BYTES`), enforced before the
  payload moves; 507 with headroom on refusal; `/health` reports
  `quotaBytes`/`usedBytes`/`headroomBytes`.
- Bandwidth throttling (`UPLOAD_LIMIT_KBPS` / `DOWNLOAD_LIMIT_KBPS`), shown in the
  node's own admin page.
- Dashboard shows quota/headroom per node; catalogue push plans against the
  node's headroom and skips with a reason.
- `ADMIN_UI=0` switch; `deploy-node.sh` generates an `ADMIN_PASS` instead of
  shipping a placeholder.
- Tracker rename: one hostname, `tracker.quran.us.kg`; the `trackerf` alias
  is retired (410 until its DNS record is deleted). The tracker list is editable
  in the dashboard and was applied to the existing magnets.

## Stage 2 — community nodes (next)

1. Dashboard issues a one-time **node token**; the node stores its hash.
2. The node talks **outbound** to the dashboard: register → pending, heartbeat,
   poll assignments. No inbound admin port on community hardware.
3. Approval in the UI; push-only scope (list + add, no delete) for that token.
4. `ADMIN_UI=0` by default on a community node.

Acceptance: a node behind NAT registers and receives one release without any port
forward; a revoked token stops it on the next heartbeat.

## Stage 3 — trust and hygiene (after)

- Signed catalogue manifests (Ed25519) verified by nodes.
- Per-node bandwidth and storage caps assigned by the dashboard, taking the
  lower of node policy and operator policy.
- Drift reporting: compare claimed inventory with the catalogue and flag nodes
  that stop announcing.

## Out of scope

- Baking reciters or torrents into the image.
- Automatic eviction to make room (removal stays an operator decision).
- Updating remote nodes from this dashboard (they update themselves).
