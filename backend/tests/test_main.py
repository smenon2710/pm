from pathlib import Path
import sys
import sqlite3

from fastapi.testclient import TestClient

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.main import create_app


def test_health(tmp_path: Path) -> None:
    app = create_app(tmp_path / "test.db")
    client = TestClient(app)
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_index_contains_health_fetch(tmp_path: Path) -> None:
    app = create_app(tmp_path / "test.db")
    client = TestClient(app)
    response = client.get("/")
    assert response.status_code == 200
    assert "<html" in response.text.lower()


def test_startup_creates_tables_and_seed_records(tmp_path: Path) -> None:
    db_path = tmp_path / "test.db"
    app = create_app(db_path)
    with TestClient(app):
        pass
    with sqlite3.connect(db_path) as conn:
        user_count = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        board_count = conn.execute("SELECT COUNT(*) FROM boards").fetchone()[0]
    assert user_count >= 1
    assert board_count >= 1


def test_get_board_for_default_user(tmp_path: Path) -> None:
    app = create_app(tmp_path / "test.db")
    with TestClient(app) as client:
        response = client.get("/api/board")
        assert response.status_code == 200
        data = response.json()
        assert data["username"] == "user"
        assert "columns" in data["board"]
        assert "cards" in data["board"]


def test_put_board_updates_board_payload(tmp_path: Path) -> None:
    app = create_app(tmp_path / "test.db")
    with TestClient(app) as client:
        initial = client.get("/api/board").json()["board"]
        initial["columns"][0]["title"] = "Renamed in test"
        response = client.put("/api/board", json={"username": "user", "board": initial})
        assert response.status_code == 200
        updated = client.get("/api/board").json()["board"]
        assert updated["columns"][0]["title"] == "Renamed in test"


def test_put_board_rejects_unknown_card_reference(tmp_path: Path) -> None:
    app = create_app(tmp_path / "test.db")
    with TestClient(app) as client:
        board = client.get("/api/board").json()["board"]
        board["columns"][0]["cardIds"].append("card-does-not-exist")
        response = client.put("/api/board", json={"username": "user", "board": board})
        assert response.status_code == 400
        assert "unknown card id" in response.json()["detail"].lower()


def test_put_board_rejects_duplicate_card_assignment(tmp_path: Path) -> None:
    app = create_app(tmp_path / "test.db")
    with TestClient(app) as client:
        board = client.get("/api/board").json()["board"]
        existing_card = board["columns"][0]["cardIds"][0]
        board["columns"][1]["cardIds"].append(existing_card)
        response = client.put("/api/board", json={"username": "user", "board": board})
        assert response.status_code == 400
        assert "multiple columns" in response.json()["detail"].lower()


def test_ai_smoke_success(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")

    def fake_completion(prompt: str, api_key: str, timeout_seconds: float = 15.0) -> str:
        assert prompt == "2+2"
        assert api_key == "test-key"
        assert timeout_seconds == 15.0
        return "4"

    monkeypatch.setattr("app.main.request_openrouter_completion", fake_completion)
    app = create_app(tmp_path / "test.db")
    with TestClient(app) as client:
        response = client.get("/api/ai/smoke")
        assert response.status_code == 200
        assert response.json() == {"ok": True, "prompt": "2+2", "response": "4"}


def test_ai_smoke_missing_api_key(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    app = create_app(tmp_path / "test.db")
    with TestClient(app) as client:
        response = client.get("/api/ai/smoke")
        assert response.status_code == 500
        assert "not configured" in response.json()["detail"].lower()


def test_ai_smoke_openrouter_non_200(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")

    def failing_completion(prompt: str, api_key: str, timeout_seconds: float = 15.0) -> str:
        raise RuntimeError("OpenRouter request failed with status 401.")

    monkeypatch.setattr("app.main.request_openrouter_completion", failing_completion)
    app = create_app(tmp_path / "test.db")
    with TestClient(app) as client:
        response = client.get("/api/ai/smoke")
        assert response.status_code == 502
        assert "status 401" in response.json()["detail"].lower()


def test_ai_smoke_openrouter_timeout(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")

    def timeout_completion(prompt: str, api_key: str, timeout_seconds: float = 15.0) -> str:
        raise RuntimeError("OpenRouter request timed out.")

    monkeypatch.setattr("app.main.request_openrouter_completion", timeout_completion)
    app = create_app(tmp_path / "test.db")
    with TestClient(app) as client:
        response = client.get("/api/ai/smoke")
        assert response.status_code == 502
        assert "timed out" in response.json()["detail"].lower()
