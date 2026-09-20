import { Lock } from "lucide-react";

import { ArtifactNote, SourceMark, VendorMark } from "@/components/work/SourceMark";
import { colourKey, noteHue, notePaper } from "@/components/work/note-paper";
import { useNoteLive } from "@/hooks/use-note-live";
import { workIdentityLabel } from "@/lib/work-identity";
import { effectiveWorkDate, formatDate, type WorkItemRow } from "@/lib/work-types";

/** The shared paper note used anywhere a single piece of work is shown. */
export function WorkNote({
  item,
  onOpen,
  lead,
  actions,
  chips,
  clientLabel,
  dense = false,
  className = "",
}: {
  // Callers join different relations: the board and Inbox carry
  // work_item_tasks, Verify's deliverables do not. The type must say so.
  item: Omit<WorkItemRow, "work_item_tasks"> & {
    work_item_tasks?: WorkItemRow["work_item_tasks"];
  };
  onOpen?: (() => void) | undefined;
  /** Rendered before the body, e.g. a drag handle. */
  lead?: React.ReactNode;
  /** Rendered at the trailing edge of the first line, e.g. a row menu. */
  actions?: React.ReactNode;
  chips?: React.ReactNode;
  clientLabel?: string | null | undefined;
  dense?: boolean;
  className?: string;
}) {
  const live = useNoteLive<HTMLDivElement>();
  // Verify's deliverables arrive nested from the engagement read and carry no
  // work_item_tasks of their own, so the mapping is optional here.
  const mapping = item.work_item_tasks?.[0]?.tasks ?? null;
  const clientId = mapping?.engagements?.clients?.id ?? item.client_id ?? null;
  const date = formatDate(effectiveWorkDate(item));

  return (
    <div
      ref={live}
      className={`nb-paper ${className}`}
      data-paper-state={item.visibility}
      data-client-label={clientLabel ?? undefined}
      style={{
        ...notePaper(item.id),
        ...noteHue(colourKey({ clientId, engagementId: mapping?.engagement_id ?? null })),
      }}
    >
      <div
        {...(onOpen
          ? {
              role: "button" as const,
              tabIndex: 0,
              "aria-label": item.title,
              onClick: onOpen,
              onKeyDown: (event: React.KeyboardEvent) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onOpen();
                }
              },
            }
          : {})}
        className={`nb-paper-body ${onOpen ? "cursor-pointer" : ""}`}
      >
        <div className="flex items-start gap-2">
          {lead ? <span className="shrink-0">{lead}</span> : null}
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            {item.visibility === "private" ? (
              <Lock
                className="h-2.5 w-2.5 shrink-0"
                style={{ color: "var(--state-indigo)" }}
                aria-label="Private"
              />
            ) : null}
            <SourceMark item={item} size={14} disc />
            <span className="min-w-0 truncate font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
              <VendorMark item={item} />
              {" · "}
              {date}
            </span>
          </div>
          {actions ? <span className="shrink-0">{actions}</span> : null}
        </div>

        <p
          className={`mt-1 break-words text-[13px] leading-[18px] text-foreground ${dense ? "line-clamp-3" : "line-clamp-2"}`}
        >
          {item.title} <ArtifactNote item={item} />
        </p>

        {workIdentityLabel(item) ? (
          <p className="mt-1 truncate font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
            {workIdentityLabel(item)}
          </p>
        ) : null}

        {chips ? <div className="mt-1 flex flex-wrap items-center gap-1.5">{chips}</div> : null}
      </div>
    </div>
  );
}