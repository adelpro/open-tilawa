#!/bin/sh
set -e

cat > /tmp/turnserver.conf <<CONF
listening-port=3478
tls-listening-port=5349
listening-ip=0.0.0.0
relay-ip=0.0.0.0
realm=${TURN_REALM:-turn.quran.us.kg}
server-name=${TURN_REALM:-turn.quran.us.kg}
lt-cred-mech
user=${TURN_USERNAME:-change}:${TURN_PASSWORD:-me}
external-ip=${TURN_EXTERNAL_IP}
min-port=49160
max-port=49200
no-multicast-peers
no-cli
# Log to stdout so Docker's json-file driver rotates it. Left to its own devices
# coturn writes /var/tmp/turn_<pid>_<date>.log inside the container: 762 MB in a
# single day at `verbose`, with nothing to cap or rotate it.
log-file=stdout
simple-log
CONF

echo "Starting coturn for realm ${TURN_REALM:-turn.quran.us.kg}"
exec turnserver -c /tmp/turnserver.conf
