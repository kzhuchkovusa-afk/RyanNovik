# Optional Dockerfile for the KidsBrain backend.
# Render uses render.yaml directly; this is here for anyone deploying
# elsewhere (Fly, Railway, self-host on VPS, etc.).

FROM node:20-slim AS builder

WORKDIR /app

# better-sqlite3 has a native binding — build tools required to compile it.
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# --- runtime ---
FROM node:20-slim

WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .

# The SQLite file lives on a mounted volume in production; the schema is
# created on first boot by the migration runner.
RUN mkdir -p /var/data
VOLUME ["/var/data"]

ENV NODE_ENV=production
ENV DB_PATH=/var/data/kidsbrain.sqlite
ENV PORT=10000
EXPOSE 10000

CMD ["node", "server.js"]
