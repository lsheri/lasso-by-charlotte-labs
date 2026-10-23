import type { ChatBundles, LabNode } from "@/components/canvas-lab/canvas-lab-model";
import { vendorColour } from "@/lib/vendor-colour";

/**
 * The lines Lasso draws between a pushed chat and the pieces it made. They are
 * not saved relationships: nothing here can be picked, relabelled or removed.
 * The stem belongs to the bundle, so it takes the chat's vendor, never a
 * piece's.
 */
export function LabBundleLinks({
  nodes,
  bundles,
  vendorByChat,
}: {
  nodes: readonly LabNode[];
  bundles: ChatBundles;
  /** Chat NODE id -> source_vendor. Missing entries fall back to the unknown colour. */
  vendorByChat?: ReadonlyMap<string, string | null> | undefined;
}) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  return (
    <g aria-hidden="true" data-testid="lab-bundle-links" className="pointer-events-none" style={{ pointerEvents: "none" }}>
      {[...bundles].map(([chatId, pieceIds]) => {
        const chat = byId.get(chatId);
        const pieces = pieceIds.map((id) => byId.get(id)).filter((node): node is LabNode => Boolean(node));
        const last = pieces[pieces.length - 1];
        if (!chat || !last) return null;
        const colour = vendorColour(vendorByChat?.get(chatId));
        const spineX = chat.x + 9;
        const branchY = (piece: LabNode) => piece.y + Math.min(28, piece.height / 2);
        return (
          <g key={chatId}>
            <rect x={spineX - 4} y={chat.y + chat.height} width={8} height={8} fill={colour} />
            <path d={`M ${spineX} ${chat.y + chat.height} L ${spineX} ${branchY(last)}`} fill="none" stroke={colour} strokeWidth={2} />
            {pieces.map((piece) => <path key={piece.id} d={`M ${spineX} ${branchY(piece)} L ${piece.x} ${branchY(piece)}`} fill="none" stroke={colour} strokeWidth={2} />)}
          </g>
        );
      })}
    </g>
  );
}
