#!/usr/bin/env bash
set -euo pipefail

IMAGE_NAME="pm-mvp"
CONTAINER_NAME="pm-mvp-app"

docker build -t "${IMAGE_NAME}" .
docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true
docker run -d --name "${CONTAINER_NAME}" -p 8000:8000 "${IMAGE_NAME}"

echo "App started: http://localhost:8000"
