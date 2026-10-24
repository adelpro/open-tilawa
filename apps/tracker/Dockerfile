# Use a Node.js base image
FROM node:18-alpine

LABEL maintainer="Adelpro <adelpro@gmail.com>"
LABEL name="open-quran-tracker"
LABEL version="1.1"

# Set the working directory
WORKDIR /app

# Install webtorrent-tracker globally
RUN npm install -g bittorrent-tracker

# Expose the port for the WebTorrent tracker (if necessary)
EXPOSE 8083

# Command to run the tracker
CMD ["bittorrent-tracker", "--http", "--ws", "--port", "8083", "--host", "0.0.0.0", "--stats"]
