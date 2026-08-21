import { PasteThreadDialog } from "@/components/work/PasteThreadDialog";
import { UploadFilesButton } from "@/components/work/UploadFilesButton";
import { TOOLS, type ToolId } from "@/lib/onboarding-tools";
import { ExportGuideCard } from "./ExportGuideCard";
import { FlowPreview } from "./FlowPreview";
import { LiveConnectCard } from "./LiveConnectCard";
import { McpSetupCard } from "./McpSetupCard";

/**
 * Composed only from what the person checked. Every path here is opt-in:
 * nothing enters Lasso until they pick it, paste it or push it.
 */
export function SetupTools({ tools }: { tools: ToolId[] }) {
  const has = (id: ToolId) => tools.includes(id);
  const mcp = (["claude", "chatgpt"] as const).filter(has);
  const connectors = (["googledrive", "granola", "transcripts"] as const).filter(has);
  const guides = (["gemini", "copilot"] as const).filter(has);
  const nothingPicked = mcp.length + connectors.length + guides.length === 0;

  return (
    <div className="space-y-6">
      <FlowPreview />

      {connectors.length > 0 ? (
        <section className="space-y-3">
          <h2 className="micro-label micro-label-section">Connect and pick</h2>
          {connectors.map((id) => (
            <LiveConnectCard key={id} tool={id} />
          ))}
        </section>
      ) : null}

      {mcp.length > 0 ? (
        <section className="space-y-3">
          <h2 className="micro-label micro-label-section">Let your AI push to Lasso</h2>
          {mcp.map((id) => (
            <McpSetupCard key={id} vendor={id} />
          ))}
          <p className="text-sm text-muted-foreground">
            Once it&apos;s set up, try saying “Push to Lasso” in any conversation.
          </p>
        </section>
      ) : null}

      {guides.length > 0 ? (
        <section className="space-y-3">
          <h2 className="micro-label micro-label-section">Export and import</h2>
          {guides.map((id) => (
            <ExportGuideCard key={id} tool={id} />
          ))}
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="micro-label micro-label-section">
          {nothingPicked ? "Start anywhere" : "Or just bring one thing"}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <PasteThreadDialog
            trigger={
              <button
                type="button"
                className="rounded-[var(--radius)] border border-border bg-card p-4 text-left shadow-card transition-colors hover:border-accent"
              >
                <p className="text-sm font-medium text-foreground">Paste a conversation</p>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                  Full fidelity · works with {TOOLS.other.label.toLowerCase()}
                </p>
              </button>
            }
          />
          <div className="rounded-[var(--radius)] border border-border bg-card p-4 shadow-card">
            <p className="text-sm font-medium text-foreground">Upload files</p>
            <div className="mt-2">
              <UploadFilesButton />
            </div>
          </div>
        </div>
      </section>

      <p className="text-sm text-muted-foreground">
        Everything lands private. Nothing is visible to anyone until you map it.
      </p>
    </div>
  );
}
