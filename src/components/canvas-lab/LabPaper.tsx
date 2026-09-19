import { GraphiteIcon, type GraphiteIconName } from "@/components/notebook/icons";
import { ArtifactNote, SourceMark, VendorMark } from "@/components/work/SourceMark";
import { colourKey, noteHue, notePaper } from "@/components/work/note-paper";
import { cardSizeTier, ownerLabel, type LabNode } from "@/components/canvas-lab/canvas-lab-model";
import { workIdentityLabel } from "@/lib/work-identity";
import { effectiveWorkDate, formatDate, type WorkItemRow } from "@/lib/work-types";
import { cn } from "@/lib/utils";

const KIND_ICON: Record<Exclude<LabNode["kind"], "work" | "task">, GraphiteIconName> = {
  brief: "engagement",
  decision: "decisions",
  chat: "messages",
  source: "attach",
  ai_work: "ai-record",
  judgment: "reflect",
  deliverable: "work",
};

function nodeIcon(node: LabNode): GraphiteIconName {
  if (node.kind === "task") return "work";
  if (node.kind === "work") return "work";
  return KIND_ICON[node.kind];
}

function clientAndEngagement(item: WorkItemRow): { clientId: string | null; engagementId: string | null } {
  const mapping = item.work_item_tasks?.[0]?.tasks ?? null;
  return {
    clientId: mapping?.engagements?.clients?.id ?? item.client_id ?? null,
    engagementId: mapping?.engagement_id ?? null,
  };
}

export function LabPaper({
  node,
  item,
  selected,
  onEdit,
  onEditCommitted,
}: {
  node: LabNode;
  item?: WorkItemRow | undefined;
  selected: boolean;
  onEdit: (text: string) => void;
  onEditCommitted: () => void;
}) {
  const tier = cardSizeTier(node);
  const identity = item ? workIdentityLabel(item) : null;
  const date = item ? formatDate(effectiveWorkDate(item)) : null;
  const colour = item ? clientAndEngagement(item) : null;
  const summary = item ? identity : node.summary;

  return (
    <div
      className={cn("nb-paper canvas-lab-paper", `canvas-lab-paper-${node.ownership}`)}
      data-paper-state={item?.visibility}
      data-tier={tier}
      style={{
        ...notePaper(node.id),
        ...(colour ? noteHue(colourKey(colour)) : {}),
      }}
    >
      <div className="canvas-lab-paper-body">
        <div className={cn("canvas-lab-paper-header", selected && "canvas-lab-context-header")}>
          <span className="canvas-lab-paper-source">
            {item ? <SourceMark item={item} size={12} /> : <GraphiteIcon name={nodeIcon(node)} size={13} animate={false} />}
            <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
              {item ? <><VendorMark item={item} />{" · "}{date}</> : node.typeLabel}
            </span>
            {node.deliverable ? <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">Deliverable</span> : null}
          </span>
          <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">{ownerLabel(node)}</span>
        </div>

        <p className={cn("canvas-lab-paper-title font-hand text-[16px] leading-[18px] text-foreground", selected && "canvas-lab-context-title")}>
          {node.title} {item ? <ArtifactNote item={item} /> : null}
        </p>

        {node.local && tier !== "compact" ? (
          <textarea
            aria-label={`Edit ${node.title} note`}
            value={node.summary}
            onChange={(event) => onEdit(event.target.value)}
            onBlur={onEditCommitted}
            onPointerDown={(event) => event.stopPropagation()}
            className="canvas-lab-paper-edit w-full resize-none border border-[var(--nb-rule)] bg-card px-2 py-1 text-[11.5px] leading-[17px] text-foreground outline-none focus:border-[var(--nb-green)]"
          />
        ) : tier !== "compact" && summary ? (
          <p className="canvas-lab-paper-summary line-clamp-3 text-[11.5px] leading-[17px] text-muted-foreground">{summary}</p>
        ) : null}

        {tier === "expanded" && item ? (
          <div className="canvas-lab-paper-footer font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
            <VendorMark item={item} />
            <span>{date}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}