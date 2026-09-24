import type { ChatBundles, LabNode } from "@/components/canvas-lab/canvas-lab-model";
import { BUNDLE_GAP, BUNDLE_INDENT, BUNDLE_MORE_TILE, bundleControlScale, type BundleView } from "@/components/canvas-lab/canvas-lab-model";

type Props = {
  nodes: readonly LabNode[];
  /** Only the pieces that show. */
  bundles: ChatBundles;
  more: ReadonlyMap<string, number>;
  minimized: ReadonlyMap<string, number>;
  zoom: number;
  onToggle: (chat: LabNode, state: BundleView) => void;
};

function piecesLabel(count: number): string {
  return `${count} ${count === 1 ? "piece" : "pieces"} from this chat`;
}

/**
 * B2: the per-viewer bundle controls. "Minimize" and "{n} pieces from this chat"
 * hold one screen size at any zoom; the "+N more" tile is docked like a piece.
 */
export function LabBundleControls({ nodes, bundles, more, minimized, zoom, onToggle }: Props) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const inverse = `scale(${bundleControlScale(zoom)})`;
  const out: React.ReactNode[] = [];
  for (const [chatId, pieceIds] of bundles) {
    const chat = byId.get(chatId);
    const pieces = pieceIds.map((id) => byId.get(id)).filter((node): node is LabNode => Boolean(node));
    const first = pieces[0];
    const last = pieces[pieces.length - 1];
    if (!chat || !first || !last) continue;
    // Anchored at the chat's bottom-right corner, growing up into the chat's
    // body, so it never lands on a piece title or the chat's menu at the top.
    out.push(
      <div key={`min:${chatId}`} className="canvas-lab-bundle-anchor" style={{ left: chat.x + chat.width - 8, top: chat.y + chat.height - 6, transform: inverse }}>
        <button type="button" aria-label={`Minimize pieces from ${chat.title}`} className="canvas-lab-bundle-control canvas-lab-bundle-control--up" data-testid="lab-bundle-minimize" onPointerDown={(event) => event.stopPropagation()} onClick={() => onToggle(chat, "minimized")}>Minimize</button>
      </div>,
    );
    const extra = more.get(chatId);
    if (extra) {
      out.push(
        <button key={`more:${chatId}`} type="button" aria-label={`Show all ${pieceIds.length + extra} pieces from ${chat.title}`} className="canvas-lab-bundle-more" data-testid="lab-bundle-more" style={{ left: chat.x + BUNDLE_INDENT, top: last.y + last.height + BUNDLE_GAP, width: BUNDLE_MORE_TILE.width, height: BUNDLE_MORE_TILE.height }} onPointerDown={(event) => event.stopPropagation()} onClick={() => onToggle(chat, "all_shown")}>
          +{extra} more from this chat
        </button>,
      );
    }
  }
  for (const [chatId, count] of minimized) {
    const chat = byId.get(chatId);
    if (!chat) continue;
    // Below the stacked edges (8px), in the room the pieces left.
    out.push(
      <div key={`show:${chatId}`} className="canvas-lab-bundle-anchor" style={{ left: chat.x + BUNDLE_INDENT, top: chat.y + chat.height + 14, transform: inverse }}>
        <button type="button" aria-label={`Show ${count} ${count === 1 ? "piece" : "pieces"} from ${chat.title}`} className="canvas-lab-bundle-control" data-testid="lab-bundle-expand" onPointerDown={(event) => event.stopPropagation()} onClick={() => onToggle(chat, "expanded")}>{piecesLabel(count)}</button>
      </div>,
    );
  }
  return <>{out}</>;
}

/** Two paper edges behind a minimized chat, 4px and 8px down and right. */
export function LabBundleStackEdges({ nodes, minimized }: { nodes: readonly LabNode[]; minimized: ReadonlyMap<string, number> }) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  return (
    <>
      {[...minimized.keys()].flatMap((chatId) => {
        const chat = byId.get(chatId);
        if (!chat) return [];
        return [8, 4].map((offset) => (
          <div key={`${chatId}:${offset}`} aria-hidden="true" data-testid="lab-bundle-stack-edge" className="canvas-lab-bundle-edge" style={{ left: chat.x + offset, top: chat.y + offset, width: chat.width, height: chat.height }} />
        ));
      })}
    </>
  );
}
