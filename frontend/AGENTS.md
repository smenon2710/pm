# Frontend Codebase Guide

This document describes the current frontend implementation in `frontend/`.

## Purpose

- Next.js app that renders an auth-gated, backend-persisted Kanban board with AI chat + voice controls.
- Current state is integrated with backend APIs for board persistence and AI-driven board updates.
- Includes unit tests (Vitest + Testing Library) and e2e tests (Playwright).

## Tech Stack

- Framework: Next.js 16 (App Router), React 19, TypeScript
- Styling: Tailwind CSS 4 + custom CSS variables in `src/app/globals.css`
- Drag and drop: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`
- Testing:
  - Unit/integration: Vitest, Testing Library, jsdom
  - Browser e2e: Playwright

## Run and Test Commands

- Install: `npm install`
- Dev server: `npm run dev`
- Build: `npm run build`
- Unit tests: `npm run test:unit`
- E2E tests: `npm run test:e2e`
- Full suite: `npm run test:all`

## Structure Overview

- `src/app/page.tsx`
  - Renders login gate, board container, AI sidebar chat, and voice controls.
- `src/components/KanbanBoard.tsx`
  - Top-level board state and interaction orchestration.
- `src/components/KanbanColumn.tsx`
  - Column container, title editing, per-column card rendering and add flow.
- `src/components/KanbanCard.tsx`
  - Sortable card item with delete action.
- `src/components/NewCardForm.tsx`
  - Expand/collapse form for adding cards.
- `src/components/KanbanCardPreview.tsx`
  - Drag overlay preview card UI.
- `src/lib/kanban.ts`
  - Board data types, seed data, card move logic, and ID generator.
- `src/components/KanbanBoard.test.tsx`
  - UI behavior tests for render/rename/add/delete.
- `src/lib/kanban.test.ts`
  - Move logic unit tests.
- `tests/kanban.spec.ts`
  - Playwright e2e scenario(s).

## Current Behavior

- Initial board loads from backend after login (`GET /api/board`).
- Board edits persist to backend (`PUT /api/board`).
- Fixed five columns are displayed by default (from seeded board JSON).
- User can:
  - rename column titles inline
  - drag and drop cards within/across columns
  - add a new card to a column
  - remove an existing card
- AI sidebar can submit typed commands to backend AI endpoint (`POST /api/ai/board`).
- Voice controls can capture transcript, preview command text, and resend recent command.
- Changes persist across reload through backend persistence.
- Multi-board support: board selector in header allows creating, switching, and deleting boards.

## Data Model (Current)

- `Card`: `{ id, title, details }`
- `Column`: `{ id, title, cardIds[] }`
- `BoardData`: `{ columns[], cards }` shape represented as:
  - `columns: Column[]`
  - `cards: Record<string, Card>`

## Integration Notes

- Board save uses immediate UI update followed by backend persistence sync.
- AI and voice command flows share the same backend endpoint and board update application path.
- Existing unit + e2e tests cover typed chat, voice command flows, and drag-and-drop regressions.
