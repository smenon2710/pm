# Project Execution Plan

This plan defines the implementation phases, explicit checklists, test expectations, and acceptance criteria for the MVP.

Guiding principles:
- Keep implementation simple and direct.
- Validate behavior with tests at each phase.
- Pause for user approval at required checkpoints.

## Part 1: Planning and Documentation

### Checklist
- [ ] Replace `docs/PLAN.md` with a detailed execution plan (this document).
- [ ] Create `frontend/AGENTS.md` describing the existing frontend codebase.
- [ ] Confirm test strategy and phase gates.
- [ ] Request user approval before moving to Part 2.

### Tests
- [ ] No runtime tests required (docs-only).
- [ ] Verify document completeness against project requirements.

### Success Criteria
- Plan includes Parts 1-10, each with checklist, tests, and success criteria.
- `frontend/AGENTS.md` accurately describes existing frontend app structure.
- User explicitly approves plan before implementation continues.

## Part 2: Scaffolding (Docker + FastAPI + Scripts)

### Checklist
- [ ] Create `backend/` FastAPI app scaffold.
- [ ] Add Docker setup to run full app locally in one container.
- [ ] Add OS-specific start/stop scripts in `scripts/` for Mac, Linux, and Windows.
- [ ] Serve static hello-world HTML from FastAPI at `/`.
- [ ] Add one API route (for example `/api/health`) and call it from the page.

### Tests
- [ ] Backend unit test for health endpoint.
- [ ] Manual verification: container starts, `/` renders, API call succeeds.
- [ ] Script verification on supported OS command format.

### Success Criteria
- `docker` build and run works locally.
- `GET /` serves hello-world page from backend.
- API route returns valid JSON response.
- Start/stop scripts work as documented.

## Part 3: Add Frontend Static Build and Serving

### Checklist
- [ ] Build Next.js frontend as static assets.
- [ ] Configure FastAPI to serve built frontend at `/`.
- [ ] Preserve backend API routes under `/api/*`.
- [ ] Confirm Kanban demo appears as home page.

### Tests
- [ ] Frontend unit tests (`vitest`) pass.
- [ ] Frontend integration/e2e tests (`playwright`) pass.
- [ ] Backend route tests still pass.
- [ ] Manual smoke test of `/` and `/api/health`.

### Success Criteria
- App root (`/`) shows Kanban demo via backend-served static files.
- No route conflict between frontend and backend API.
- Test suite is green for frontend and backend touched areas.

## Part 4: Fake Sign-In Flow

### Checklist
- [ ] Add login screen at initial visit.
- [ ] Accept only hardcoded credentials: `user` / `password`.
- [ ] Persist signed-in state for session.
- [ ] Add logout action returning to login screen.
- [ ] Protect board view so unauthenticated users cannot access it.

### Tests
- [ ] Unit tests for login form validation and auth state changes.
- [ ] Integration tests for login success/failure and logout.
- [ ] E2E test: blocked before login, access after login.

### Success Criteria
- Only valid dummy credentials unlock the board.
- Logout clears auth state and re-locks board.
- Auth behavior is fully covered by tests.

## Part 5: Database Modeling (SQLite + JSON payload)

### Checklist
- [ ] Propose schema for users, board metadata, and kanban content.
- [ ] Model board content as JSON stored in SQLite.
- [ ] Document rationale and tradeoffs in `docs/`.
- [ ] Request user sign-off before implementing routes.

### Tests
- [ ] Schema validation tests (creation/migration smoke test).
- [ ] Serialization/deserialization tests for board JSON payload.

### Success Criteria
- Schema supports multi-user extension and one board per user for MVP.
- JSON board payload shape is documented and versionable.
- User explicitly approves schema documentation.

## Part 6: Backend Kanban API

### Checklist
- [ ] Implement DB initialization on startup if DB file does not exist.
- [ ] Add API endpoints to read/update kanban board for a user.
- [ ] Add validation and clear error responses.
- [ ] Keep API minimal and aligned to frontend needs.

### Tests
- [ ] Backend unit tests for each route.
- [ ] DB integration tests for create/read/update board flows.
- [ ] Negative tests for invalid payloads and missing users.

### Success Criteria
- Board can be fetched and updated through API.
- DB auto-creates successfully in fresh environment.
- Backend tests are comprehensive and passing.

## Part 7: Frontend + Backend Integration

### Checklist
- [ ] Replace in-memory board state initialization with backend fetch.
- [ ] Save board edits via backend API.
- [ ] Handle loading/error states in simple UX form.
- [ ] Confirm persistence across page reloads.

### Tests
- [ ] Frontend unit tests for API integration logic.
- [ ] Integration tests with mocked API responses.
- [ ] E2E test for persistent updates across reload.

### Success Criteria
- Board state is truly persistent, not local-only.
- Core interactions (rename/add/delete/move) sync to backend.
- Tests verify persistence and failure handling.

## Part 8: AI Connectivity via OpenRouter

### Checklist
- [ ] Add backend service for OpenRouter calls using `OPENROUTER_API_KEY`.
- [ ] Configure model `openai/gpt-oss-120b`.
- [ ] Add test endpoint/path that performs simple `2+2` prompt.
- [ ] Add clear errors when key is missing or API fails.

### Tests
- [ ] Unit tests with mocked OpenRouter client.
- [ ] Connectivity smoke test for `2+2` result path.
- [ ] Failure path tests (missing key, non-200 response, timeout).

### Success Criteria
- Backend can successfully complete a simple OpenRouter call.
- Connection failures return understandable API errors.
- No secrets are logged.

## Part 9: AI Structured Outputs for Board Operations

### Checklist
- [ ] Define and document structured output schema.
- [ ] Include board JSON, user message, and conversation history in prompt context.
- [ ] Parse structured response into:
  - [ ] assistant text response
  - [ ] optional board update operation(s)
- [ ] Apply validated board updates server-side.
- [ ] Return updated board + assistant message to frontend.

### Tests
- [ ] Unit tests for schema validation and parser behavior.
- [ ] Unit tests for each supported board operation.
- [ ] Integration tests for end-to-end AI-response-to-board-update flow.
- [ ] Safety tests for malformed or partial model output.

### Success Criteria
- Structured output contract is explicit and enforced.
- Assistant can respond with or without board mutations.
- Invalid model output never corrupts persisted board state.

## Part 10: Sidebar AI Chat UX

### Checklist
- [ ] Add sidebar chat UI integrated into board page.
- [ ] Support message history in session.
- [ ] Call backend AI endpoint for each user message.
- [ ] Apply returned board updates and refresh UI state immediately.
- [ ] Keep visual style aligned with project color palette.

### Tests
- [ ] Component tests for sidebar rendering and chat interactions.
- [ ] Integration tests for request/response and optimistic/confirmed updates.
- [ ] E2E test covering chat-driven board mutation reflected in UI.

### Success Criteria
- Chat sidebar is usable and visually consistent with app.
- AI responses appear in conversation history.
- When AI returns board changes, board refreshes automatically and correctly.

## Phase Gates

- Gate A (required): User approval after Part 1 documentation.
- Gate B (required): User approval after Part 5 schema proposal.
- Gate C (optional): User checkpoint after Part 8 before structured outputs and full chat UX.

## Default Test Commands

- Frontend unit: `npm run test:unit` (from `frontend/`)
- Frontend e2e: `npm run test:e2e` (from `frontend/`)
- Backend unit/integration: `pytest` (from `backend/`, once created)