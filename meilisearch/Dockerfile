FROM node:20-bookworm-slim

ARG MEILISEARCH_VERSION=v1.15.2

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

RUN curl -L "https://github.com/meilisearch/meilisearch/releases/download/${MEILISEARCH_VERSION}/meilisearch-linux-amd64" \
  -o /usr/local/bin/meilisearch \
  && chmod +x /usr/local/bin/meilisearch

WORKDIR /meili_data

EXPOSE 7700

CMD ["meilisearch", "--http-addr", "0.0.0.0:7700", "--db-path", "/meili_data"]
