import json
import os
import sqlite3
import uuid
from contextlib import asynccontextmanager
from copy import deepcopy
from pathlib import Path
from typing import Any
from urllib import error, request

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


def request_openrouter_completion(prompt: str, api_key: str, timeout_seconds: float = 15.0) -> str:
    body = json.dumps(
        {
            "model": "openai/gpt-oss-120b",
            "messages": [{"role": "user", "content": prompt}],
        }
    ).encode("utf-8")
    req = request.Request(
        "https://openrouter.ai/api/v1/chat/completions",
        data=body,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with request.urlopen(req, timeout=timeout_seconds) as response:
            response_body = response.read().decode("utf-8")
    except error.HTTPError as exc:
        raise RuntimeError(
            f"OpenRouter request failed with status {exc.code}."
        ) from exc
    except error.URLError as exc:
        raise RuntimeError("OpenRouter request failed due to network error.") from exc
    except TimeoutError as exc:
        raise RuntimeError("OpenRouter request timed out.") from exc

    parsed = json.loads(response_body)
    choices = parsed.get("choices")
    if not isinstance(choices, list) or not choices:
        raise RuntimeError("OpenRouter response did not include choices.")
    message = choices[0].get("message") if isinstance(choices[0], dict) else None
    content = message.get("content") if isinstance(message, dict) else None
    if not isinstance(content, str) or not content.strip():
        raise RuntimeError("OpenRouter response did not include message content.")
    return content.strip()


def build_ai_board_prompt(
    board: dict[str, Any], user_message: str, history: list[dict[str, str]]
) -> str:
    prompt_payload = {
        "task": "Return only valid JSON matching the required schema.",
        "required_schema": {
            "assistantMessage": "string",
            "operations": [
                {
                    "type": "create_card|update_card|move_card",
                    "cardId": "string",
                    "title": "string (create/update only)",
                    "details": "string (create/update only)",
                    "columnId": "string (create only)",
                    "fromColumnId": "string (move only)",
                    "toColumnId": "string (move only)",
                    "position": "integer >= 0 (move only, optional)",
                }
            ],
        },
        "rules": [
            "Do not include markdown fences.",
            "If no board mutation is needed, return operations as an empty list.",
            "Only use existing column ids.",
            "For update_card, include title and details values to set.",
            "For move_card, cardId must already exist.",
        ],
        "conversationHistory": history,
        "currentBoard": board,
        "userMessage": user_message,
    }
    return json.dumps(prompt_payload)


def parse_ai_structured_output(content: str) -> tuple[str, list[dict[str, Any]]]:
    try:
        parsed = json.loads(content)
    except json.JSONDecodeError as exc:
        raise RuntimeError("Model response was not valid JSON.") from exc
    if not isinstance(parsed, dict):
        raise RuntimeError("Model response must be a JSON object.")
    assistant_message = parsed.get("assistantMessage")
    operations = parsed.get("operations")
    if not isinstance(assistant_message, str) or not assistant_message.strip():
        raise RuntimeError("Model response must include assistantMessage string.")
    if not isinstance(operations, list):
        raise RuntimeError("Model response must include operations array.")
    for operation in operations:
        if not isinstance(operation, dict):
            raise RuntimeError("Each operation must be an object.")
        op_type = operation.get("type")
        if op_type not in {"create_card", "update_card", "move_card"}:
            raise RuntimeError(f"Unsupported operation type: {op_type}.")
    return assistant_message.strip(), operations


def _require_string_field(operation: dict[str, Any], field: str, op_type: str) -> str:
    value = operation.get(field)
    if not isinstance(value, str) or not value:
        raise RuntimeError(f"{op_type} requires non-empty string field {field}.")
    return value


def apply_board_operations(board: dict[str, Any], operations: list[dict[str, Any]]) -> dict[str, Any]:
    updated = deepcopy(board)
    columns: list[dict[str, Any]] = updated.get("columns", [])
    cards: dict[str, dict[str, str]] = updated.get("cards", {})
    column_by_id: dict[str, dict[str, Any]] = {
        col["id"]: col for col in columns if isinstance(col, dict) and isinstance(col.get("id"), str)
    }
    for operation in operations:
        op_type = operation["type"]
        if op_type == "create_card":
            card_id = operation.get("cardId")
            if not isinstance(card_id, str) or not card_id:
                card_id = f"card-{uuid.uuid4().hex[:8]}"
            if card_id in cards:
                raise RuntimeError(f"create_card target already exists: {card_id}.")
            column_id = _require_string_field(operation, "columnId", op_type)
            target_column = column_by_id.get(column_id)
            if target_column is None:
                raise RuntimeError(f"create_card references unknown columnId {column_id}.")
            title = _require_string_field(operation, "title", op_type)
            details = _require_string_field(operation, "details", op_type)
            cards[card_id] = {"id": card_id, "title": title, "details": details}
            target_column["cardIds"].append(card_id)
            continue

        card_id = _require_string_field(operation, "cardId", op_type)
        card = cards.get(card_id)
        if card is None:
            raise RuntimeError(f"{op_type} references unknown cardId {card_id}.")

        if op_type == "update_card":
            title = _require_string_field(operation, "title", op_type)
            details = _require_string_field(operation, "details", op_type)
            card["title"] = title
            card["details"] = details
            continue

        if op_type == "move_card":
            from_column_id = _require_string_field(operation, "fromColumnId", op_type)
            to_column_id = _require_string_field(operation, "toColumnId", op_type)
            from_column = column_by_id.get(from_column_id)
            to_column = column_by_id.get(to_column_id)
            if from_column is None or to_column is None:
                raise RuntimeError("move_card references unknown from/to column id.")
            if card_id not in from_column["cardIds"]:
                raise RuntimeError(f"move_card cardId {card_id} is not in {from_column_id}.")
            from_column["cardIds"].remove(card_id)
            position = operation.get("position")
            if not isinstance(position, int) or position < 0 or position > len(to_column["cardIds"]):
                to_column["cardIds"].append(card_id)
            else:
                to_column["cardIds"].insert(position, card_id)
            continue

    is_valid, error_detail = validate_board_payload(updated)
    if not is_valid:
        raise RuntimeError(f"Model operations produced invalid board: {error_detail}")
    return updated


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

    @app.get("/api/ai/smoke")
    def ai_smoke() -> dict[str, Any]:
        api_key = os.getenv("OPENROUTER_API_KEY", "").strip()
        if not api_key:
            raise HTTPException(
                status_code=500,
                detail="OPENROUTER_API_KEY is not configured.",
            )
        try:
            completion = request_openrouter_completion(prompt="2+2", api_key=api_key)
        except RuntimeError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc
        return {"ok": True, "prompt": "2+2", "response": completion}

    @app.post("/api/ai/board")
    def ai_board(payload: dict[str, Any]) -> dict[str, Any]:
        username = payload.get("username")
        user_message = payload.get("message")
        history = payload.get("history", [])
        if not isinstance(username, str) or not username:
            raise HTTPException(status_code=400, detail="username is required.")
        if not isinstance(user_message, str) or not user_message.strip():
            raise HTTPException(status_code=400, detail="message is required.")
        if not isinstance(history, list):
            raise HTTPException(status_code=400, detail="history must be an array.")
        for item in history:
            if not isinstance(item, dict):
                raise HTTPException(status_code=400, detail="history items must be objects.")
            role = item.get("role")
            content = item.get("content")
            if role not in {"user", "assistant"} or not isinstance(content, str):
                raise HTTPException(
                    status_code=400,
                    detail="history items must include role (user|assistant) and string content.",
                )

        board = load_board_for_user(resolved_db_path, username)
        if board is None:
            raise HTTPException(status_code=404, detail="Board not found for user.")

        api_key = os.getenv("OPENROUTER_API_KEY", "").strip()
        if not api_key:
            raise HTTPException(status_code=500, detail="OPENROUTER_API_KEY is not configured.")

        prompt = build_ai_board_prompt(board=board, user_message=user_message, history=history)
        try:
            completion = request_openrouter_completion(prompt=prompt, api_key=api_key)
            assistant_message, operations = parse_ai_structured_output(completion)
            updated_board = apply_board_operations(board, operations)
        except RuntimeError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc

        if operations and not save_board_for_user(resolved_db_path, username, updated_board):
            raise HTTPException(status_code=404, detail="Board not found for user.")

        return {
            "assistantMessage": assistant_message,
            "operations": operations,
            "board": updated_board,
        }

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
