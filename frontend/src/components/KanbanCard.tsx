import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import type { Card } from "@/lib/kanban";

type KanbanCardProps = {
  card: Card;
  onDelete: (cardId: string) => void;
};

export const KanbanCard = ({ card, onDelete }: KanbanCardProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={clsx(
        "group rounded-xl border border-[var(--stroke)] bg-white px-3.5 py-3 shadow-[0_2px_8px_rgba(3,33,71,0.06)]",
        "cursor-grab transition-all duration-150 hover:border-[var(--primary-blue)]/30 hover:shadow-[0_4px_16px_rgba(3,33,71,0.10)]",
        isDragging && "cursor-grabbing opacity-50 shadow-[0_12px_32px_rgba(3,33,71,0.18)]",
      )}
      {...attributes}
      {...listeners}
      data-testid={`card-${card.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h4 className="font-display text-sm font-semibold leading-snug text-[var(--navy-dark)]">
            {card.title}
          </h4>
          {card.details && (
            <p className="mt-1.5 text-xs leading-5 text-[var(--gray-text)]">
              {card.details}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => onDelete(card.id)}
          className="mt-0.5 shrink-0 rounded-md p-1 text-[var(--stroke)] opacity-0 transition hover:bg-[var(--surface)] hover:text-[var(--gray-text)] group-hover:opacity-100"
          aria-label={`Delete ${card.title}`}
          style={{ color: "rgba(3,33,71,0.25)" }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M9 3L3 9M3 3l6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
    </article>
  );
};
