# Build the SPA, then ship a small Node image with the Express proxy.
# Builds natively on the Raspberry Pi (arm64) or anywhere via buildx.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY vite.config.js ./
COPY web ./web
RUN npm run build

FROM node:22-alpine
ENV NODE_ENV=production PORT=8090
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server ./server
COPY --from=build /app/web/dist ./web/dist
USER node
EXPOSE 8090
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8090/health || exit 1
CMD ["node", "server/index.js"]
