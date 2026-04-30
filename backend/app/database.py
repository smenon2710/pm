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