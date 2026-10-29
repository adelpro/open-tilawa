#!/bin/sh
set -e

cat > /tmp/turnserver.conf <<CONF
listening-port=3478
# No TURN-over-TLS. tls-listening-port=5349 was configured without cert/pkey, so
# coturn refused to bind it and printed an ERROR on every boot — while the
# hostname that pointed at it (turn-tls.quran.us.kg) went through the Cloudflare
# proxy, which cannot carry a raw TCP tunnel anyway. If TLS is ever wanted: set
# cert= and pkey=, listen on 443 (not 5349, which firewalls block), and give it a
# grey-clouded A record — never a proxied one.
no-tls
listening-ip=0.0.0.0
relay-ip=0.0.0.0
realm=${TURN_REALM:-turn.tilawah.cc}
server-name=${TURN_REALM:-turn.tilawah.cc}
lt-cred-mech
user=${TURN_USERNAME:-change}:${TURN_PASSWORD:-me}
external-ip=${TURN_EXTERNAL_IP}
min-port=49160
max-port=49200
no-multicast-peers
cli=no
# Log to stdout so Docker's json-file driver rotates it. Left to its own devices
# coturn writes /var/tmp/turn_<pid>_<date>.log inside the container: 762 MB in a
# single day at `verbose`, with nothing to cap or rotate it.
log-file=stdout
simple-log
CONF

echo "Starting coturn for realm ${TURN_REALM:-turn.tilawah.cc}"
exec turnserver -c /tmp/turnserver.conf
