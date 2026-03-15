FROM node:20-bookworm-slim AS deps

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends sqlite3 tini ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma

RUN npm ci --omit=dev \
  && npx prisma generate

FROM node:20-bookworm-slim AS runtime

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends sqlite3 tini ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma
COPY src ./src
COPY apps ./apps
COPY scripts ./scripts
COPY deploy/entrypoints ./deploy/entrypoints
COPY scum_item_category_manifest.json ./scum_item_category_manifest.json
COPY scum_weapons_from_wiki.json ./scum_weapons_from_wiki.json
COPY scum_items-main ./scum_items-main

ENV NODE_ENV=production
ARG APP_ROLE=bot
ENV APP_ROLE=${APP_ROLE}

HEALTHCHECK --interval=30s --timeout=5s --retries=5 CMD ["node", "scripts/container-healthcheck.js"]
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "deploy/entrypoints/start-role.js"]
