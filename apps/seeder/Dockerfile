FROM node:22-slim

LABEL maintainer="Adelpro <contact@tilawah.cc>"
LABEL name="open-tilawa-seeder"
LABEL version="1.5.2"

# Stamped into /health so the console can tell a node's release from its image.
ARG BUILD_SHA=dev
ENV BUILD_SHA=${BUILD_SHA}

WORKDIR /app

COPY apps/seeder/package*.json ./
COPY apps/seeder/yarn.lock* ./

RUN if [ -f yarn.lock ]; then yarn install --production --frozen-lockfile || yarn install --production; else npm ci --omit=dev || npm install --omit=dev; fi

COPY apps/seeder/ .

# A node can update itself when its deployment says so (SEEDER_SELF_UPDATE=1):
# it pulls the published image and recreates one service through the host's
# daemon. The two static binaries are copied rather than installed so the image
# stays Debian-based and needs no package repository. buildx is left out: the
# node only ever runs `compose pull` and `compose up`.
COPY --from=docker:27-cli /usr/local/bin/docker /usr/local/bin/docker
COPY --from=docker:27-cli /usr/local/libexec/docker/cli-plugins/docker-compose /usr/local/libexec/docker/cli-plugins/docker-compose

EXPOSE 6881 6881/udp 8085

CMD ["node", "seed-all.mjs"]
