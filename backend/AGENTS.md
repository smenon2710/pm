## Backend Overview

This directory contains the FastAPI backend for the Project Management MVP.

Current implemented scope:
- Serves static frontend build at `/` (fallback HTML if build not present).
- Exposes `GET /api/health` returning `{"status":"ok"}`.
- Includes backend tests in `backend/tests/`.
- Uses `pyproject.toml` and runs with `uv` in Docker.

Board persistence scope:
- Initializes SQLite database on backend startup if DB file is missing.
- Creates and seeds `users` and `boards` tables (multiple boards per user supported).
- Exposes `GET /api/board` to fetch board JSON for a user (optionally by board_id).
- Exposes `PUT /api/board` to validate and persist board JSON updates (optionally by board_id).
- Exposes `GET /api/boards` to list all boards for a user.
- Exposes `POST /api/boards` to create a new board.
- Exposes `DELETE /api/boards/{board_id}` to delete a board.
- Exposes `PUT /api/boards/{board_id}` to rename a board.
- Includes backend tests for schema init, happy paths, and invalid payloads.

AI scope:
- Exposes `GET /api/ai/smoke` for OpenRouter connectivity checks.
- Exposes `POST /api/ai/board` for structured AI board-command processing.
- Builds prompt context with board JSON, user message, and conversation history.
- Parses/validates AI structured output and applies safe board operations server-side.
- Prevents board corruption on malformed/invalid model outputs.

### Key files
- `app/main.py`: FastAPI app factory with route definitions.
- `app/config.py`: Constants, seed data, and board validation.
- `app/database.py`: SQLite initialization, load/save functions.
- `app/ai.py`: OpenRouter client, response parsing, board operations.
- `tests/test_main.py`: backend unit/integration tests for board + AI behavior.
- `pyproject.toml`: dependencies and pytest configuration.