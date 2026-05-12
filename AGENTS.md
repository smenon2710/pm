# The Project Management MVP web app

## Business Requirements

This project is building a Project Management App. Key features:
- A user can sign in
- When signed in, the user sees a Kanban board representing their project
- The Kanban board has fixed columns that can be renamed
- The cards on the Kanban board can be moved with drag and drop, and edited
- There is an AI chat feature in a sidebar; the AI is able to create / edit / move one or more cards
- Voice control is implemented for board-command chat input and execution flow

## Limitations

For the MVP, there will only be a user sign in (hardcoded to 'user' and 'password') but the database will support multiple users for future.

For the MVP, this will run locally (in a docker container)

## Technical Decisions

- NextJS frontend
- Python FastAPI backend, including serving the static NextJS site at /
- Everything packaged into a Docker container
- Use "uv" as the package manager for python in the Docker container
- Use OpenRouter for the AI calls. An OPENROUTER_API_KEY is in .env in the project root
- Use `openai/gpt-oss-120b` as the model
- Use SQLLite local database for the database, creating a new db if it doesn't exist
- Start and Stop server scripts for Mac, PC, Linux in scripts/
- Start scripts should pass `.env` into Docker (`--env-file`) when present

## Current State (Implemented Through Part 12)

- Auth-gated board is implemented with hardcoded credentials (`user` / `password`)
- Board data is persisted in SQLite via backend APIs (`GET /api/board`, `PUT /api/board`)
- Backend auto-initializes DB and seeds default user + board
- OpenRouter integration is implemented:
  - `GET /api/ai/smoke` for connectivity checks
  - `POST /api/ai/board` for structured AI operations
- Frontend includes an AI sidebar chat that can trigger card create/edit/move/delete via backend
- Frontend supports voice capture for commands, transcript preview, resend/retry actions, and accessibility status announcements
- Frontend and backend run together in Docker with static Next.js served by FastAPI
- Multi-board support: users can create, switch between, and delete multiple boards

## Color Scheme

- Accent Yellow: `#ecad0a` - accent lines, highlights
- Blue Primary: `#209dd7` - links, key sections
- Purple Secondary: `#753991` - submit buttons, important actions
- Dark Navy: `#032147` - main headings
- Gray Text: `#888888` - supporting text, labels

## Coding standards

1. Use latest versions of libraries and idiomatic approaches as of today
2. Keep it simple - NEVER over-engineer, ALWAYS simplify, NO unnecessary defensive programming. No extra features - focus on simplicity.
3. Be concise. Keep README minimal. IMPORTANT: no emojis ever
4. When hitting issues, always identify root cause before trying a fix. Do not guess. Prove with evidence, then fix the root cause.

## Working documentation

All documents for planning and executing this project will be in the docs/ directory.
Please review the docs/PLAN.md document before proceeding.