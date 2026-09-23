import {
  labAnchorPoint,
  labConnectorAffordancePoint,
  type LabLink,
  type LabNode,
} from "@/components/canvas-lab/canvas-lab-model";

/**
 * Controls live above cards while the relationship paths stay below them.
 * B1: one kind of link. Every link reads as context for each other, so no
 * word is written on the line and there is no control to change its meaning.
 */
export function LabRelationshipOverlays({ links, nodes, measuredHeights, selectedLinkId, hoveredLinkId, inverseZoom, editable, onRemove, onHover }: {
  links: LabLink[];
  nodes: LabNode[];
  measuredHeights: ReadonlyMap<string, number>;
  selectedLinkId: string | null;
  hoveredLinkId: string | null;
  inverseZoom: number;
  zoom?: number;
  editable: boolean;
  onRemove: (link: LabLink) => void;
  onHover?: (id: string | null) => void;
}) {
  return <g aria-label="Workboard relationship controls">
    {links.map((link) => {
      const emphasized = selectedLinkId === link.id || hoveredLinkId === link.id;
      if (!editable || !emphasized) return null;
      const source = nodes.find((node) => node.id === link.fromId);
      const target = nodes.find((node) => node.id === link.toId);
      if (!source || !target) return null;
      const sourceHeight = measuredHeights.get(source.id) ?? source.height;
      const targetHeight = measuredHeights.get(target.id) ?? target.height;
      const from = labAnchorPoint(source, link.fromAnchor, sourceHeight);
      const to = labAnchorPoint(target, link.toAnchor, targetHeight);
      const removeSize = 18 * inverseZoom;
      const point = labConnectorAffordancePoint(
        from,
        link.fromAnchor,
        to,
        link.toAnchor,
        { width: removeSize, height: removeSize },
        { x: source.x, y: source.y, width: source.width, height: sourceHeight },
        { x: target.x, y: target.y, width: target.width, height: targetHeight },
      );
      return <g key={link.id}>
        <foreignObject x={point.x - removeSize / 2} y={point.y - removeSize / 2} width={removeSize} height={removeSize} className="canvas-lab-relationship-remove-wrap" onPointerEnter={() => onHover?.(link.id)} onPointerLeave={() => onHover?.(null)}>
          <div className="canvas-lab-relationship-controls">
            <button type="button" className="canvas-lab-relationship-remove" style={{ width: removeSize, height: removeSize }} aria-label={`Remove relationship from ${source.title} to ${target.title}`} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onRemove(link); }}>×</button>
          </div>
        </foreignObject>
      </g>;
    })}
  </g>;
}
