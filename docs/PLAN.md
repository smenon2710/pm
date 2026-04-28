# Project Execution Plan

This plan defines the implementation phases, explicit checklists, test expectations, and acceptance criteria for the MVP.

Guiding principles:
- Keep implementation simple and direct.
- Validate behavior with tests at each phase.
- Pause for user approval at required checkpoints.

## Part 1: Planning and Documentation

### Checklist
- [x] Replace `docs/PLAN.md` with a detailed execution plan (this document).
- [x] Create `frontend/AGENTS.md` describing the existing frontend codebase.
- [x] Confirm test strategy and phase gates.
- [x] Request user approval before moving to Part 2.

### Tests
- [x] No runtime tests required (docs-only).
- [x] Verify document completeness against project requirements.

### Success Criteria
- Plan includes Parts 1-10, each with checklist, tests, and success criteria.
- `frontend/AGENTS.md` accurately describes existing frontend app structure.
- User explicitly approves plan before implementation continues.

## Part 2: Scaffolding (Docker + FastAPI + Scripts)

### Checklist
- [x] Create `backend/` FastAPI app scaffold.
- [x] Add Docker setup to run full app locally in one container.
- [x] Add OS-specific start/stop scripts in `scripts/` for Mac, Linux, and Windows.
- [x] Serve static hello-world HTML from FastAPI at `/`.
- [x] Add one API route (for example `/api/health`) and call it from the page.

### Tests
- [x] Backend unit test for health endpoint.
- [x] Manual verification: container starts, `/` renders, API call succeeds.
- [x] Script verification on supported OS command format.

### Success Criteria
- `docker` build and run works locally.
- `GET /` serves hello-world page from backend.
- API route returns valid JSON response.
- Start/stop scripts work as documented.

## Part 3: Add Frontend Static Build and Serving

### Checklist
- [x] Build Next.js frontend as static assets.
- [x] Configure FastAPI to serve built frontend at `/`.
- [x] Preserve backend API routes under `/api/*`.
- [x] Confirm Kanban demo appears as home page.

### Tests
- [x] Frontend unit tests (`vitest`) pass.
- [x] Frontend integration/e2e tests (`playwright`) pass.
- [x] Backend route tests still pass.
- [x] Manual smoke test of `/` and `/api/health`.

### Success Criteria
- App root (`/`) shows Kanban demo via backend-served static files.
- No route conflict between frontend and backend API.
- Test suite is green for frontend and backend touched areas.

## Part 4: Fake Sign-In Flow

### Checklist
- [x] Add login screen at initial visit.
- [x] Accept only hardcoded credentials: `user` / `password`.
- [x] Persist signed-in state for session.
- [x] Add logout action returning to login screen.
- [x] Protect board view so unauthenticated users cannot access it.
- [x] Preserve existing board behavior after login and maintain board state across logout/re-login within the same browser session.

### Tests
- [x] Unit tests for login form validation and auth state changes.
- [x] Integration tests for login success/failure and logout.
- [x] E2E test: blocked before login, access after login.
- [x] Unit + e2e coverage for state retention across logout/re-login.

### Success Criteria
- Only valid dummy credentials unlock the board.
- Logout clears auth state and re-locks board.
- Auth behavior is fully covered by tests.

## Part 5: Database Modeling (SQLite + JSON payload)

### Checklist
- [x] Propose schema for users, board metadata, and kanban content.
- [x] Model board content as JSON stored in SQLite.
- [x] Document rationale and tradeoffs in `docs/` (`docs/DB_SCHEMA.md`).
- [x] Request user sign-off before implementing routes.

### Tests
- [ ] Schema validation tests (creation/migration smoke test).
- [ ] Serialization/deserialization tests for board JSON payload.

### Success Criteria
- Schema supports multi-user extension and one board per user for MVP.
- JSON board payload shape is documented and versionable.
- User explicitly approves schema documentation.

## Part 6: Backend Kanban API

### Checklist
- [x] Implement DB initialization on startup if DB file does not exist.
- [x] Add API endpoints to read/update kanban board for a user.
- [x] Add validation and clear error responses.
- [x] Keep API minimal and aligned to frontend needs.

