import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from .ai import (
    apply_board_operations,
    build_ai_board_prompt,
    parse_ai_structured_output,
    request_openrouter_completion,
)
from .config import DEFAULT_DB_PATH, DEFAULT_USERNAME, validate_board_payload
from .database import (
    create_board_for_user,
    delete_board_for_user,
    init_db,
    list_boards_for_user,
    load_board_for_user,
    rename_board_for_user,
    save_board_for_user,
)


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
    def get_board(
        username: str = Query(default=DEFAULT_USERNAME),
        board_id: int | None = Query(default=None),
    ) -> dict[str, Any]:
        board = load_board_for_user(resolved_db_path, username, board_id)
        if board is None:
            raise HTTPException(status_code=404, detail="Board not found.")
        return {"username": username, "board": board}

    @app.put("/api/board")
    def put_board(payload: dict[str, Any]) -> dict[str, Any]:
        username = payload.get("username")
        board = payload.get("board")
        board_id = payload.get("board_id")
        if not isinstance(username, str) or not username:
            raise HTTPException(status_code=400, detail="username is required.")
        is_valid, detail = validate_board_payload(board)
        if not is_valid:
            raise HTTPException(status_code=400, detail=detail)
        if not save_board_for_user(resolved_db_path, username, board, board_id):
            raise HTTPException(status_code=404, detail="Board not found.")
        return {"ok": True}

    @app.get("/api/boards")
    def get_boards(username: str = Query(default=DEFAULT_USERNAME)) -> dict[str, Any]:
        boards = list_boards_for_user(resolved_db_path, username)
        return {"boards": boards}

    @app.post("/api/boards")
    def post_boards(payload: dict[str, Any]) -> dict[str, Any]:
        username = payload.get("username")
        title = payload.get("title", "My Board")
        if not isinstance(username, str) or not username:
            raise HTTPException(status_code=400, detail="username is required.")
        if not isinstance(title, str):
            raise HTTPException(status_code=400, detail="title must be a string.")
        result = create_board_for_user(resolved_db_path, username, title)
        if result is None:
            raise HTTPException(status_code=404, detail="User not found.")
        return result

    @app.delete("/api/boards/{board_id}")
    def delete_board(
        board_id: int,
        username: str = Query(default=DEFAULT_USERNAME),
    ) -> dict[str, Any]:
        if not delete_board_for_user(resolved_db_path, username, board_id):
            raise HTTPException(status_code=400, detail="Cannot delete the last board.")
        return {"ok": True}

    @app.put("/api/boards/{board_id}")
    def put_board_rename(
        board_id: int,
        payload: dict[str, Any],
        username: str = Query(default=DEFAULT_USERNAME),
    ) -> dict[str, Any]:
        title = payload.get("title")
        if not isinstance(title, str) or not title:
            raise HTTPException(status_code=400, detail="title is required.")
        if not rename_board_for_user(resolved_db_path, username, board_id, title):
            raise HTTPException(status_code=404, detail="Board not found.")
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
        board_id = payload.get("board_id")
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

        board = load_board_for_user(resolved_db_path, username, board_id)
        if board is None:
            raise HTTPException(status_code=404, detail="Board not found.")

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

        if operations and not save_board_for_user(resolved_db_path, username, updated_board, board_id):
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
            return "<html><body><h1>Frontend assets not built yet</h1></body></html>"

    return app


app = create_app()