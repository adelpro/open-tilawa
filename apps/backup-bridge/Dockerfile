FROM node:22-alpine

WORKDIR /app

# ssh2 is pure JS unless its optional native binding is present; the runtime
# needs no compiler, so keep the image small.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY src ./src
COPY package.json ./package.json

RUN addgroup -S bridge && adduser -S bridge -G bridge \
  && mkdir -p /secrets && chown -R bridge:bridge /app /secrets
USER bridge

EXPOSE 9401
CMD ["node", "--experimental-strip-types", "--no-warnings", "src/index.ts"]
