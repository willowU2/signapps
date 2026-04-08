# ─────────────────────────────────────────────────────────────────────────────
# SignApps Frontend — Production Dockerfile (Next.js standalone)
#
# Build:
#   docker build -t signapps-frontend ./client
#
# The next.config uses `output: 'standalone'` for minimal image size.
# ─────────────────────────────────────────────────────────────────────────────

FROM node:22-slim AS base

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm install -g pnpm@9

# ─── Stage 1: dependency install ─────────────────────────────────────────────
FROM base AS deps

WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ─── Stage 2: builder ────────────────────────────────────────────────────────
FROM base AS builder

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# DOCKER_BUILD=1 activates `output: 'standalone'` in next.config.ts
ENV DOCKER_BUILD=1
RUN pnpm build

# ─── Stage 3: production runtime ─────────────────────────────────────────────
FROM node:22-slim AS runner

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN groupadd -r nextjs && useradd -r -g nextjs nextjs

WORKDIR /app

# Copy standalone output (Next.js standalone mode)
COPY --from=builder --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nextjs /app/public ./public

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]

LABEL org.opencontainers.image.title="SignApps Frontend" \
      org.opencontainers.image.description="SignApps Next.js 16 frontend" \
      org.opencontainers.image.vendor="SignApps" \
      org.opencontainers.image.licenses="MIT"
