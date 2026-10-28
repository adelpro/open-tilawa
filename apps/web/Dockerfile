# The built-in frontend is enough; the syntax directive only costs a registry trip.
FROM node:20-alpine AS build
WORKDIR /app
COPY apps/web/package*.json ./
# WebTorrent's browser bundle is vendored in public/, so node_modules only has to
# typecheck and bundle the app. Native postinstalls would need a C++ toolchain
# here (node-datachannel ships no musl prebuild) for code that never runs.
RUN npm ci --ignore-scripts
COPY apps/web/ .

# Vite inlines `import.meta.env` at build time, so the TURN credential has to be
# present here — setting it at runtime does nothing. Left empty, the app offers
# no relay at all rather than falling back to a credential in the source.
ARG VITE_TURN_USERNAME=""
ARG VITE_TURN_PASSWORD=""
ENV VITE_TURN_USERNAME=$VITE_TURN_USERNAME
ENV VITE_TURN_PASSWORD=$VITE_TURN_PASSWORD

RUN npm run build

FROM nginx:alpine AS runner
COPY --from=build /app/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
