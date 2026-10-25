# Uslub API — Nest app serving /api and /health.
# Python is present because profile generation runs the vendored gate engine (T3.4).

# --- build ---
FROM node:22-alpine AS build
WORKDIR /app
RUN apk add --no-cache python3 make g++
RUN corepack enable
COPY package.json yarn.lock .yarnrc.yml ./
COPY apps/api/package.json ./apps/api/package.json
COPY libs/core/package.json ./libs/core/package.json
RUN yarn install
COPY tsconfig.base.json ./
COPY libs/core ./libs/core
COPY apps/api ./apps/api
# A stale *.tsbuildinfo shipped in the context makes tsc emit a PARTIAL dist
# (only the files it thinks changed), which then fails to resolve. .dockerignore
# excludes them; this is the belt to that braces.
RUN rm -f libs/core/*.tsbuildinfo apps/api/*.tsbuildinfo
# The api imports @tilawa-admin/core, so the shared library is built first — at runtime
# the workspace dependency resolves to libs/core/dist, migrations included.
RUN yarn workspace @tilawa-admin/core build && yarn workspace @tilawa-admin/api build

# --- runtime ---
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
RUN apk add --no-cache python3
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/libs/core/package.json ./libs/core/package.json
COPY --from=build /app/libs/core/dist ./libs/core/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY vendor ./vendor
USER node
EXPOSE 9310
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||9310)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/api/dist/main.js"]
