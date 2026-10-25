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
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 9420
