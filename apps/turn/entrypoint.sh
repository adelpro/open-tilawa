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
verbose
CONF

echo "Starting coturn for realm ${TURN_REALM:-turn.quran.us.kg}"
exec turnserver -c /tmp/turnserver.conf
