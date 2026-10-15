import { FileText } from "lucide-react";
import { sourceVendorKey } from "@/components/work/SourceMark";
import { displayName } from "@/lib/work-item-name";
import type { WorkItemRow } from "@/lib/work-types";
import type { WorkboardCardPreview, WorkboardFilePreview } from "@/lib/workboard-card-preview.shared";

export const COPY = { unknown: "Lasso cannot preview this" };
const THEMES: Record<string, string> = { claude: "Claude", chatgpt: "ChatGPT", gemini: "Gemini", granola: "Granola", default: "Assistant" };

/** Decorative source evidence, never generated from a summary. */
export function SourceMirror({ item, chatPreview, filePreview }: {
  item: Omit<WorkItemRow, "work_item_tasks">;
  chatPreview?: WorkboardCardPreview | undefined;
  filePreview?: WorkboardFilePreview | undefined;
}) {
  const vendor = sourceVendorKey(item)?.toLowerCase();
  const key = vendor === "anthropic" ? "claude" : vendor === "openai" ? "chatgpt" : vendor === "google-gemini" ? "gemini" : vendor;
  const theme = key && Object.hasOwn(THEMES, key) ? key : "default";
  const turns = chatPreview?.turns ?? [];
  const title = displayName(item);
  const shape = turns.length > 0 ? "conversation" : filePreview || ["document", "deck", "sheet"].includes(item.type) ? "document" : "unknown";
  return (
    <div aria-hidden="true" className="source-mirror" data-source-theme={theme} data-source-shape={shape}>
      <div className="source-mirror__inner">
        {shape === "conversation" ? (
          <div className="source-mirror__conversation">
            <div className="source-mirror__heading">{title}</div>
            {turns.map((turn) => {
              const role = turn.role.trim().toLowerCase();
              const user = role === "user";
              const label = user ? "You" : role === "assistant" ? THEMES[theme] : turn.role;
              return <div key={turn.turnNo} className="source-mirror__turn" data-user={user ? "true" : "false"}><div className="source-mirror__role">{label}</div><p>{turn.content}</p></div>;
            })}
          </div>
        ) : shape === "document" ? (
          <div className="source-mirror__desk"><div className="source-mirror__page">
            <div className="source-mirror__document-title">{title.replace(/\.[a-z0-9]{1,10}$/i, "")}</div>
            <div className="source-mirror__bars">{Array.from({ length: 8 }, (_, index) => <div key={index} />)}</div>
          </div></div>
        ) : (
          <div className="source-mirror__unknown"><FileText size={34} strokeWidth={1.4} /><div className="source-mirror__unknown-title">{title}</div><div className="source-mirror__unknown-label">{COPY.unknown}</div></div>
        )}
      </div>
    </div>
  );
}