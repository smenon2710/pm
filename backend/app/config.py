from pathlib import Path
from typing import Any

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