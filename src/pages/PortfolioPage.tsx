import { PageHeader } from "@/components/layout/PageHeader";
import { useWorkItems } from "@/hooks/use-work-items";
import { deliverableTag } from "@/lib/deliverable-kinds";
import { EDU_VOCAB } from "@/lib/edu-vocab";
import { isInPortfolio, PORTFOLIO_EMPTY_LINE, PORTFOLIO_PRIVACY_LINE } from "@/lib/portfolio";

export function PortfolioPage() {
  const { data } = useWorkItems();
  const items = (data?.items ?? []).filter((item) => isInPortfolio(item));

  return (
    <div className="space-y-8">
      <PageHeader
        title={EDU_VOCAB.portfolio}
        subtitle="The work you are proud of, kept in one place and still in its class or project."
      />
      <p className="text-sm text-muted-foreground">{PORTFOLIO_PRIVACY_LINE}</p>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{PORTFOLIO_EMPTY_LINE}</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((item) => {
            const home = item.work_item_tasks[0]?.tasks?.engagements?.title ?? null;
            return (
              <article
                key={item.id}
                className="rounded-[var(--radius)] border border-border bg-card p-5 shadow-card"
              >
                <p className="text-sm font-medium text-foreground">{item.title}</p>
                <p className="mt-2 flex flex-wrap gap-x-3 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                  <span>{deliverableTag(item.meta, item.type)}</span>
                  {home ? <span>{home}</span> : null}
                </p>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
