import type { ReactNode, Ref } from "react";
import type { WorkboardPreviewTurn } from "@/lib/workboard-card-preview.shared";

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
}: {
  vendorKey: string | null;
  turns: WorkboardPreviewTurn[];
  testId?: string;
}) {
  return (
    <ChatBorderFrame vendorKey={vendorKey} mode="excerpt" testId={testId}>
        {turns.map((turn) => (
          <div key={turn.turnNo} className="canvas-lab-preview-turn">
            <span>{turn.role}</span>
            <p>{turn.content}</p>
          </div>
        ))}
    </ChatBorderFrame>
  );
}

export function ChatBorderFrame({
  vendorKey,
  mode,
  testId,
  bodyRef,
  onScroll,
  onMouseUp,
  onKeyUp,
  children,
}: {
  vendorKey: string | null;
  mode: "excerpt" | "expanded";
  testId?: string;
  bodyRef?: Ref<HTMLDivElement> | undefined;
  onScroll?: (() => void) | undefined;
  onMouseUp?: (() => void) | undefined;
  onKeyUp?: (() => void) | undefined;
  children: ReactNode;
}) {
  const treatment = chatBorderTreatment(vendorKey);
  return (
    <div data-chat-border={treatment} data-preview-mode={mode} className="chat-preview-window">
      <div
        ref={bodyRef}
        data-testid={testId}
        data-chat-border={treatment}
        data-preview-mode={mode}
        className="chat-preview-window__body"
        onScroll={onScroll}
        onMouseUp={onMouseUp}
        onKeyUp={onKeyUp}
      >
        {children}
      </div>
    </div>
  );
}