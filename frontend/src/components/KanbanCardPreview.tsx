import type { Card } from "@/lib/kanban";

type KanbanCardPreviewProps = {
  card: Card;
};

export const KanbanCardPreview = ({ card }: KanbanCardPreviewProps) => (
  <article className="rounded-xl border border-[var(--primary-blue)]/30 bg-white px-3.5 py-3 shadow-[0_12px_32px_rgba(3,33,71,0.18)]">
    <h4 className="font-display text-sm font-semibold leading-snug text-[var(--navy-dark)]">
      {card.title}
    </h4>
    {card.details && (
      <p className="mt-1.5 text-xs leading-5 text-[var(--gray-text)]">
        {card.details}
      </p>
    )}
  </article>
);
