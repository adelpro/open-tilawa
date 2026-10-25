#!/usr/bin/env bash
# Start seeder + admin UI
node /app/admin/server.mjs &
ADMIN_PID=$!
node /app/seed-all.mjs &
SEEDER_PID=$!
# Wait for either to exit
wait -n $ADMIN_PID $SEEDER_PID
# If one exits, kill the other
kill $ADMIN_PID $SEEDER_PID 2>/dev/null
