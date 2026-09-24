import type { ChatBundles, LabNode } from "@/components/canvas-lab/canvas-lab-model";

/**
 * The lines Lasso draws between a pushed chat and the pieces it made. They are
 * not saved relationships: nothing here can be picked, relabelled or removed.
 */
export function LabBundleLinks({ nodes, bundles }: { nodes: readonly LabNode[]; bundles: ChatBundles }) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  return (
    <g aria-hidden="true" data-testid="lab-bundle-links" className="pointer-events-none" style={{ pointerEvents: "none" }}>
      {[...bundles].map(([chatId, pieceIds]) => {
        const chat = byId.get(chatId);
        const pieces = pieceIds.map((id) => byId.get(id)).filter((node): node is LabNode => Boolean(node));
        const last = pieces[pieces.length - 1];
        if (!chat || !last) return null;
        const spineX = chat.x + 9;
        const branchY = (piece: LabNode) => piece.y + Math.min(28, piece.height / 2);
        return (
          <g key={chatId}>
            <path d={`M ${spineX} ${chat.y + chat.height} L ${spineX} ${branchY(last)}`} fill="none" stroke="var(--nb-pencil)" strokeWidth={1.4} />
            {pieces.map((piece) => <path key={piece.id} d={`M ${spineX} ${branchY(piece)} L ${piece.x} ${branchY(piece)}`} fill="none" stroke="var(--nb-pencil)" strokeWidth={1.4} />)}
          </g>
        );
      })}
    </g>
  );
}
