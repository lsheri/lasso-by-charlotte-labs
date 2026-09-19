/**
 * What a link means, chosen at the link itself.
 *
 * The link is already saved as "context" before this opens, so walking away
 * loses nothing. Arrow keys move, Enter picks, Escape leaves it as it is.
 */

import { useEffect, useRef, useState } from "react";

import { WORKBOARD_RELATIONS, type WorkboardRelation } from "@/lib/canvas-lab-shared";

export function LabRelationPicker({
  point,
  current,
  onPick,
  onClose,
}: {
  point: { x: number; y: number };
  current: WorkboardRelation;
  onPick: (relation: WorkboardRelation) => void;
  onClose: () => void;
}) {
  const startIndex = Math.max(0, WORKBOARD_RELATIONS.indexOf(current));
  const [index, setIndex] = useState(startIndex);
  const shellRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    shellRef.current?.focus();
  }, []);

  return (
    <div
      ref={shellRef}
      data-testid="lab-relation-picker"
      className="canvas-lab-relation-picker"
      style={{ left: point.x, top: point.y, transform: "translate(-50%, -50%)" }}
      role="listbox"
      aria-label="What does this link mean?"
      tabIndex={0}
      onPointerDown={(event) => event.stopPropagation()}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onClose();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
          return;
        }
        if (event.key === "ArrowDown" || event.key === "ArrowRight") {
          event.preventDefault();
          setIndex((value) => (value + 1) % WORKBOARD_RELATIONS.length);
          return;
        }
        if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
          event.preventDefault();
          setIndex((value) => (value - 1 + WORKBOARD_RELATIONS.length) % WORKBOARD_RELATIONS.length);
          return;
        }
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          const chosen = WORKBOARD_RELATIONS[index];
          if (chosen) onPick(chosen);
        }
      }}
    >
      <ul>
        {WORKBOARD_RELATIONS.map((relation, position) => (
          <li key={relation}>
            <button
              type="button"
              role="option"
              aria-selected={relation === current}
              data-active={position === index ? "true" : undefined}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => onPick(relation)}
            >
              {relation}
            </button>
          </li>
        ))}
      </ul>
      <p>What does this link mean?</p>
    </div>
  );
}
