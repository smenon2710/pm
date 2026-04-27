## Backend Overview

This directory contains the FastAPI backend for the Project Management MVP.

Current Part 2 scope:
- Serves hello-world HTML at `/` to validate backend web serving.
- Exposes `GET /api/health` returning `{"status":"ok"}`.
- Includes backend tests in `backend/tests/`.
- Uses `pyproject.toml` and is designed to run with `uv` in Docker.

Current Part 6 scope:
- Initializes SQLite database on backend startup if DB file is missing.
- Creates and seeds `users` and `boards` tables.
- Exposes `GET /api/board` to fetch board JSON for a user.
- Exposes `PUT /api/board` to validate and persist board JSON updates.
- Includes backend tests for schema init, happy paths, and invalid payloads.

### Key files
- `app/main.py`: FastAPI app with root HTML route and health endpoint.
- `tests/test_main.py`: tests for root route and health endpoint.
- `pyproject.toml`: dependencies and pytest configuration.