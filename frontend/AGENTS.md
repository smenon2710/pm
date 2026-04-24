# Frontend Codebase Guide

This document describes the existing frontend-only implementation in `frontend/`.

## Purpose

- Next.js app that renders a single-page Kanban board demo.
- Current state is purely client-side and in-memory (no backend persistence yet).
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
  - Renders `<KanbanBoard />` as the home page.
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

- Board initializes from `initialData` in `src/lib/kanban.ts`.
- Fixed five columns are displayed by default.
- User can:
  - rename column titles inline
  - drag and drop cards within/across columns
  - add a new card to a column
  - remove an existing card
- All changes are local to runtime memory and reset on refresh.

## Data Model (Current)

- `Card`: `{ id, title, details }`
- `Column`: `{ id, title, cardIds[] }`
- `BoardData`: `{ columns[], cardsById }` shape represented as:
  - `columns: Column[]`
  - `cards: Record<string, Card>`

## Notes for Future Integration

- Frontend currently assumes immediate local state updates.
- Backend integration should preserve existing interaction behavior while replacing the in-memory source with API-backed persistence.
- Existing tests provide a base for regression checks during integration phases.
