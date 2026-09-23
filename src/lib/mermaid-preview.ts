import { wrapSvgArtifact } from "./workboard-file-preview";

let initialized = false;

/** Render Mermaid only when a diagram is visible, then keep it inside the artifact iframe. */
export async function renderMermaidPreview(source: string, id: string): Promise<string> {
  const { default: mermaid } = await import("mermaid");
  if (!initialized) {
    mermaid.initialize({ securityLevel: "strict", startOnLoad: false });
    initialized = true;
  }
  const { svg } = await mermaid.render(`lasso-mermaid-${id.replace(/[^a-z0-9_-]/gi, "-")}`, source);
  return wrapSvgArtifact(svg);
}