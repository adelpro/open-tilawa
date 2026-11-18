# Dedicated SFTP account for console backups

The console's Sources screen should not use `adelpro`'s personal key. This runbook
creates a key-only account that can only reach the snapshot folder, then moves the
host job onto it.

Nothing here installs FTP: OpenSSH already provides SFTP.

> **Current state (2026-11-18):** the host has no passwordless `sudo`, so the
> `tilawa-backup` account was not created. A dedicated restricted key was added to
> `adelpro` instead — see “No-sudo fallback” below. The console target uses
> username `adelpro`, folder `tilawa-backups`, key `~/.ssh/tilawa-console_ed25519`.
> Finish the account migration when `sudo` is available.

## 1. Create the account

```bash
sudo useradd -m -s /usr/sbin/nologin tilawa-backup
sudo mkdir -p /home/tilawa-backup/.ssh /home/tilawa-backup/tilawa-backups
sudo chmod 700 /home/tilawa-backup/.ssh
```

## 2. Create the console key

On the homeserver, generate a key that belongs to the console only:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/tilawa-backup_ed25519 -C "tilawa-console-backup" -N ""
cat ~/.ssh/tilawa-backup_ed25519.pub
```

Put the printed line into the account on pharmacyserver:

```bash
echo 'ssh-ed25519 AAAA... tilawa-console-backup' | \
  sudo tee -a /home/tilawa-backup/.ssh/authorized_keys
sudo chown -R tilawa-backup:tilawa-backup /home/tilawa-backup
sudo chmod 600 /home/tilawa-backup/.ssh/authorized_keys
```

## 3. Restrict the account

Append to `/etc/ssh/sshd_config`:

```text
Match User tilawa-backup
    PasswordAuthentication no
    KbdInteractiveAuthentication no
    PubkeyAuthentication yes
    AllowTcpForwarding no
    X11Forwarding no
    PermitTunnel no
    ForceCommand internal-sftp
```

Then:

```bash
sudo sshd -t
sudo systemctl reload ssh
```

A shell login must fail with “This service allows sftp connections only.”

## 4. Move the existing snapshots

On pharmacyserver, copy the old remote snapshots once:

```bash
sudo rsync -a /home/adelpro/tilawa-backups/ /home/tilawa-backup/tilawa-backups/
sudo chown -R tilawa-backup:tilawa-backup /home/tilawa-backup/tilawa-backups
```

The old copies stay where they are; this is a copy, not a move.

## 5. Point the host job at the new account

In `/home/adelpro/code/open-tilawa/.env`:

```text
BACKUP_REMOTE_USER=tilawa-backup
```

Then recreate and run the job:

```bash
cd /home/adelpro/code/open-tilawa
docker compose --profile ops run --rm backup
```

Confirm a new `tilawa-admin-*.sqlite` appears in
`/home/tilawa-backup/tilawa-backups/` and that `status.json` still reports `ok`.

## 6. Add it in the console

Backups → Sources → Add source:

- Label: `Pharmacyserver`
- Host: `pharmacyserver`
- Port: `22`
- Username: `tilawa-backup`
- Remote folder: `tilawa-backups`

Save the **private** key (`~/.ssh/tilawa-backup_ed25519`) in the credential form, then
press Check.

## No-sudo fallback (used on 2026-11-18)

Without `sudo`, a dedicated key can still be restricted on the existing account. It is
not a separate home, but it is key-only, shell-less and forwarding-less:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/tilawa-console_ed25519 -C "tilawa-console-backup" -N ""
LINE="command=\"internal-sftp\",restrict $(cat ~/.ssh/tilawa-console_ed25519.pub) tilawa-console"
printf '%s\n' "$LINE" | ssh pharmacyserver \
  'grep -qF "tilawa-console" ~/.ssh/authorized_keys || cat >> ~/.ssh/authorized_keys; chmod 600 ~/.ssh/authorized_keys'
```

Verify:

```bash
ssh -i ~/.ssh/tilawa-console_ed25519 adelpro@pharmacyserver true   # refused: sftp only
sftp -i ~/.ssh/tilawa-console_ed25519 adelpro@pharmacyserver        # lists tilawa-backups
```

Limitation: SFTP can still read other files under `adelpro`'s home. The console only
asks for `tilawa-backups`, but a compromised bridge could traverse. The separate
account above removes that risk.

## 7. Rollback

If the job fails, restore the previous remote user:

```text
BACKUP_REMOTE_USER=adelpro
```

Recreate the backup service and run it once. The old snapshots under
`/home/adelpro/tilawa-backups/` are untouched.

## Verification checklist

- [ ] `ssh -i ~/.ssh/tilawa-backup_ed25519 tilawa-backup@pharmacyserver` is refused as a shell.
- [ ] `sftp -i ~/.ssh/tilawa-backup_ed25519 tilawa-backup@pharmacyserver` lists `tilawa-backups`.
- [ ] A new snapshot arrives after a run.
- [ ] The console Check reports Healthy and the file count matches.
- [ ] A downloaded file's SHA-256 matches `sha256sum` on the server.
