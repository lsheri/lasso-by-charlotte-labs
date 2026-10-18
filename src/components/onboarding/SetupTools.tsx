import { PasteThreadDialog } from "@/components/work/PasteThreadDialog";
import { UploadFilesButton } from "@/components/work/UploadFilesButton";
import { TOOLS, type ToolId } from "@/lib/onboarding-tools";
import type { Register } from "@/lib/register";
import { ExportGuideCard } from "./ExportGuideCard";
import { LiveConnectCard } from "./LiveConnectCard";
import { McpSetupCard } from "./McpSetupCard";
import { Sketch } from "@/design/reference/Sketch";
import type { WorkKind } from "@/design/reference/work-types";

/**
 * Composed only from what the person checked. Every path here is opt-in:
 * nothing enters Lasso until they pick it, paste it or push it.
 *
 * Each card is shown with the thing it produces, drawn in the product's own
 * hand, so the screen shows rather than tells.
 */

/** What each tool actually lands, as the product already draws it. */
const LANDS: Partial<Record<ToolId, WorkKind>> = {
  claude: "chat",
  chatgpt: "chat",
  gemini: "chat",
  copilot: "chat",
  googledrive: "doc",
  gmail: "doc",
  granola: "transcript",
  transcripts: "transcript",
};

function Lands({ tool, children }: { tool: ToolId; children: React.ReactNode }) {
  const kind = LANDS[tool] ?? "doc";
  const meta = TOOLS[tool];
  return (
    <div className="after-setup-item" style={{ ["--tool" as string]: `var(${meta.hue})` }}>
      <figure className="after-setup-art" aria-hidden>
        <Sketch kind={kind} tone="bone" detail="compact" />
      </figure>
      <div className="after-setup-body">{children}</div>
    </div>
  );
}

function Band({ hue, children }: { hue: string; children: React.ReactNode }) {
  return (
    <h2 className="after-tools-band" style={{ ["--band" as string]: `var(${hue})` }}>
      <span aria-hidden className="after-tools-dot" />
      {children}
    </h2>
  );
}

export function SetupTools({ tools }: { tools: ToolId[]; register?: Register }) {
  const has = (id: ToolId) => tools.includes(id);
  const mcp = (["claude", "chatgpt"] as const).filter(has);
  const connectors = (["googledrive", "granola", "transcripts", "gmail"] as const).filter(has);
  const guides = (["gemini", "copilot"] as const).filter(has);
  const nothingPicked = mcp.length + connectors.length + guides.length === 0;

  return (
    <div className="lasso-setup-tools after-setup space-y-6">
      {connectors.length > 0 ? (
        <section className="space-y-3">
          <Band hue="--hue-sand">Connect and pick</Band>
          {connectors.map((id) => (
            <Lands key={id} tool={id}>
              <LiveConnectCard tool={id} />
            </Lands>
          ))}
        </section>
      ) : null}

      {mcp.length > 0 ? (
        <section className="space-y-3">
          <Band hue="--hue-slate-blue">Let your AI push to Lasso</Band>
          {mcp.map((id) => (
            <Lands key={id} tool={id}>
              <McpSetupCard vendor={id} />
            </Lands>
          ))}
          <p className="text-sm text-muted-foreground">
            Once it&apos;s set up, try saying “Push to Lasso” in any conversation.
          </p>
        </section>
      ) : null}

      {guides.length > 0 ? (
        <section className="space-y-3">
          <Band hue="--hue-plum">Export and import</Band>
          {guides.map((id) => (
            <Lands key={id} tool={id}>
              <ExportGuideCard tool={id} />
            </Lands>
          ))}
        </section>
      ) : null}

      <section className="space-y-3">
        <Band hue="--hue-neutral">{nothingPicked ? "Start anywhere" : "Or just bring one thing"}</Band>
        <div className="after-setup-pair grid gap-3 sm:grid-cols-2">
          <PasteThreadDialog
            trigger={
              <button type="button" className="after-setup-quick" style={{ ["--tool" as string]: "var(--hue-slate-blue)" }}>
                <span aria-hidden className="after-setup-art is-small">
                  <Sketch kind="chat" tone="bone" detail="compact" />
                </span>
                <span className="after-setup-body">
                  <span className="block text-sm font-medium text-foreground">Paste a conversation</span>
                  <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                    Full fidelity · works with {TOOLS.other.label.toLowerCase()}
                  </span>
                </span>
              </button>
            }
          />
          <div className="after-setup-quick is-static" style={{ ["--tool" as string]: "var(--hue-sage)" }}>
            <span aria-hidden className="after-setup-art is-small">
              <Sketch kind="sheet" tone="bone" detail="compact" />
            </span>
            <span className="after-setup-body">
              <span className="block text-sm font-medium text-foreground">Upload files</span>
              <span className="mt-2 block">
                <UploadFilesButton />
              </span>
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
