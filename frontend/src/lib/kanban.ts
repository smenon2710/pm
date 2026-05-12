export type Card = {
  id: string;
  title: string;
  details: string;
};

export type Column = {
  id: string;
  title: string;
  cardIds: string[];
};

export type BoardData = {
  columns: Column[];
  cards: Record<string, Card>;
};

export const initialData: BoardData = {
  columns: [
    { id: "col-backlog", title: "Backlog", cardIds: ["card-1", "card-2"] },
    { id: "col-discovery", title: "Discovery", cardIds: ["card-3"] },
    {
      id: "col-progress",
      title: "In Progress",
      cardIds: ["card-4", "card-5"],
    },
    { id: "col-review", title: "Review", cardIds: ["card-6"] },
    { id: "col-done", title: "Done", cardIds: ["card-7", "card-8"] },
  ],
  cards: {
    "card-1": {
      id: "card-1",
      title: "Align roadmap themes",
      details: "Draft quarterly themes with impact statements and metrics.",
    },
    "card-2": {
      id: "card-2",
      title: "Gather customer signals",
      details: "Review support tags, sales notes, and churn feedback.",
    },
    "card-3": {
      id: "card-3",
      title: "Prototype analytics view",
      details: "Sketch initial dashboard layout and key drill-downs.",
    },
    "card-4": {
      id: "card-4",
      title: "Refine status language",
      details: "Standardize column labels and tone across the board.",
    },
    "card-5": {
      id: "card-5",
      title: "Design card layout",
      details: "Add hierarchy and spacing for scanning dense lists.",
    },
    "card-6": {
      id: "card-6",
      title: "QA micro-interactions",
      details: "Verify hover, focus, and loading states.",
    },
    "card-7": {
      id: "card-7",
      title: "Ship marketing page",
      details: "Final copy approved and asset pack delivered.",
    },
    "card-8": {
      id: "card-8",
      title: "Close onboarding sprint",
      details: "Document release notes and share internally.",
    },
  },
};

const findColumnId = (columns: Column[], id: string): string | undefined => {
  const direct = columns.find((column) => column.id === id);
  if (direct) {
    return direct.id;
  }
  return columns.find((column) => column.cardIds.includes(id))?.id;
};

export function moveCard(
  columns: Column[],
  activeId: string,
  overId: string,
): Column[] {
  const activeColumnId = findColumnId(columns, activeId);
  const overColumnId = findColumnId(columns, overId);
  if (!activeColumnId || !overColumnId) {
    return columns;
  }

  const activeColumn = columns.find((column) => column.id === activeColumnId)!;
  const overColumn = columns.find((column) => column.id === overColumnId)!;
  const droppingOnColumn = overId === overColumnId;

  if (activeColumnId === overColumnId) {
    const oldIndex = activeColumn.cardIds.indexOf(activeId);
    if (oldIndex === -1) {
      return columns;
    }
    const newIndex = droppingOnColumn
      ? activeColumn.cardIds.length - 1
      : activeColumn.cardIds.indexOf(overId);
    if (newIndex === -1 || oldIndex === newIndex) {
      return columns;
    }
    const nextCardIds = [...activeColumn.cardIds];
    nextCardIds.splice(oldIndex, 1);
    nextCardIds.splice(newIndex, 0, activeId);
    return columns.map((column) =>
      column.id === activeColumnId ? { ...column, cardIds: nextCardIds } : column,
    );
  }

  const nextActiveCardIds = activeColumn.cardIds.filter((id) => id !== activeId);
  const insertIndex = droppingOnColumn
    ? overColumn.cardIds.length
    : Math.max(0, overColumn.cardIds.indexOf(overId));
  const nextOverCardIds = [...overColumn.cardIds];
  nextOverCardIds.splice(insertIndex, 0, activeId);

  return columns.map((column) => {
    if (column.id === activeColumnId) return { ...column, cardIds: nextActiveCardIds };
    if (column.id === overColumnId) return { ...column, cardIds: nextOverCardIds };
    return column;
  });
}

export function createId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36)}`;
}
