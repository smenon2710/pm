#!/usr/bin/env bash
set -euo pipefail

IMAGE_NAME="pm-mvp"
CONTAINER_NAME="pm-mvp-app"

docker build -t "${IMAGE_NAME}" .
docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true

if [ -f ".env" ]; then
  docker run -d --name "${CONTAINER_NAME}" --env-file ".env" -p 8000:8000 "${IMAGE_NAME}"
else
  docker run -d --name "${CONTAINER_NAME}" -p 8000:8000 "${IMAGE_NAME}"
  echo "Warning: .env file not found. OPENROUTER_API_KEY may be missing."
fi

echo "App started: http://localhost:8000"
