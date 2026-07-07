# Backend image with an optional Litestream sidecar built in.
# Litestream only runs when the LITESTREAM_* env vars are set at boot
# — otherwise the wrapper just executes node directly with zero overhead.

FROM node:20-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# --- runtime ---
FROM node:20-slim
WORKDIR /app

# Litestream (pinned): tiny statically-linked binary, ~10 MB. Installed
# unconditionally so the same image works with or without S3 replication.
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates wget \
    && wget -qO- https://github.com/benbjohnson/litestream/releases/download/v0.3.13/litestream-v0.3.13-linux-amd64.tar.gz \
       | tar -xz -C /usr/local/bin \
    && apt-get purge -y wget \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/node_modules ./node_modules
COPY . .
RUN chmod +x /app/scripts/start-with-litestream.sh

RUN mkdir -p /var/data
VOLUME ["/var/data"]

ENV NODE_ENV=production
ENV DB_PATH=/var/data/kidsbrain.sqlite
ENV PORT=10000
EXPOSE 10000

CMD ["/app/scripts/start-with-litestream.sh"]
