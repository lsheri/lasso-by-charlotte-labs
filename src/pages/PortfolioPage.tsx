import { PageHeader } from "@/components/layout/PageHeader";
import { ToneCard } from "@/components/notebook/ToneCard";
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
      <p className="text-[11.5px] leading-[17px] text-muted-foreground">{PORTFOLIO_PRIVACY_LINE}</p>

      {items.length === 0 ? (
        <p className="text-[11.5px] leading-[17px] text-muted-foreground">{PORTFOLIO_EMPTY_LINE}</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((item) => {
            const home = item.work_item_tasks[0]?.tasks?.engagements?.title ?? null;
            return (
              <ToneCard
                key={item.id}
                tone="paper"
                label={deliverableTag(item.meta, item.type)}
                title={item.title}
                {...(home ? { meta: home } : {})}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
