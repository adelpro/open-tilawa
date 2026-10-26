# Tilawa Admin web — Vite build, served by nginx.

FROM node:22-alpine AS build
WORKDIR /app
RUN apk add --no-cache python3 make g++
RUN corepack enable
COPY package.json yarn.lock .yarnrc.yml ./
COPY apps/web/package.json ./apps/web/package.json
COPY libs/core/package.json ./libs/core/package.json
RUN yarn install
COPY tsconfig.base.json ./
COPY libs/core ./libs/core
COPY apps/web ./apps/web
RUN yarn workspace @tilawa-admin/core build && yarn workspace @tilawa-admin/web build

FROM nginx:alpine
# The nginx image's entrypoint renders /etc/nginx/templates/*.template through
# envsubst into conf.d. Without this copy the container ran the stock config:
# every SPA deep link (/dashboard/turns/1, a reload, a bookmark) answered 404,
# and the CSP/referrer headers the template declares were never sent.
COPY apps/web/templates/default.conf.template /etc/nginx/templates/default.conf.template
ENV PORT=80
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
