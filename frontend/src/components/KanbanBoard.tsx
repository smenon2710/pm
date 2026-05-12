"use client";

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { KanbanColumn } from "@/components/KanbanColumn";
import { KanbanCardPreview } from "@/components/KanbanCardPreview";
import { createId, initialData, moveCard, type BoardData } from "@/lib/kanban";

type KanbanBoardProps = {
  board?: BoardData;
  onBoardChange?: (board: BoardData) => void;
};

export const KanbanBoard = ({ board: controlledBoard, onBoardChange }: KanbanBoardProps) => {
  const [internalBoard, setInternalBoard] = useState<BoardData>(() => initialData);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);

  const board = controlledBoard ?? internalBoard;
  const isControlled = controlledBoard !== undefined && onBoardChange !== undefined;

  const setBoard = (updater: (prev: BoardData) => BoardData) => {
    if (isControlled) {
      onBoardChange!(updater(controlledBoard!));
      return;
    }
    setInternalBoard(updater);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveCardId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCardId(null);
    if (!over || active.id === over.id) {
      return;
    }
    setBoard((prev) => ({
      ...prev,
      columns: moveCard(prev.columns, active.id as string, over.id as string),
    }));
  };

  const handleRenameColumn = (columnId: string, title: string) => {
    setBoard((prev) => ({
      ...prev,
      columns: prev.columns.map((column) =>
        column.id === columnId ? { ...column, title } : column,
      ),
    }));
  };

  const handleAddCard = (columnId: string, title: string, details: string) => {
    const id = createId("card");
    setBoard((prev) => ({
      ...prev,
      cards: { ...prev.cards, [id]: { id, title, details: details || "No details yet." } },
      columns: prev.columns.map((column) =>
        column.id === columnId ? { ...column, cardIds: [...column.cardIds, id] } : column,
      ),
    }));
  };

  const handleDeleteCard = (columnId: string, cardId: string) => {
    setBoard((prev) => ({
      ...prev,
      cards: Object.fromEntries(Object.entries(prev.cards).filter(([id]) => id !== cardId)),
      columns: prev.columns.map((column) =>
        column.id === columnId
          ? { ...column, cardIds: column.cardIds.filter((id) => id !== cardId) }
          : column,
      ),
    }));
  };

  const activeCard = activeCardId ? board.cards[activeCardId] : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div
        className="grid gap-4 p-5"
        style={{ gridTemplateColumns: `repeat(${board.columns.length}, minmax(0, 1fr))` }}
      >
        {board.columns.map((column) => (
          <KanbanColumn
            key={column.id}
            column={column}
            cards={column.cardIds.map((cardId) => board.cards[cardId])}
            onRename={handleRenameColumn}
            onAddCard={handleAddCard}
            onDeleteCard={handleDeleteCard}
          />
        ))}
      </div>
      <DragOverlay>
        {activeCard ? (
          <div className="w-64">
            <KanbanCardPreview card={activeCard} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};
