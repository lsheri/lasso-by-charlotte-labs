import { useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";

const MENU_WIDTH = 220;

/** MENU-1: the empty-board menu. Same items and handlers as the former inline markup, with roving focus. */
export function BoardStageMenu(props: {
  at: { x: number; y: number };
  hidden: { id: string; title: string }[];
  canAddContextArea: boolean;
  onClose: () => void;
  onAddWork: () => void;
  onRestore: (id: string) => void;
  onAddContextArea: () => void;
}) {
  const { at, hidden, canAddContextArea, onClose, onAddWork, onRestore, onAddContextArea } = props;
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: at.x, top: at.y });

  const items = () => Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? []);

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const host = (menu.closest(".canvas-lab-surface") ?? document.querySelector(".canvas-lab-surface")) as HTMLElement | null;
    const width = host?.clientWidth ?? 0;
    const height = host?.clientHeight ?? 0;
    const menuHeight = menu.offsetHeight;
    const left = width > 0 && at.x + MENU_WIDTH > width ? Math.max(0, at.x - MENU_WIDTH) : at.x;
    const top = height > 0 && menuHeight > 0 && at.y + menuHeight > height ? Math.max(0, at.y - menuHeight) : at.y;
    setPos({ left, top });
    items()[0]?.focus({ preventScroll: true });
  }, [at.x, at.y]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const list = items();
    if (list.length === 0) return;
    const index = list.indexOf(document.activeElement as HTMLButtonElement);
    let next: number | null = null;
    if (event.key === "ArrowDown") next = index < 0 ? 0 : (index + 1) % list.length;
    else if (event.key === "ArrowUp") next = index <= 0 ? list.length - 1 : index - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = list.length - 1;
    else if (event.key === "Escape" || event.key === "Tab") { event.preventDefault(); onClose(); return; }
    if (next === null) return;
    event.preventDefault();
    list[next]?.focus();
  }

  return (
    <>
      <div className="fixed inset-0 z-40" onPointerDown={onClose} onContextMenu={(event) => { event.preventDefault(); onClose(); }} />
      <div ref={menuRef} role="menu" aria-label="Board options" className="canvas-lab-menu absolute z-50" style={{ left: pos.left, top: pos.top }} onKeyDown={onKeyDown}>
        <button type="button" role="menuitem" tabIndex={-1} className="canvas-lab-menu-item" onClick={() => { onClose(); onAddWork(); }}>Bring in work here</button>
        {hidden.length > 0 ? (
          <div role="group" aria-label={`Put back on the board (${hidden.length})`}>
            <div className="canvas-lab-menu-sep" role="separator" />
            <p className="canvas-lab-menu-label">Put back on the board ({hidden.length})</p>
            {hidden.map((node) => <button key={node.id} type="button" role="menuitem" tabIndex={-1} className="canvas-lab-menu-item truncate" onClick={() => { onClose(); onRestore(node.id); }}>{node.title}</button>)}
          </div>
        ) : null}
        {canAddContextArea ? <button type="button" role="menuitem" tabIndex={-1} className="canvas-lab-menu-item" onClick={() => { onClose(); onAddContextArea(); }}>Add a context area</button> : null}
      </div>
    </>
  );
}
