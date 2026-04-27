import json
import os
import sqlite3
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

DEFAULT_USERNAME = "user"
DEFAULT_PASSWORD_HASH = "mvp-user-password-placeholder"
DEFAULT_DB_PATH = Path(__file__).resolve().parents[2] / "data" / "pm.db"

INITIAL_BOARD_DATA: dict[str, Any] = {
    "columns": [
        {"id": "col-backlog", "title": "Backlog", "cardIds": ["card-1", "card-2"]},
        {"id": "col-discovery", "title": "Discovery", "cardIds": ["card-3"]},
        {
            "id": "col-progress",
            "title": "In Progress",
            "cardIds": ["card-4", "card-5"],
        },
        {"id": "col-review", "title": "Review", "cardIds": ["card-6"]},
        {"id": "col-done", "title": "Done", "cardIds": ["card-7", "card-8"]},
    ],
    "cards": {
        "card-1": {
            "id": "card-1",
            "title": "Align roadmap themes",
            "details": "Draft quarterly themes with impact statements and metrics.",
        },
        "card-2": {
            "id": "card-2",
            "title": "Gather customer signals",
            "details": "Review support tags, sales notes, and churn feedback.",
        },
        "card-3": {
            "id": "card-3",
            "title": "Prototype analytics view",
            "details": "Sketch initial dashboard layout and key drill-downs.",
        },
        "card-4": {
            "id": "card-4",
            "title": "Refine status language",
            "details": "Standardize column labels and tone across the board.",
        },
        "card-5": {
            "id": "card-5",
            "title": "Design card layout",
            "details": "Add hierarchy and spacing for scanning dense lists.",
        },
        "card-6": {
            "id": "card-6",
            "title": "QA micro-interactions",
            "details": "Verify hover, focus, and loading states.",
        },
        "card-7": {
            "id": "card-7",
            "title": "Ship marketing page",
            "details": "Final copy approved and asset pack delivered.",
        },
        "card-8": {
            "id": "card-8",
            "title": "Close onboarding sprint",
            "details": "Document release notes and share internally.",
        },
    },
}


def validate_board_payload(board: Any) -> tuple[bool, str]:
    if not isinstance(board, dict):
        return False, "Board payload must be a JSON object."
    columns = board.get("columns")
    cards = board.get("cards")
    if not isinstance(columns, list):
        return False, "Board payload must include columns as an array."
    if not isinstance(cards, dict):
        return False, "Board payload must include cards as an object."

    card_ids = set(cards.keys())
    for card_id, card in cards.items():
        if not isinstance(card, dict):
            return False, f"Card {card_id} must be an object."
        if card.get("id") != card_id:
            return False, f"Card {card_id} has mismatched id field."
        if not isinstance(card.get("title"), str) or not isinstance(card.get("details"), str):
            return False, f"Card {card_id} title/details must be strings."

    seen_columns: set[str] = set()
    assigned_cards: set[str] = set()
    for column in columns:
        if not isinstance(column, dict):
            return False, "Each column must be an object."
        column_id = column.get("id")
        title = column.get("title")
        col_card_ids = column.get("cardIds")
        if not isinstance(column_id, str) or not column_id:
            return False, "Each column must have a non-empty string id."
        if column_id in seen_columns:
            return False, f"Duplicate column id: {column_id}."
        seen_columns.add(column_id)
        if not isinstance(title, str):
            return False, f"Column {column_id} title must be a string."
        if not isinstance(col_card_ids, list):
            return False, f"Column {column_id} cardIds must be an array."
        for card_id in col_card_ids:
            if not isinstance(card_id, str):
                return False, f"Column {column_id} contains non-string card id."
            if card_id not in card_ids:
                return False, f"Column {column_id} references unknown card id {card_id}."
            if card_id in assigned_cards:
                return False, f"Card {card_id} is assigned to multiple columns."
            assigned_cards.add(card_id)

    return True, ""


