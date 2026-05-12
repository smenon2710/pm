import clsx from "clsx";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import type { Card, Column } from "@/lib/kanban";
import { KanbanCard } from "@/components/KanbanCard";
import { NewCardForm } from "@/components/NewCardForm";

type KanbanColumnProps = {
  column: Column;
  cards: Card[];
  onRename: (columnId: string, title: string) => void;
  onAddCard: (columnId: string, title: string, details: string) => void;
  onDeleteCard: (columnId: string, cardId: string) => void;
};

export const KanbanColumn = ({
  column,
  cards,
  onRename,
  onAddCard,
  onDeleteCard,
}: KanbanColumnProps) => {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <section
      ref={setNodeRef}
      className={clsx(
        "flex min-h-[calc(100vh-130px)] flex-col rounded-2xl border border-[var(--stroke)] bg-white transition",
        isOver && "ring-2 ring-[var(--accent-yellow)]",
      )}
      data-testid={`column-${column.id}`}
    >
      {/* Column header */}
      <div className="shrink-0 border-b border-[var(--stroke)] px-4 pt-4 pb-3">
        <div className="mb-2 flex items-center gap-2">
          <div className="h-1.5 w-8 rounded-full bg-[var(--accent-yellow)]" />
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
            {cards.length}
          </span>
        </div>
        <input
          value={column.title}
          onChange={(event) => onRename(column.id, event.target.value)}
          className="w-full bg-transparent font-display text-sm font-semibold uppercase tracking-[0.1em] text-[var(--navy-dark)] outline-none"
          aria-label="Column title"
        />
      </div>

      {/* Cards */}
      <div className="flex flex-1 flex-col gap-2.5 p-3">
        <SortableContext items={column.cardIds} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <KanbanCard
              key={card.id}
              card={card}
              onDelete={(cardId) => onDeleteCard(column.id, cardId)}
            />
          ))}
        </SortableContext>
        {cards.length === 0 && (
          <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-[var(--stroke)] px-3 py-8 text-center">
            <p className="text-xs font-medium uppercase tracking-[0.15em] text-[var(--stroke)]" style={{ color: "rgba(3,33,71,0.25)" }}>
              Drop here
            </p>
          </div>
        )}
      </div>

      {/* Add card */}
      <div className="shrink-0 border-t border-[var(--stroke)] p-3">
        <NewCardForm
          onAdd={(title, details) => onAddCard(column.id, title, details)}
        />
      </div>
    </section>
  );
};