### Tests
- [x] Backend unit tests for each route.
- [x] DB integration tests for create/read/update board flows.
- [x] Negative tests for invalid payloads and missing users.

### Success Criteria
- Board can be fetched and updated through API.
- DB auto-creates successfully in fresh environment.
- Backend tests are comprehensive and passing.

## Part 7: Frontend + Backend Integration

### Checklist
- [x] Replace in-memory board state initialization with backend fetch.
- [x] Save board edits via backend API.
- [x] Handle loading/error states in simple UX form.
- [x] Confirm persistence across page reloads.

### Tests
- [x] Frontend unit tests for API integration logic.
- [x] Integration tests with mocked API responses.
- [x] E2E test for persistent updates across reload.

### Success Criteria
- Board state is truly persistent, not local-only.
- Core interactions (rename/add/delete/move) sync to backend.
- Tests verify persistence and failure handling.

## Part 8: AI Connectivity via OpenRouter

### Checklist
- [x] Add backend service for OpenRouter calls using `OPENROUTER_API_KEY`.
- [x] Configure model `openai/gpt-oss-120b`.
- [x] Add test endpoint/path that performs simple `2+2` prompt.
- [x] Add clear errors when key is missing or API fails.

### Tests
- [x] Unit tests with mocked OpenRouter client.
- [x] Connectivity smoke test for `2+2` result path.
- [x] Failure path tests (missing key, non-200 response, timeout).

### Success Criteria
- Backend can successfully complete a simple OpenRouter call.
- Connection failures return understandable API errors.
- No secrets are logged.

## Part 9: AI Structured Outputs for Board Operations

### Checklist
- [x] Define and document structured output schema.
- [x] Include board JSON, user message, and conversation history in prompt context.
- [x] Parse structured response into:
  - [x] assistant text response
  - [x] optional board update operation(s)
- [x] Apply validated board updates server-side.
- [x] Return updated board + assistant message to frontend.

### Tests
- [x] Unit tests for schema validation and parser behavior.
- [x] Unit tests for each supported board operation.
- [x] Integration tests for end-to-end AI-response-to-board-update flow.
- [x] Safety tests for malformed or partial model output.

### Success Criteria
- Structured output contract is explicit and enforced.
- Assistant can respond with or without board mutations.
- Invalid model output never corrupts persisted board state.

## Part 10: Sidebar AI Chat UX

### Checklist
- [x] Add sidebar chat UI integrated into board page.
- [x] Support message history in session.
- [x] Call backend AI endpoint for each user message.
- [x] Apply returned board updates and refresh UI state immediately.
- [x] Keep visual style aligned with project color palette.

### Tests
- [x] Component tests for sidebar rendering and chat interactions.
- [x] Integration tests for request/response and optimistic/confirmed updates.
- [x] E2E test covering chat-driven board mutation reflected in UI.

### Success Criteria
- Chat sidebar is usable and visually consistent with app.
- AI responses appear in conversation history.
- When AI returns board changes, board refreshes automatically and correctly.

## Part 11: Voice Control for Kanban Board

Goal: enable users to fully control the board with voice, including moving cards, creating cards, deleting cards, renaming columns, and updating card content.

### Part 11A: Voice Input Foundation

#### Checklist
- [x] Add voice input controls in sidebar chat:
  - [x] Start/stop microphone recording button
  - [x] Listening indicator (clear active state)
  - [x] Quick retry/clear transcript actions
- [x] Add browser speech-to-text layer:
  - [x] Convert speech to transcript in near real time
  - [x] Populate transcript into editable message input
  - [x] Support manual edit before submit
- [x] Handle platform fallbacks:
  - [x] Permission-denied state
  - [x] No microphone/device unavailable state
  - [x] Unsupported-browser state

#### Tests
- [x] Component tests for supported/unsupported rendering states.
- [x] Component tests for listening/idle/error transitions.
- [x] Unit tests for transcript normalization and message composition.
- [x] Unit tests for permission/API failure handling.

