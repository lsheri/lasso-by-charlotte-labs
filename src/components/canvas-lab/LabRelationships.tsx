import { useState } from "react";

import {
  labAnchorPoint,
  labConnectorMidpoint,
  labConnectorPath,
  type LabLink,
  type LabNode,
} from "@/components/canvas-lab/canvas-lab-model";

export function LabRelationships({
  links,
  nodes,
  measuredHeights,
  selectedLinkId,
  inverseZoom,
  editable,
  onSelect,
  onRemove,
}: {
  links: LabLink[];
  nodes: LabNode[];
  measuredHeights: ReadonlyMap<string, number>;
  selectedLinkId: string | null;
  inverseZoom: number;
  editable: boolean;
  onSelect: (id: string) => void;
  onRemove: (link: LabLink) => void;
}) {
  const [hoveredLinkId, setHoveredLinkId] = useState<string | null>(null);
  const arrowSize = 8 * inverseZoom;

  return (
    <g aria-label="Saved workboard relationships">
      <defs>
        <marker id="canvas-lab-arrow-graphite" markerUnits="userSpaceOnUse" markerWidth={arrowSize} markerHeight={arrowSize} refX="7" refY="4" orient="auto" viewBox="0 0 8 8">
          <path d="M 0 0 L 8 4 L 0 8 Z" fill="var(--nb-graphite)" />
        </marker>
        <marker id="canvas-lab-arrow-green" markerUnits="userSpaceOnUse" markerWidth={arrowSize} markerHeight={arrowSize} refX="7" refY="4" orient="auto" viewBox="0 0 8 8">
          <path d="M 0 0 L 8 4 L 0 8 Z" fill="var(--nb-green)" />
        </marker>
      </defs>
      {links.map((link) => {
        const source = nodes.find((node) => node.id === link.fromId);
        const target = nodes.find((node) => node.id === link.toId);
        if (!source || !target) return null;
        const from = labAnchorPoint(source, link.fromAnchor, measuredHeights.get(source.id) ?? source.height);
        const to = labAnchorPoint(target, link.toAnchor, measuredHeights.get(target.id) ?? target.height);
        const path = labConnectorPath(from, link.fromAnchor, to, link.toAnchor);
        const midpoint = labConnectorMidpoint(from, link.fromAnchor, to, link.toAnchor);
        const selected = selectedLinkId === link.id;
        const hovered = hoveredLinkId === link.id;
        const emphasized = selected || hovered;
        const select = () => onSelect(link.id);
        const removeSize = 18 * inverseZoom;
        return (
          <g key={link.id} data-testid={`lab-relationship-${link.id}`} onPointerEnter={() => setHoveredLinkId(link.id)} onPointerLeave={() => setHoveredLinkId(null)}>
            <path d={path} fill="none" stroke="transparent" strokeWidth={12 * inverseZoom} className="canvas-lab-relationship-hit" onClick={select} />
            <path
              role="button"
              tabIndex={0}
              aria-label={`Select relationship from ${source.title} to ${target.title}`}
              onClick={select}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  select();
                }
              }}
              d={path}
              fill="none"
              stroke={selected ? "var(--nb-green)" : "var(--nb-graphite)"}
              strokeWidth={(emphasized ? 2.4 : 1.4) * inverseZoom}
              strokeLinecap="round"
              markerEnd={selected ? "url(#canvas-lab-arrow-green)" : "url(#canvas-lab-arrow-graphite)"}
              className="canvas-lab-relationship-line cursor-pointer outline-none"
            />
            {editable && emphasized ? (
              <foreignObject x={midpoint.x - removeSize / 2} y={midpoint.y - removeSize / 2} width={removeSize} height={removeSize} className="canvas-lab-relationship-remove-wrap">
                <button
                  type="button"
                  className="canvas-lab-relationship-remove"
                  aria-label={`Remove relationship from ${source.title} to ${target.title}`}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    onRemove(link);
                  }}
                >
                  ×
                </button>
              </foreignObject>
            ) : null}
          </g>
        );
      })}
    </g>
  );
}