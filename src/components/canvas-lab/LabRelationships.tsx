import {
  labAnchorPoint,
  labConnectorPath,
  type LabLink,
  type LabNode,
} from "@/components/canvas-lab/canvas-lab-model";

/** ASK-B2: lines from a pinned answer to the cards it read stay quiet until selected. */
const CITED_STROKE = "color-mix(in srgb, var(--nb-graphite) 38%, transparent)";

export function LabRelationships({
  links,
  nodes,
  measuredHeights,
  selectedLinkId,
  inverseZoom,
  onSelect,
  onHover,
  interactive = true,
}: {
  links: LabLink[];
  nodes: LabNode[];
  measuredHeights: ReadonlyMap<string, number>;
  selectedLinkId: string | null;
  inverseZoom: number;
  onSelect: (id: string) => void;
  onHover?: (id: string | null) => void;
  interactive?: boolean;
}) {
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
        <marker id="canvas-lab-arrow-muted" markerUnits="userSpaceOnUse" markerWidth={6 * inverseZoom} markerHeight={6 * inverseZoom} refX="7" refY="4" orient="auto" viewBox="0 0 8 8">
          <path d="M 0 0 L 8 4 L 0 8 Z" fill={CITED_STROKE} />
        </marker>
      </defs>
      {links.map((link) => {
        const source = nodes.find((node) => node.id === link.fromId);
        const target = nodes.find((node) => node.id === link.toId);
        if (!source || !target) return null;
        const from = labAnchorPoint(source, link.fromAnchor, measuredHeights.get(source.id) ?? source.height);
        const to = labAnchorPoint(target, link.toAnchor, measuredHeights.get(target.id) ?? target.height);
        const path = labConnectorPath(from, link.fromAnchor, to, link.toAnchor);
        const selected = selectedLinkId === link.id;
        const quiet = link.relation === "cited" && !selected;
        const select = () => onSelect(link.id);
        return (
          <g key={link.id} data-testid={`lab-relationship-${link.id}`} onPointerEnter={() => onHover?.(link.id)} onPointerLeave={() => onHover?.(null)}>
            {interactive ? <path d={path} fill="none" stroke="transparent" strokeWidth={12 * inverseZoom} className="canvas-lab-relationship-hit" onClick={select} /> : null}
            <path
              role={interactive ? "button" : undefined}
              tabIndex={interactive ? 0 : undefined}
              aria-label={interactive ? `Select relationship from ${source.title} to ${target.title}` : undefined}
              onClick={interactive ? select : undefined}
              onKeyDown={interactive ? (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  select();
                }
              } : undefined}
              d={path}
              fill="none"
              stroke={selected ? "var(--nb-green)" : "var(--nb-graphite)"}
              strokeWidth={(selected ? 2.4 : 1.4) * inverseZoom}
              strokeLinecap="round"
              markerEnd={selected ? "url(#canvas-lab-arrow-green)" : "url(#canvas-lab-arrow-graphite)"}
              {...(quiet ? { stroke: CITED_STROKE, strokeWidth: 1 * inverseZoom, strokeDasharray: `${4 * inverseZoom} ${4 * inverseZoom}`, markerEnd: "url(#canvas-lab-arrow-muted)" } : {})}
              className="canvas-lab-relationship-line cursor-pointer outline-none"
            />
          </g>
        );
      })}
    </g>
  );
}