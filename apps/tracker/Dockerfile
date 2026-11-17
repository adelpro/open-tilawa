# Use a Node.js base image
FROM node:18-alpine

LABEL maintainer="Adelpro <contact@tilawah.cc>"
LABEL name="open-tilawa-tracker"
LABEL version="1.1"

# Set the working directory
WORKDIR /app

# Install webtorrent-tracker globally
RUN npm install -g bittorrent-tracker

# Expose the port for the WebTorrent tracker (if necessary)
EXPOSE 8083

# Command to run the tracker
# `--interval` is the announce cadence the tracker *tells* clients, and WebTorrent
# obeys it. Cloudflare's edge closes an idle WebSocket after ~100 s, and this
# tracker keeps a peer only while its socket is open — so the 10-minute default
# made a seeder visible for two minutes and absent for eight (measured 2026-11-17:
# 125 s idle cut through the tunnel, still open at 150 s directly). 45 s keeps the
# socket alive at a cost of a few KB per minute per client.
CMD ["bittorrent-tracker", "--http", "--ws", "--port", "8083", "--host", "0.0.0.0", "--stats", "--interval", "45000"]
