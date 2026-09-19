import {
  labAnchorPoint,
  labConnectorAffordancePoint,
  type LabLink,
  type LabNode,
} from "@/components/canvas-lab/canvas-lab-model";

/** Labels and controls live above cards while the relationship paths stay below them. */
export function LabRelationshipOverlays({ links, nodes, measuredHeights, selectedLinkId, hoveredLinkId, inverseZoom, zoom, editable, onRemove, onChangeRelation }: {
  links: LabLink[];
  nodes: LabNode[];
  measuredHeights: ReadonlyMap<string, number>;
  selectedLinkId: string | null;
  hoveredLinkId: string | null;
  inverseZoom: number;
  zoom: number;
  editable: boolean;
  onRemove: (link: LabLink) => void;
  onChangeRelation: (link: LabLink) => void;
}) {
  return <g aria-label="Workboard relationship labels and controls">
    {links.map((link) => {
      const source = nodes.find((node) => node.id === link.fromId);
      const target = nodes.find((node) => node.id === link.toId);
      if (!source || !target) return null;
      const sourceHeight = measuredHeights.get(source.id) ?? source.height;
      const targetHeight = measuredHeights.get(target.id) ?? target.height;
      const from = labAnchorPoint(source, link.fromAnchor, sourceHeight);
      const to = labAnchorPoint(target, link.toAnchor, targetHeight);
      const relation = link.relation ?? "context";
      const emphasized = selectedLinkId === link.id || hoveredLinkId === link.id;
      const removeSize = 18 * inverseZoom;
      const controlsWidth = 108 * inverseZoom;
      const labelWidth = (relation.length * 7 + 12) * inverseZoom;
      const labelHeight = 20 * inverseZoom;
      const point = labConnectorAffordancePoint(
        from,
        link.fromAnchor,
        to,
        link.toAnchor,
        emphasized ? { width: controlsWidth, height: removeSize } : { width: labelWidth, height: labelHeight },
        { x: source.x, y: source.y, width: source.width, height: sourceHeight },
        { x: target.x, y: target.y, width: target.width, height: targetHeight },
      );
      return <g key={link.id}>
        {relation !== "context" && zoom >= 0.6 && !emphasized ? <g data-testid={`lab-relationship-label-${link.id}`} className="canvas-lab-relationship-label">
          <rect x={point.x - labelWidth / 2} y={point.y - labelHeight / 2} width={labelWidth} height={labelHeight} rx={3 * inverseZoom} />
          <text x={point.x} y={point.y} textAnchor="middle" dominantBaseline="central" style={{ fontSize: 13 * inverseZoom }}>{relation}</text>
        </g> : null}
        {editable && emphasized ? <foreignObject x={point.x - controlsWidth / 2} y={point.y - removeSize / 2} width={controlsWidth} height={removeSize} className="canvas-lab-relationship-remove-wrap">
          <div className="canvas-lab-relationship-controls" style={{ gap: 6 * inverseZoom }}>
            <button type="button" className="canvas-lab-relationship-change" style={{ fontSize: 13 * inverseZoom }} aria-label={`Change relation from ${source.title} to ${target.title}`} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onChangeRelation(link); }}>Change relation</button>
            <button type="button" className="canvas-lab-relationship-remove" style={{ width: removeSize, height: removeSize }} aria-label={`Remove relationship from ${source.title} to ${target.title}`} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onRemove(link); }}>×</button>
          </div>
        </foreignObject> : null}
      </g>;
    })}
  </g>;
}