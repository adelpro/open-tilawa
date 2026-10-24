FROM node:22-slim

LABEL maintainer="Adelpro <adelpro@gmail.com>"
LABEL name="open-quran-seeder"
LABEL version="1.2"

WORKDIR /app

COPY apps/seeder/package*.json ./
COPY apps/seeder/yarn.lock* ./

RUN if [ -f yarn.lock ]; then yarn install --production --frozen-lockfile || yarn install --production; else npm ci --omit=dev || npm install --omit=dev; fi

COPY apps/seeder/ .

EXPOSE 6881 6881/udp

CMD ["node", "seed.mjs"]