#### Success Criteria
- User can speak and see transcript appear in message input.
- Transcript is editable before send.
- Unsupported/denied states show clear guidance and do not crash UI.

### Part 11B: Full Voice Command Execution

#### Checklist
- [x] Route voice transcript through existing AI endpoint (`POST /api/ai/board`).
- [x] Ensure command coverage for:
  - [x] Move cards between columns
  - [x] Create cards
  - [x] Delete cards
  - [x] Rename columns
  - [x] Edit card title/details
- [x] Support multi-operation utterances where reasonable.
- [x] Ensure returned board updates are applied immediately in UI.

#### Tests
- [x] Integration test: voice transcript executes move-card command.
- [x] Integration test: voice transcript executes create/delete/edit/rename commands.
- [x] Integration test: failed AI responses do not corrupt board state.
- [x] E2E mocked-mic test for move + rename flows.
- [x] E2E mocked-mic test for create/edit/delete card flows.

#### Success Criteria
- Voice commands can control all core board operations.
- Voice and typed flows share one backend pathway and produce equivalent behavior.
- Invalid model responses never persist broken board state.

### Part 11C: Voice UX Polish and Reliability

#### Checklist
- [ ] Add command preview/confirmation UX:
  - [ ] Display recognized transcript before submit
  - [ ] Display assistant confirmation of applied operations
- [ ] Improve feedback and recovery:
  - [ ] Actionable error copy for failed recognition and failed AI apply
  - [ ] One-tap retry for recent voice command
- [ ] Improve accessibility:
  - [ ] Keyboard-operable voice controls
  - [ ] Proper labels/announcements for listening and errors
- [ ] Keep typed chat and drag-and-drop behavior regression-free.

#### Tests
- [ ] Component tests for preview/confirmation/error visuals.
- [ ] Accessibility checks for voice controls and state announcements.
- [ ] Regression pass for typed chat and drag-and-drop board interactions.

#### Success Criteria
- Voice control experience is clear, reliable, and accessible.
- Users can recover quickly from recognition or execution errors.
- Existing board interaction modes remain stable.

## Phase Gates

- Gate A (required): User approval after Part 1 documentation. (completed)
- Gate B (required): User approval after Part 5 schema proposal. (completed)
- Gate C (optional): User checkpoint after Part 8 before structured outputs and full chat UX.
- Gate D (optional): User checkpoint after Part 10 before voice control implementation.
- Gate E (optional): User checkpoint after Part 11A foundation before full voice command execution.
- Gate F (optional): User checkpoint after Part 11B command coverage before UX polish.

## Default Test Commands

- Frontend unit: `npm run test:unit` (from `frontend/`)
- Frontend e2e: `npm run test:e2e` (from `frontend/`)
- Backend unit/integration: `pytest` (from `backend/`, once created)

## Implemented Design Decisions (Through Part 10)

- Backend startup uses FastAPI lifespan to initialize SQLite automatically at `data/pm.db` (override supported via `PM_DB_PATH`).
- DB seeding guarantees default `user` and one seeded board row when missing.
- Board storage uses full JSON payload replacement (`board_json`) with validation on every update.
- Board API surface is intentionally minimal for MVP:
  - `GET /api/board?username=user`
  - `PUT /api/board` with `{ username, board }`
- OpenRouter connectivity is implemented in backend:
  - `GET /api/ai/smoke` for basic connectivity smoke checks (`2+2`)
  - `POST /api/ai/board` for structured AI board operations
- Start scripts pass environment variables from `.env` into Docker container when present.
- Frontend auth remains hardcoded (`user`/`password`) with local session flag (`pm-authenticated`).
- Frontend board lifecycle:
  - load board from backend after login
  - persist board on edits
  - show lightweight loading/sync-error badges
- Frontend AI chat sidebar:
  - keeps session-local conversation history
  - submits user messages to `/api/ai/board`
  - applies returned board updates immediately
  - surfaces backend error details in the UI
- Frontend and backend are built/run in one Docker image using multi-stage build:
  - Next.js static export served by FastAPI at `/`
  - backend APIs remain under `/api/*`