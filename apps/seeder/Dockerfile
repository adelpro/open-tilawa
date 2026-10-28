FROM node:22-slim

LABEL maintainer="Adelpro <adelpro@gmail.com>"
LABEL name="open-tilawa-seeder"
LABEL version="1.4.3"

# Stamped into /health so the dashboard can tell a node's release from its image.
ARG BUILD_SHA=dev
ENV BUILD_SHA=${BUILD_SHA}

WORKDIR /app

COPY apps/seeder/package*.json ./
COPY apps/seeder/yarn.lock* ./

RUN if [ -f yarn.lock ]; then yarn install --production --frozen-lockfile || yarn install --production; else npm ci --omit=dev || npm install --omit=dev; fi

COPY apps/seeder/ .

EXPOSE 6881 6881/udp 8085

CMD ["node", "seed-all.mjs"]