def init_db(db_path: Path) -> None:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(db_path) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              username TEXT NOT NULL UNIQUE,
              password_hash TEXT NOT NULL,
              created_at TEXT NOT NULL DEFAULT (datetime('now')),
              updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS boards (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL UNIQUE,
              title TEXT NOT NULL DEFAULT 'My Board',
              schema_version INTEGER NOT NULL DEFAULT 1,
              board_json TEXT NOT NULL,
              created_at TEXT NOT NULL DEFAULT (datetime('now')),
              updated_at TEXT NOT NULL DEFAULT (datetime('now')),
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
            """
        )
        conn.execute(
            """
            INSERT INTO users (username, password_hash)
            VALUES (?, ?)
            ON CONFLICT(username) DO NOTHING
            """,
            (DEFAULT_USERNAME, DEFAULT_PASSWORD_HASH),
        )
        user_id_row = conn.execute(
            "SELECT id FROM users WHERE username = ?", (DEFAULT_USERNAME,)
        ).fetchone()
        if user_id_row is not None:
            conn.execute(
                """
                INSERT INTO boards (user_id, board_json, schema_version)
                VALUES (?, ?, 1)
                ON CONFLICT(user_id) DO NOTHING
                """,
                (user_id_row[0], json.dumps(INITIAL_BOARD_DATA)),
            )
        conn.commit()


def load_board_for_user(db_path: Path, username: str) -> dict[str, Any] | None:
    with sqlite3.connect(db_path) as conn:
        row = conn.execute(
            """
            SELECT b.board_json
            FROM boards b
            JOIN users u ON u.id = b.user_id
            WHERE u.username = ?
            """,
            (username,),
        ).fetchone()
    if row is None:
        return None
    return json.loads(row[0])


def save_board_for_user(db_path: Path, username: str, board: dict[str, Any]) -> bool:
    with sqlite3.connect(db_path) as conn:
        user_row = conn.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
        if user_row is None:
            return False
        updated = conn.execute(
            """
            UPDATE boards
            SET board_json = ?, updated_at = datetime('now')
            WHERE user_id = ?
            """,
            (json.dumps(board), user_row[0]),
        )
        conn.commit()
    return updated.rowcount > 0


def create_app(db_path: Path | None = None) -> FastAPI:
    resolved_db_path = db_path or Path(os.getenv("PM_DB_PATH", str(DEFAULT_DB_PATH)))

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        init_db(resolved_db_path)
        yield

    app = FastAPI(title="PM MVP Backend", lifespan=lifespan)

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/api/board")
    def get_board(username: str = Query(default=DEFAULT_USERNAME)) -> dict[str, Any]:
        board = load_board_for_user(resolved_db_path, username)
        if board is None:
            raise HTTPException(status_code=404, detail="Board not found for user.")
        return {"username": username, "board": board}

    @app.put("/api/board")
    def put_board(payload: dict[str, Any]) -> dict[str, Any]:
        username = payload.get("username")
        board = payload.get("board")
        if not isinstance(username, str) or not username:
            raise HTTPException(status_code=400, detail="username is required.")
        is_valid, error = validate_board_payload(board)
        if not is_valid:
            raise HTTPException(status_code=400, detail=error)
        if not save_board_for_user(resolved_db_path, username, board):
            raise HTTPException(status_code=404, detail="Board not found for user.")
        return {"ok": True}

    frontend_dir = Path(__file__).resolve().parents[2] / "frontend" / "out"

    if frontend_dir.exists():
        app.mount("/", StaticFiles(directory=str(frontend_dir), html=True), name="frontend")
    else:

        @app.get("/", response_class=HTMLResponse)
        def index() -> str:
            return """<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>PM MVP Backend</title>
  </head>
  <body>
    <main>
      <h1>Frontend assets not built yet</h1>
      <p>Build frontend export to serve Kanban board at /.</p>
    </main>
  </body>
</html>
"""

    return app


app = create_app()
