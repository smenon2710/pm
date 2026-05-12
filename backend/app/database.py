import json
import sqlite3
from pathlib import Path
from typing import Any

from .config import DEFAULT_USERNAME, DEFAULT_PASSWORD_HASH, INITIAL_BOARD_DATA


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
              user_id INTEGER NOT NULL,
              title TEXT NOT NULL DEFAULT 'My Board',
              schema_version INTEGER NOT NULL DEFAULT 1,
              board_json TEXT NOT NULL,
              created_at TEXT NOT NULL DEFAULT (datetime('now')),
              updated_at TEXT NOT NULL DEFAULT (datetime('now')),
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
            """
        )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_boards_user_id ON boards(user_id)")
        conn.execute("DROP INDEX IF EXISTS boards_user_id")
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
            board_count = conn.execute(
                "SELECT COUNT(*) FROM boards WHERE user_id = ?", (user_id_row[0],)
            ).fetchone()[0]
            if board_count == 0:
                conn.execute(
                    """
                    INSERT INTO boards (user_id, title, board_json, schema_version)
                    VALUES (?, 'My Board', ?, 1)
                    """,
                    (user_id_row[0], json.dumps(INITIAL_BOARD_DATA)),
                )
        conn.commit()


def load_board_for_user(db_path: Path, username: str, board_id: int | None = None) -> dict[str, Any] | None:
    with sqlite3.connect(db_path) as conn:
        if board_id is not None:
            row = conn.execute(
                """
                SELECT b.board_json
                FROM boards b
                JOIN users u ON u.id = b.user_id
                WHERE u.username = ? AND b.id = ?
                """,
                (username, board_id),
            ).fetchone()
        else:
            row = conn.execute(
                """
                SELECT b.board_json
                FROM boards b
                JOIN users u ON u.id = b.user_id
                WHERE u.username = ?
                ORDER BY b.id ASC
                LIMIT 1
                """,
                (username,),
            ).fetchone()
    if row is None:
        return None
    return json.loads(row[0])


def save_board_for_user(db_path: Path, username: str, board: dict[str, Any], board_id: int | None = None) -> bool:
    with sqlite3.connect(db_path) as conn:
        user_row = conn.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
        if user_row is None:
            return False
        if board_id is not None:
            updated = conn.execute(
                """
                UPDATE boards
                SET board_json = ?, updated_at = datetime('now')
                WHERE user_id = ? AND id = ?
                """,
                (json.dumps(board), user_row[0], board_id),
            )
        else:
            updated = conn.execute(
                """
                UPDATE boards
                SET board_json = ?, updated_at = datetime('now')
                WHERE user_id = ? AND id = (
                    SELECT id FROM boards WHERE user_id = ? ORDER BY id ASC LIMIT 1
                )
                """,
                (json.dumps(board), user_row[0], user_row[0]),
            )
        conn.commit()
    return updated.rowcount > 0


def list_boards_for_user(db_path: Path, username: str) -> list[dict[str, Any]]:
    with sqlite3.connect(db_path) as conn:
        rows = conn.execute(
            """
            SELECT b.id, b.title, b.updated_at
            FROM boards b
            JOIN users u ON u.id = b.user_id
            WHERE u.username = ?
            ORDER BY b.id ASC
            """,
            (username,),
        ).fetchall()
    return [{"id": row[0], "title": row[1], "updated_at": row[2]} for row in rows]


BLANK_BOARD_DATA: dict[str, Any] = {
    "columns": [
        {"id": "col-1", "title": "To Do", "cardIds": []},
        {"id": "col-2", "title": "In Progress", "cardIds": []},
        {"id": "col-3", "title": "Done", "cardIds": []},
    ],
    "cards": {},
}


def create_board_for_user(db_path: Path, username: str, title: str = "My Board") -> dict[str, Any] | None:
    with sqlite3.connect(db_path) as conn:
        user_row = conn.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
        if user_row is None:
            return None
        cursor = conn.execute(
            """
            INSERT INTO boards (user_id, title, board_json, schema_version)
            VALUES (?, ?, ?, 1)
            """,
            (user_row[0], title, json.dumps(BLANK_BOARD_DATA)),
        )
        conn.commit()
        board_id = cursor.lastrowid
        return {"id": board_id, "title": title, "board": BLANK_BOARD_DATA}


def delete_board_for_user(db_path: Path, username: str, board_id: int) -> bool:
    with sqlite3.connect(db_path) as conn:
        user_row = conn.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
        if user_row is None:
            return False
        board_count = conn.execute(
            "SELECT COUNT(*) FROM boards WHERE user_id = ?", (user_row[0],)
        ).fetchone()[0]
        if board_count <= 1:
            return False
        deleted = conn.execute(
            "DELETE FROM boards WHERE id = ? AND user_id = ?",
            (board_id, user_row[0]),
        )
        conn.commit()
    return deleted.rowcount > 0


def rename_board_for_user(db_path: Path, username: str, board_id: int, title: str) -> bool:
    with sqlite3.connect(db_path) as conn:
        user_row = conn.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
        if user_row is None:
            return False
        updated = conn.execute(
            "UPDATE boards SET title = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?",
            (title, board_id, user_row[0]),
        )
        conn.commit()
    return updated.rowcount > 0