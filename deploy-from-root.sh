#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

ENV_ARCHIVE="swapcampus-env-bundle.tar.gz"
REQUIRED_FILES=(
  ".env"
  "backend/.env"
  "vendure/.env"
)

require_command() {
  local cmd="$1"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "缺少命令: $cmd" >&2
    exit 1
  fi
}

require_file() {
  local file="$1"
  if [[ ! -f "$file" ]]; then
    echo "缺少文件: $file" >&2
    echo "如果你拿到的是环境压缩包，请先在仓库根目录解压 $ENV_ARCHIVE" >&2
    exit 1
  fi
}

wait_for_db_init() {
  local container_id
  local status
  local exit_code

  container_id="$(docker compose ps -a -q db-init)"
  if [[ -z "$container_id" ]]; then
    echo "未找到 db-init 容器" >&2
    exit 1
  fi

  for _ in $(seq 1 90); do
    status="$(docker inspect -f '{{.State.Status}}' "$container_id")"
    if [[ "$status" == "exited" ]]; then
      exit_code="$(docker inspect -f '{{.State.ExitCode}}' "$container_id")"
      if [[ "$exit_code" == "0" ]]; then
        return 0
      fi
      echo "db-init 执行失败，最近日志如下:" >&2
      docker compose logs db-init --tail=100 >&2
      exit 1
    fi
    sleep 2
  done

  echo "等待 db-init 超时" >&2
  docker compose logs db-init --tail=100 >&2
  exit 1
}

wait_for_http() {
  local name="$1"
  local url="$2"

  for _ in $(seq 1 60); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done

  echo "$name 未在预期时间内就绪: $url" >&2
  exit 1
}

require_command docker
require_command curl

for file in "${REQUIRED_FILES[@]}"; do
  require_file "$file"
done

echo "[1/4] 初始化数据库"
docker compose --profile init up -d --build db-init
wait_for_db_init

echo "[2/4] 启动核心服务"
docker compose up -d --build mysql minio meilisearch supertokens-db supertokens vendure backend frontend

echo "[3/4] 等待服务就绪"
wait_for_http "Backend health" "http://127.0.0.1:3001/api/health"
wait_for_http "Vendure health" "http://127.0.0.1:3002/health"

echo "[4/4] 输出状态与验证结果"
docker compose ps -a
curl -fsS http://127.0.0.1:3001/api/health
echo
curl -fsS http://127.0.0.1:3001/api/products/publishing-rules >/dev/null
curl -fsS http://127.0.0.1:3001/api/products/dashboard >/dev/null
curl -I -fsS http://127.0.0.1:5178 >/dev/null
echo "部署完成"
