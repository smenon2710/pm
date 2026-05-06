# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Kanban Studio — a full-stack project management MVP. Next.js static frontend served by a Python FastAPI backend, packaged as a single Docker container. AI chat and voice control integrate with OpenRouter to perform structured board mutations.

## Commands

### Backend (from `backend/` directory)
```bash
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000   # dev server
pytest                                                         # run tests
uv sync                                                        # install dependencies
```

### Frontend (from `frontend/` directory)
```bash
npm run dev           # Next.js dev server (port 3000)
npm run build         # production static export
npm run lint          # ESLint
npm run test:unit     # Vitest unit tests
npm run test:e2e      # Playwright e2e tests (requires running dev server)
npm run test:all      # both unit + e2e
```

### Docker (production)
```bash
bash scripts/start-mac.sh    # build image + run container on port 8000
bash scripts/stop-mac.sh     # stop + remove container
docker build -t pm-mvp .
docker run -d --name pm-mvp-app --env-file .env -p 8000:8000 pm-mvp
```

## Architecture

### Request Flow
```
Browser
  → Next.js static site (auth, Kanban board, chat sidebar, voice input)
  → FastAPI at port 8000
      ├── GET/PUT /api/board  ← SQLite (data/pm.db)
      └── POST /api/ai/board  ← OpenRouter API (gpt-oss-120b)
```

The Dockerfile is multi-stage: Node 22 builds the Next.js static export, then Python 3.11 serves both the static files and the API via Uvicorn.

### Backend modules (`backend/app/`)

| File | Role |
|------|------|
| `main.py` | FastAPI app, lifespan (DB init + seed), all route handlers |
| `config.py` | Constants, board validation logic, initial board seed data |
| `database.py` | SQLite init, `load_board_for_user()`, `save_board_for_user()` |
| `ai.py` | OpenRouter call, prompt building, structured JSON parsing, `apply_board_operations()` |

Backend uses Python stdlib (`sqlite3`, `urllib`) — no ORM, no external HTTP library.

### Frontend modules (`frontend/src/`)

| File | Role |
|------|------|
| `app/page.tsx` | Root component: auth state, board state, chat sidebar, voice control |
| `components/KanbanBoard.tsx` | @dnd-kit DndContext + DragOverlay, delegates column/card handlers |
| `components/KanbanColumn.tsx` | Droppable column, card list, add-card form |
| `components/KanbanCard.tsx` | Draggable card, delete action |
| `lib/kanban.ts` | Types (`Card`, `Column`, `BoardData`), `moveCard()`, `createId()` |

### Data model

`board_json` in SQLite is a full JSON blob (replaced atomically on every save):
```json
{
  "columns": [{ "id": "col-*", "title": "string", "cardIds": ["card-*"] }],
  "cards":   { "card-*": { "id": "card-*", "title": "string", "details": "string" } }
}
```
One board per user (enforced by `UNIQUE` constraint on `boards.user_id`).

### AI integration contract

`POST /api/ai/board` sends board state + conversation history to OpenRouter. Expected response schema (documented in `docs/AI_STRUCTURED_OUTPUT.md`):
```json
{
  "assistantMessage": "string",
  "operations": [
    { "type": "create_card|update_card|move_card", ... }
  ]
}
```
`ai.py` validates and applies operations transactionally before persisting.

## Key Constraints

- **Auth is hardcoded** (client-side only, `pm-authenticated` in localStorage). No backend auth enforcement.
- **Single board per user.** Multi-user/multi-board is out of scope for this MVP.
- **No per-field patching** — every board change replaces the full `board_json` blob.
- **OpenRouter model:** `openai/gpt-oss-120b`. Set `OPENROUTER_API_KEY` in `.env`.
- **E2E tests** target `http://127.0.0.1:3000` — the Next.js dev server must be running separately.
- **Package manager:** `uv` for Python (used in Dockerfile); `npm` for frontend.
- **Next.js is configured as a static export** (`output: "export"` in `next.config.ts`) — no server-side Next.js features.

## Brand Colors
`#ecad0a` (yellow), `#209dd7` (blue), `#753991` (purple), `#032147` (navy), `#888888` (gray)
