## Backend Overview

This directory contains the FastAPI backend for the Project Management MVP.

Current Part 2 scope:
- Serves hello-world HTML at `/` to validate backend web serving.
- Exposes `GET /api/health` returning `{"status":"ok"}`.
- Includes backend tests in `backend/tests/`.
- Uses `pyproject.toml` and is designed to run with `uv` in Docker.

### Key files
- `app/main.py`: FastAPI app with root HTML route and health endpoint.
- `tests/test_main.py`: tests for root route and health endpoint.
- `pyproject.toml`: dependencies and pytest configuration.