# The backup runner.
#
# Deliberately not derived from the admin API image: this job needs rsync and ssh, it
# must not be able to write to the database, and it should not carry a web server's
# dependencies to do a file copy. Four tools and a script.
#
# coreutils matters: Alpine's busybox `date` has no `-d`, and the retention rule
# turns a timestamp from the file name into an epoch.
FROM python:3-alpine

RUN apk add --no-cache bash rsync openssh-client coreutils

# The job runs as the host user (uid 1000) so the snapshots it writes stay readable by
# the console and by nobody else. ssh looks that uid up in passwd and refuses to run
# without a name ("No user exists for uid 1000"), so the image carries one.
RUN adduser -D -u 1000 -h /home/backup backup
ENV HOME=/home/backup

# The script itself is bind-mounted over this path by Compose, so editing it never
# needs a rebuild. The copy is a fallback for anyone running the image directly.
COPY db-backup.sh /usr/local/bin/db-backup.sh

ENTRYPOINT ["bash", "/usr/local/bin/db-backup.sh"]
