import type { WorkboardPreviewTurn } from "@/lib/workboard-card-preview.shared";
import { previewWheelConsumesScroll } from "@/lib/workboard-card-preview.shared";

export type ChatBorderTreatment = "claude" | "chatgpt" | "gemini" | "copilot" | "default";

/** Maps the existing source vendor key to the four intentionally coloured edges. */
export function chatBorderTreatment(vendorKey: string | null): ChatBorderTreatment {
  const key = vendorKey?.trim().toLowerCase() ?? "";
  if (key === "claude" || key === "anthropic") return "claude";
  if (key === "chatgpt" || key === "openai") return "chatgpt";
  if (key === "gemini" || key === "google-gemini") return "gemini";
  if (key === "copilot" || key === "githubcopilot" || key === "github-copilot") return "copilot";
  return "default";
}

export function ChatPreviewWindow({
  vendorKey,
  turns,
  testId = "chat-preview-window",
  onScroll,
}: {
  vendorKey: string | null;
  turns: WorkboardPreviewTurn[];
  testId?: string;
  onScroll?: ((scrollTop: number) => void) | undefined;
}) {
  const treatment = chatBorderTreatment(vendorKey);
  return (
    <div
      data-chat-border={treatment}
      className="chat-preview-window"
    >
      <div
        data-testid={testId}
        data-chat-border={treatment}
        className="chat-preview-window__body"
        onScroll={(event) => onScroll?.(event.currentTarget.scrollTop)}
        onWheel={(event) => {
          const box = event.currentTarget;
          if (previewWheelConsumesScroll(true, event.deltaY, box.scrollTop, box.clientHeight, box.scrollHeight)) {
            event.stopPropagation();
          }
        }}
      >
        {turns.map((turn) => (
          <div key={turn.turnNo} className="canvas-lab-preview-turn">
            <span>{turn.role}</span>
            <p>{turn.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}