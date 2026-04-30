import json
import uuid
from copy import deepcopy
from typing import Any
from urllib import error, request

from .config import validate_board_payload


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
    text_content = _extract_message_text(content)
    if not text_content:
        raise RuntimeError("OpenRouter response did not include message content.")
    return text_content


def _extract_message_text(content: Any) -> str:
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        chunks: list[str] = []
        for item in content:
            if isinstance(item, dict):
                text_value = item.get("text")
                if isinstance(text_value, str) and text_value.strip():
                    chunks.append(text_value.strip())
        return "\n".join(chunks).strip()
    return ""


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
    cleaned_content = content.strip()
    if cleaned_content.startswith("```"):
        parts = cleaned_content.split("```")
        if len(parts) >= 3:
            cleaned_content = parts[1]
            if cleaned_content.lower().startswith("json"):
                cleaned_content = cleaned_content[4:]
            cleaned_content = cleaned_content.strip()
    try:
        parsed = json.loads(cleaned_content)
    except json.JSONDecodeError as exc:
        start = cleaned_content.find("{")
        end = cleaned_content.rfind("}")
        if start == -1 or end == -1 or start >= end:
            raise RuntimeError("Model response was not valid JSON.") from exc
        try:
            parsed = json.loads(cleaned_content[start : end + 1])
        except json.JSONDecodeError as inner_exc:
            raise RuntimeError("Model response was not valid JSON.") from inner_exc
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
        raise RuntimeError(f"Model operations produce invalid board: {error_detail}")
    return updated