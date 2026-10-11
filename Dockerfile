FROM node:22.23.3-bookworm-slim AS build
WORKDIR /build
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci --include=dev
COPY app ./app
COPY lib ./lib
COPY client ./client
COPY server ./server
COPY components ./components
COPY hooks ./hooks
COPY scripts/server.mjs scripts/security-headers.mjs ./scripts/
COPY next.config.mjs tsconfig.json ./
RUN node node_modules/next/dist/bin/next build && npm prune --omit=dev --ignore-scripts

FROM node:22.23.3-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOST=0.0.0.0 PORT=3214
COPY --from=build --chown=node:node /build/node_modules ./node_modules
COPY --from=build --chown=node:node /build/.next ./.next
COPY --from=build --chown=node:node /build/package.json /build/next.config.mjs ./
COPY --from=build --chown=node:node /build/scripts ./scripts/
COPY --chown=node:node LICENSE ./LICENSE
USER node
EXPOSE 3214
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3214/api/health-check').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "scripts/server.mjs"]
