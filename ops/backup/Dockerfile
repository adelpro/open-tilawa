# The backup runner.
#
# Deliberately not derived from the admin API image: this job needs rsync and ssh, it
# must not be able to write to the database, and it should not carry a web server's
# dependencies to do a file copy. Four tools and a script.
#
# coreutils matters: Alpine's busybox `date` has no `-d`, and the retention rule
# turns a timestamp from the file name into an epoch.
FROM python:3-alpine

RUN apk add --no-cache bash bash-completion rsync openssh-client coreutils

# The script itself is bind-mounted over this path by Compose, so editing it never
# needs a rebuild. The copy is a fallback for anyone running the image directly.
COPY db-backup.sh /usr/local/bin/db-backup.sh

ENTRYPOINT ["bash", "/usr/local/bin/db-backup.sh"]
