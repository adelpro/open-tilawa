# The built-in frontend is enough; the syntax directive only costs a registry trip.
# Node 22: the build runs the prerender step through `--experimental-strip-types`,
# which 20 does not have, and the test suite already requires 22.
FROM node:22-alpine AS build
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
# The volume log lives here. A named volume inherits this directory's ownership on
# first use, and the worker (not the master) opens a path that contains variables,
# so the directory must be writable by whatever user the container runs. 1777
# because whichever container mounts the volume first must not lock the other out,
# and the lines carry no address.
RUN mkdir -p /var/log/tilawa && chmod 1777 /var/log/tilawa
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
