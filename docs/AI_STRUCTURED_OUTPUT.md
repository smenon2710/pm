# AI Structured Output Contract (Part 9)

This document defines the backend contract used for AI-driven board updates.

## Endpoint

- `POST /api/ai/board`

Request JSON:

- `username` (string, required)
- `message` (string, required)
- `history` (array, optional; defaults to `[]`)
  - Each item: `{ "role": "user" | "assistant", "content": string }`

Response JSON:

- `assistantMessage` (string)
- `operations` (array of operation objects)
- `board` (full updated board JSON)

## Model Output Schema

The model must return JSON only (no markdown fences) with this shape:

```json
{
  "assistantMessage": "string",
  "operations": [
    {
      "type": "create_card | update_card | move_card",
      "...": "operation-specific fields"
    }
  ]
}
```

Supported operations:

1. `create_card`
   - Required fields: `columnId`, `title`, `details`
   - Optional field: `cardId` (backend generates one if missing)
2. `update_card`
   - Required fields: `cardId`, `title`, `details`
3. `move_card`
   - Required fields: `cardId`, `fromColumnId`, `toColumnId`
   - Optional field: `position` (non-negative integer; append if omitted/invalid)

If no board change is needed, return:

```json
{
  "assistantMessage": "string",
  "operations": []
}
```

## Prompt Context Sent to the Model

The backend includes:

- Current board JSON
- Current user message
- Conversation history
- Required output schema and strict formatting rules

## Validation and Safety Rules

- Backend rejects malformed JSON or schema mismatches.
- Unsupported operation types are rejected.
- Operation fields are validated before apply.
- Board payload is fully revalidated after applying operations.
- Persist happens only after successful full validation.
- If validation fails at any point, no board updates are written to DB.

This guarantees malformed or partial model output cannot corrupt persisted board state.
