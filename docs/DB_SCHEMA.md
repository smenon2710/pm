# Part 5: Database Schema Proposal

This document proposes the SQLite schema and JSON board payload for the MVP.

Goals:
- Keep MVP storage simple.
- Support one board per signed-in user today.
- Keep schema ready for multiple users in future.
- Store board content as JSON in SQLite.

## Proposed SQLite Tables

### `users`

Purpose: store user identity records.

```sql
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Notes:
- MVP login is hardcoded (`user`/`password`) at app layer, but DB still supports multiple users.
- `password_hash` is included for forward compatibility when auth moves off hardcoded values.

### `boards`

Purpose: one board row per user.

```sql
CREATE TABLE IF NOT EXISTS boards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  title TEXT NOT NULL DEFAULT 'My Board',
  schema_version INTEGER NOT NULL DEFAULT 1,
  board_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

Notes:
- `UNIQUE(user_id)` enforces one board per user (MVP requirement).
- `board_json` stores the full board state as JSON text.
- `schema_version` allows controlled future payload migrations.

## `board_json` Payload Shape (Version 1)

The JSON shape mirrors existing frontend state to reduce transformation logic.

```json
{
  "columns": [
    {
      "id": "col-backlog",
      "title": "Backlog",
      "cardIds": ["card-1", "card-2"]
    }
  ],
  "cards": {
    "card-1": {
      "id": "card-1",
      "title": "Align roadmap themes",
      "details": "Draft quarterly themes with impact statements and metrics."
    }
  }
}
```

### Validation Rules

- `columns` is an ordered array.
- Each `column.id` is unique.
- `cards` is a map keyed by `card.id`.
- Every `cardIds[]` entry must exist in `cards`.
- No card ID can appear in multiple columns.
- `title` and `details` are strings.

## Default Seed Data

For first startup:
- create user row for `user` if missing
- create one board row for that user if missing
- initialize `board_json` from current frontend `initialData`

## Read/Write Strategy

MVP strategy (simple and safe):
- Read: fetch `board_json` for user and deserialize.
- Write: validate full payload, then replace `board_json` atomically in one update.

Why full replace for MVP:
- simpler than per-card/column patching
- easier to validate consistency rules
- matches current frontend single-state update model

## Tradeoffs

Pros:
- minimal schema complexity
- low impedance mismatch with frontend model
- easy versioning via `schema_version`

Cons:
- full JSON replacement writes more data than partial updates
- ad-hoc SQL queries over board content are limited
- concurrent edit merging is basic (last write wins for MVP)

## Migration and Versioning

- Start with `schema_version = 1`.
- Future schema upgrades:
  1. read current version
  2. apply deterministic migration function(s)
  3. write upgraded payload with incremented version

## Proposed Tests for Part 6 Implementation

When routes are added in Part 6, implement:

1. Schema creation smoke test
- fresh DB creates `users` and `boards`.

2. Seed initialization test
- default user and board are created once.

3. Serialization/deserialization test
- saved board JSON round-trips without loss.

4. Validation rejection tests
- unknown card IDs in columns rejected.
- duplicate card assignment rejected.
- missing required fields rejected.

5. One-board-per-user constraint test
- second board insert for same user fails.

## Approval Request

If this schema is approved, Part 6 will implement:
- DB initialization on startup,
- default user/board seeding,
- board read/update APIs using this payload contract.
