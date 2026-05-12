# Multi-Board Support Plan

## Goal

Allow users to create, view, and manage multiple Kanban boards.

## Database Changes

### Schema Update

Change `boards` table from one-per-user to many-per-user:

```sql
-- Current: user_id UNIQUE (one board per user)
-- New: user_id NOT NULL (many boards per user)

CREATE TABLE IF NOT EXISTS boards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL DEFAULT 'My Board',
  schema_version INTEGER NOT NULL DEFAULT 1,
  board_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
-- Remove: user_id UNIQUE constraint
-- Add: INDEX on (user_id) for query performance
```

### Migration

- Add migration to remove UNIQUE constraint from `user_id`
- Create index: `CREATE INDEX IF NOT EXISTS idx_boards_user_id ON boards(user_id)`

## API Changes

### New Endpoints

1. `GET /api/boards` - List all boards for a user
   - Response: `{ "boards": [{ "id": int, "title": string, "updated_at": string }] }`

2. `POST /api/boards` - Create a new board
   - Request: `{ "title": string }`
   - Response: `{ "id": int, "title": string, "board": {...} }`

3. `DELETE /api/boards/{board_id}` - Delete a board
   - Response: `{ "ok": true }`

4. `PUT /api/boards/{board_id}` - Rename a board
   - Request: `{ "title": string }`
   - Response: `{ "ok": true }`

### Updated Endpoints

- `GET /api/board` - Add optional `board_id` param
  - If `board_id` provided, fetch that specific board
  - If not provided, default to first board or create one

- `PUT /api/board` - Add `board_id` to request
  - Required: `board_id` or keep current single-board behavior

## Frontend Changes

### Board Selector UI

- Add dropdown/selector in header to switch between boards
- Show current board name
- Options: List all boards + "Create new board"

### Board Management

- "Create Board" button with name input
- "Delete Board" option (with confirmation)
- "Rename Board" option

### State Management

- Track `currentBoardId` in frontend state
- Load board list on auth
- Persist selected board in session or localStorage

## Implementation Order

1. **Database**: Update schema, add migration functions
2. **Backend API**: Add boards endpoints, update existing endpoints
3. **Frontend**: Add board selector, update board loading/saving
4. **Testing**: Add backend tests, update e2e tests

## Backward Compatibility

- When upgrading existing single-board users:
  - Migrate existing board to have `title = "My Board"`
  - New API endpoints work alongside old ones
  - Old API calls (`GET /api/board` without board_id) return first board

## Test Checklist

- [ ] Create board returns new board with unique ID
- [ ] List boards returns all boards for user
- [ ] Delete board removes board and returns success
- [ ] Rename board updates title
- [ ] Load specific board by ID works
- [ ] Update specific board by ID works
- [ ] Cannot delete last board (keep at least one)
- [ ] Frontend board switcher loads correct board
- [ ] Persistence works across sessions

## Estimated Scope

- Database changes: 1-2 hours
- Backend API: 2-3 hours
- Frontend UI: 3-4 hours
- Testing: 2 hours
- **Total**: ~8-10 hours