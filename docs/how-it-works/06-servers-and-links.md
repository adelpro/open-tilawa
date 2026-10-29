# One host, or more?

![One host, or more?](06-servers-and-links.png)

The box you deploy on is not special. It runs the same seeder image as any node
you add, so adding a node is running one more copy of a container — nothing is
federated and nothing is central except the tracker.

Three links matter:

- **node → tracker** — every seeder, local or remote, announces what it holds. The
  tracker is the switchboard; peers ask it who has the file.
- **console → node** — the API talks to each node's admin port directly, with
  the credentials stored per node. This is why a remote node's admin port has to
  be reachable, and why community enrollment is still an open gap.
- **turn** runs on the host as well, but only relays listeners. It is never a
  tracker and never appears in a magnet.

A node updates itself (`docker compose pull`, or Watchtower with `--label-enable`).
Only the node running here can be updated from the console.

Details: [INFRASTRUCTURE.md](../INFRASTRUCTURE.md) §3, §4, §9.
