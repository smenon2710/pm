# Code Review: Project Management MVP

## Overview

This is a well-structured MVP project management application with a Next.js frontend and FastAPI backend. The app features a Kanban board with drag-and-drop, AI-powered board control via OpenRouter, and voice command support.

---

## Strengths

### Architecture & Organization

- Clean separation between frontend (Next.js 16 + React 19) and backend (FastAPI)
- Proper multi-stage Docker build with optimized layers
- Good TypeScript usage with clear type definitions in `frontend/src/lib/kanban.ts`
- Documentation in `docs/` is comprehensive and up-to-date

### Backend Quality (modularized)

The backend was recently modularized from a single 522-line file into focused modules:
- `app/config.py`: Constants, seed data, and `validate_board_payload()` function
- `app/database.py`: SQLite initialization (`init_db()`), load/save functions
- `app/ai.py`: OpenRouter client, response parsing (`parse_ai_structured_output()`), board operations (`apply_board_operations()`)
- `app/main.py`: FastAPI app factory with route definitions

- **Validation**: Thorough board payload validation in `config.py`
- **Test Coverage**: 20+ test cases in `tests/test_main.py` covering happy paths, error handling, and AI operations
- **Error Handling**: Clear HTTP status codes and meaningful error messages throughout
- **AI Safety**: Strong response parsing prevents board corruption from malformed model outputs

### Frontend Quality

- **Component Structure**: Good separation with single-responsibility components (KanbanBoard, KanbanColumn, KanbanCard, NewCardForm)
- **Drag and Drop**: Proper implementation using `@dnd-kit` with accessibility support
- **Voice Controls**: Robust implementation with browser fallback (`webkitSpeechRecognition`), error handling for permission denied, no-speech, and audio-capture scenarios
- **State Management**: Handles loading/error states for both board sync and AI operations

### Data Handling

- SQLite database with proper initialization and seeding in `database.py`
- Board JSON validated before every save to prevent data corruption
- AI operations validated server-side before persisting to ensure board integrity

---

## Areas for Improvement

### 1. Security - Client-Side Authentication Only

**Location**: `frontend/src/app/page.tsx:146`

**Issue**: Authentication is entirely client-side with hardcoded credentials. The backend accepts any username without validation.

```typescript
const DEMO_USERNAME = "user";
const DEMO_PASSWORD = "password";
// ...
if (username === DEMO_USERNAME && password === DEMO_PASSWORD) {
```

**Risk**: Anyone can access the board API directly without authentication.

**Recommendation**: Implement proper authentication with JWT tokens or session cookies. Add middleware to protect API routes.

### 2. Performance - No Debouncing on Board Saves

**Location**: `frontend/src/app/page.tsx:216-240`

**Issue**: Every board change immediately triggers a save. Column renames trigger saves on every keystroke.

**Risk**: Excessive API calls, potential race conditions, unnecessary load on the backend.

**Recommendation**: Add debounce (300-500ms) for board saves, or only persist on blur/change completion rather than on every state update.

### 3. Component Size - page.tsx is 567 Lines

**Location**: `frontend/src/app/page.tsx`

**Issue**: Contains login form, board rendering, AI chat, and voice controls all in one component.

**Recommendation**: Extract into sub-components:
- LoginForm
- ChatSidebar
- VoiceControls
- BoardSyncStatus

### 4. Missing Card Edit Functionality

**Issue**: Users can add and delete cards, but cannot edit an existing card's title or details directly.

**Recommendation**: Add an edit modal or inline editing for cards.

### 5. Type Safety Gaps

**Location**: `frontend/src/app/page.tsx:17-50`

**Issue**: Speech recognition types use `any` and loose typing for browser compatibility.

```typescript
type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: SpeechRecognitionResultLike[];
};
```

**Recommendation**: Consider creating a proper type adapter or using a library that provides proper types.

### 6. Error Handling - AI Board Save Failure

**Location**: `backend/app/main.py` (in `ai_board` endpoint)

**Issue**: If board save fails after AI operation applies in-memory changes, the error is raised but there's no rollback of the in-memory state that was already returned to the client.

**Recommendation**: Wrap the save operation in a transaction or validate save success before returning to ensure consistency between client and server state.

---

## Test Coverage

### Backend (Excellent)
- API endpoints (health, board read/write, AI endpoints)
- AI parsing and validation
- Error path coverage
- Malformed JSON handling

### Frontend (Good)
- Unit tests for kanban logic (`kanban.test.ts`)
- Component tests for KanbanBoard (`KanbanBoard.test.tsx`)
- Could benefit from more integration tests for the API layer

---

## Summary

The codebase is well-structured for an MVP with solid error handling and good separation of concerns. Key improvements needed are:

1. **Authentication**: Move from client-side hardcoded auth to proper session management
2. **Performance**: Add debouncing for board saves
3. **UX**: Add card editing capability

The AI integration is robust with strong server-side validation preventing board corruption. Voice controls are well-implemented with proper browser fallbacks and accessibility considerations.