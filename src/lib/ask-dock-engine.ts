import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";

/**
 * One coordinate system: every spot is x, y, w, h, and the surface moves by
 * transform, so any two spots can animate into each other. React is not in the
 * drag: pointer moves write to the element directly, so a long conversation
 * never re-renders while carried. The grabbed point stays under the pointer.
 * Spots catch and let go at different distances, so it never flickers.
 */
export type DockId = "bottom_centre" | "bottom_right" | "lock_left" | "lock_right" | "free";
export type DockBox = { x: number; y: number; w: number; h: number };
export const DOCK_SPOTS: DockId[] = ["bottom_centre", "bottom_right", "lock_left", "lock_right"];

export type DockConfig = {
  stiffness: number;
  damping: number;
  throwSeconds: number;
  sideZone: number;
  bottomZone: number;
  release: number;
  rubber: number;
  insets: { left: number; right: number; top: number; bottom: number };
  widths: { centre: number; right: number; lock: number; free: number };
  /** Space kept clear at the top for the board toolbar. */
  toolbarClear: number;
};

export const ASK_DOCK_CONFIG: DockConfig = {
  stiffness: 520,
  damping: 36,
  throwSeconds: 0.12,
  sideZone: 120,
  bottomZone: 150,
  release: 40,
  rubber: 0.08,
  insets: { left: 12, right: 12, top: 12, bottom: 16 },
  widths: { centre: 600, right: 430, lock: 380, free: 460 },
  toolbarClear: 74,
};

const clamp = (n: number, a: number, b: number) => Math.min(Math.max(n, a), Math.max(a, b));

export function dockBox(id: DockId, W: number, H: number, c: DockConfig, contentH: number, free: { x: number; y: number }, topInset = 0, opts: { userH?: number | null; fitLock?: boolean; expanded?: boolean } = {}): DockBox {
  const { left, right, bottom } = c.insets;
  const top = c.insets.top + topInset;
  const room = W - left - right;
  const clearTop = c.toolbarClear + topInset;
  const natural = Math.min(contentH, H * (opts.userH != null || opts.expanded ? 0.74 : 0.52), H - bottom - clearTop);
  const h = opts.userH != null ? Math.min(opts.userH, H - bottom - clearTop) : natural;
  const lockH = opts.fitLock ? natural : H - top - bottom;
  if (id === "lock_left") return { x: left, y: top, w: Math.min(c.widths.lock, room), h: lockH };
  if (id === "lock_right") {
    const w = Math.min(c.widths.lock, room);
    return { x: W - right - w, y: top, w, h: lockH };
  }
  if (id === "bottom_right") {
    const w = Math.min(clamp(Math.round(W * 0.34), 320, 400), room);
    return { x: W - right - w, y: H - bottom - h, w, h };
  }
  if (id === "bottom_centre") {
    const w = Math.min(c.widths.centre, room);
    return { x: left + (room - w) / 2, y: H - bottom - h, w, h };
  }
  const w = Math.min(c.widths.free, room);
  return { x: clamp(free.x, 8, W - w - 8), y: clamp(free.y, clearTop, H - h - 8), w, h };
}

/** Where a point falls. A wider read for a surface already caught is what stops flicker. */
export function dockZoneAt(p: { x: number; y: number }, W: number, H: number, c: DockConfig, grow = 0, held: DockId | null = null): DockId | null {
  const side = c.sideZone + c.insets.left;
  const sideR = c.sideZone + c.insets.right;
  const inBottom = p.y > H - c.bottomZone - (held && held.startsWith("bottom") ? grow : 0);
  const splitX = W - c.insets.right - c.widths.right;
  if (p.x < side + (held === "lock_left" ? grow : 0)) return "lock_left";
  if (inBottom) {
    if (held === "bottom_right" && p.x > splitX - grow) return "bottom_right";
    if (held === "bottom_centre" && p.x < splitX + grow) return "bottom_centre";
    return p.x > splitX ? "bottom_right" : "bottom_centre";
  }
  if (p.x > W - sideR - (held === "lock_right" ? grow : 0)) return "lock_right";
  return null;
}

export type AskDock = {
  surfaceRef: RefObject<HTMLElement | null>;
  dock: DockId;
  hover: DockId | null;
  carried: boolean;
  spots: Record<string, DockBox> | null;
  moveTo: (id: DockId) => void;
  refresh: () => void;
  setHeight: (h: number | null, edge?: "top" | "bottom") => void;
  height: () => number;
  bind: {
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
    onPointerMove: (e: ReactPointerEvent<HTMLElement>) => void;
    onPointerUp: (e: ReactPointerEvent<HTMLElement>) => void;
    onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => void;
  };
};

export function useAskDock(args: {
  host: HTMLElement;
  initial: { to: DockId; x?: number; y?: number };
  contentHeight: () => number;
  topInset: () => number;
  onLand: (to: DockId, free: { x: number; y: number }) => void;
  config?: DockConfig;
  initialHeight?: number | null;
  fitLock?: () => boolean;
  expanded?: () => boolean;
}): AskDock {
  const { host } = args;
  const surfaceRef = useRef<HTMLElement>(null);
  const cfg = useRef(args.config ?? ASK_DOCK_CONFIG);
  cfg.current = args.config ?? ASK_DOCK_CONFIG;
  const latest = useRef(args);
  latest.current = args;

  const [dock, setDock] = useState<DockId>(args.initial.to);
  const dockRef = useRef(dock);
  const [hover, setHover] = useState<DockId | null>(null);
  const [carried, setCarried] = useState(false);
  const [spots, setSpots] = useState<Record<string, DockBox> | null>(null);

  const m = useRef({
    x: 0, y: 0, w: 0, h: 0, vx: 0, vy: 0, vw: 0, vh: 0,
    tx: 0, ty: 0, tw: 0, th: 0, ox: 0, oy: 0,
    W: 0, H: 0, ready: false,
    free: { x: args.initial.x ?? 240, y: args.initial.y ?? 200 },
    pending: false, drag: false, follow: false, cap: null as DockId | null, shown: null as DockId | null,
    gx: 0.5, gy: 0.5, px: 0, py: 0, sx: 0, sy: 0,
    hist: [] as { t: number; x: number; y: number }[],
    raf: 0, last: 0, cancelTo: args.initial.to as DockId,
    userH: (args.initialHeight ?? null) as number | null,
  }).current;

  const reduced = () => {
    try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
  };

  const paint = useCallback(() => {
    const el = surfaceRef.current;
    if (!el) return;
    el.style.transform = `translate3d(${m.x.toFixed(2)}px,${m.y.toFixed(2)}px,0)`;
    el.style.width = `${m.w.toFixed(2)}px`;
    el.style.height = `${m.h.toFixed(2)}px`;
  }, [m]);

  const box = useCallback((id: DockId) => dockBox(id, m.W, m.H, cfg.current, latest.current.contentHeight(), m.free, latest.current.topInset(), { userH: m.userH, fitLock: latest.current.fitLock?.() ?? false, expanded: latest.current.expanded?.() ?? false }), [m]);
  const allSpots = useCallback(() => Object.fromEntries(DOCK_SPOTS.map((id) => [id, box(id)])), [box]);
  const kickRef = useRef<() => void>(() => undefined);

  const tick = useCallback((now: number) => {
    const c = cfg.current;
    const dt = Math.min((now - m.last) / 1000, 1 / 30);
    m.last = now;
    const steps = 3;
    const hStep = dt / steps;
    for (let i = 0; i < steps; i += 1) {
      m.vw += (-c.stiffness * (m.w - m.tw) - c.damping * m.vw) * hStep;
      m.w += m.vw * hStep;
      m.vh += (-c.stiffness * (m.h - m.th) - c.damping * m.vh) * hStep;
      m.h += m.vh * hStep;
      if (!(m.drag && m.follow)) {
        m.vx += (-c.stiffness * (m.x - m.tx) - c.damping * m.vx) * hStep;
        m.x += m.vx * hStep;
        m.vy += (-c.stiffness * (m.y - m.ty) - c.damping * m.vy) * hStep;
        m.y += m.vy * hStep;
      }
    }
    if (m.drag && m.follow) {
      const decay = Math.exp(-20 * dt);
      m.ox *= decay;
      m.oy *= decay;
      m.x = m.px - m.gx * m.w + m.ox;
      m.y = m.py - m.gy * m.h + m.oy;
      m.vx = 0;
      m.vy = 0;
    }
    paint();
    const still = Math.abs(m.x - m.tx) < 0.3 && Math.abs(m.y - m.ty) < 0.3 && Math.abs(m.w - m.tw) < 0.3 && Math.abs(m.h - m.th) < 0.3
      && Math.abs(m.vx) + Math.abs(m.vy) + Math.abs(m.vw) + Math.abs(m.vh) < 6;
    if (!m.drag && still) {
      m.x = m.tx; m.y = m.ty; m.w = m.tw; m.h = m.th;
      m.vx = 0; m.vy = 0; m.vw = 0; m.vh = 0;
      paint();
      m.raf = 0;
      // Text rewraps at the final width, so the true height is only known here.
      const b = box(dockRef.current);
      if (Math.abs(b.h - m.th) > 1) {
        m.tx = b.x; m.ty = b.y; m.tw = b.w; m.th = b.h;
        kickRef.current();
      }
      return;
    }
    m.raf = requestAnimationFrame(tick);
  }, [box, m, paint]);

  const kick = useCallback(() => {
    if (m.raf) return;
    m.last = performance.now();
    m.raf = requestAnimationFrame(tick);
  }, [m, tick]);
  kickRef.current = kick;

  const retarget = useCallback((id: DockId, jump = false) => {
    if (!m.W) return;
    const b = box(id);
    m.tx = b.x; m.ty = b.y; m.tw = b.w; m.th = b.h;
    if (jump || !m.ready || reduced()) {
      m.x = b.x; m.y = b.y; m.w = b.w; m.h = b.h;
      m.vx = 0; m.vy = 0; m.vw = 0; m.vh = 0;
      m.ready = true;
      paint();
      return;
    }
    kick();
  }, [box, kick, m, paint]);

  const commit = useCallback((id: DockId, land: boolean) => {
    dockRef.current = id;
    setDock(id);
    setHover(null);
    setSpots(null);
    setCarried(false);
    m.cap = null;
    m.shown = null;
    if (land) latest.current.onLand(id, m.free);
    retarget(id);
  }, [m, retarget]);

  const refresh = useCallback(() => { if (!m.drag) retarget(dockRef.current); }, [m, retarget]);
  const moveTo = useCallback((id: DockId) => commit(id, true), [commit]);

  useLayoutEffect(() => {
    const measure = () => {
      m.W = host.clientWidth;
      m.H = host.clientHeight;
      if (!m.drag) retarget(dockRef.current, true);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(host);
    return () => ro.disconnect();
  }, [host, m, retarget]);

  useEffect(() => () => {
    if (m.raf) cancelAnimationFrame(m.raf);
    m.raf = 0;
    document.body.style.userSelect = "";
  }, [m]);

  const local = (e: { clientX: number; clientY: number }) => {
    const r = host.getBoundingClientRect();
    const scale = r.width / (host.offsetWidth || 1) || 1;
    return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale };
  };

  const finish = useCallback((cancel: boolean) => {
    const c = cfg.current;
    document.body.style.userSelect = "";
    m.drag = false;
    if (cancel) { commit(m.cancelTo, false); return; }
    const a = m.hist[0];
    const b = m.hist[m.hist.length - 1];
    let vx = 0;
    let vy = 0;
    if (a && b && b.t > a.t && performance.now() - b.t < 60) {
      vx = ((b.x - a.x) / (b.t - a.t)) * 1000;
      vy = ((b.y - a.y) / (b.t - a.t)) * 1000;
    }
    const proj = { x: m.px + vx * c.throwSeconds, y: m.py + vy * c.throwSeconds };
    const to: DockId = m.cap ?? dockZoneAt(proj, m.W, m.H, c) ?? "free";
    if (to === "free") {
      const f = box("free");
      m.free = { x: proj.x - m.gx * f.w, y: proj.y - m.gy * f.h };
    }
    m.vx = clamp(vx, -2400, 2400);
    m.vy = clamp(vy, -2400, 2400);
    commit(to, true);
  }, [box, commit, m]);

  const onEscape = useRef<(e: KeyboardEvent) => void>(() => undefined);
  const listener = useRef((e: KeyboardEvent) => onEscape.current(e)).current;
  onEscape.current = (e: KeyboardEvent) => {
    if (e.key === "Escape" && m.drag) {
      e.preventDefault();
      window.removeEventListener("keydown", listener);
      finish(true);
    }
  };

  const begin = () => {
    m.drag = true;
    m.follow = true;
    m.gx = clamp((m.sx - m.x) / (m.w || 1), 0, 1);
    m.gy = clamp((m.sy - m.y) / (m.h || 1), 0, 1);
    m.ox = 0; m.oy = 0;
    m.cap = null;
    m.shown = null;
    m.cancelTo = dockRef.current;
    m.hist = [];
    document.body.style.userSelect = "none";
    window.addEventListener("keydown", listener);
    setCarried(true);
    setSpots(allSpots());
    const f = box("free");
    m.tw = f.w;
    m.th = f.h;
    kick();
  };

  const track = (p: { x: number; y: number }) => {
    const c = cfg.current;
    const z = dockZoneAt(p, m.W, m.H, c, c.release, m.cap);
    if (z !== m.cap) {
      m.cap = z;
      if (z) {
        const b = box(z);
        m.follow = false;
        m.tw = b.w; m.th = b.h; m.tx = b.x; m.ty = b.y;
      } else {
        m.follow = true;
        const f = box("free");
        m.tw = f.w; m.th = f.h;
        m.ox = m.x - (p.x - m.gx * m.w);
        m.oy = m.y - (p.y - m.gy * m.h);
      }
      kick();
    }
    if (z) {
      const b = box(z);
      m.tx = b.x + (p.x - m.gx * b.w - b.x) * c.rubber;
      m.ty = b.y + (p.y - m.gy * b.h - b.y) * c.rubber;
    }
    if (z !== m.shown) {
      m.shown = z;
      setHover(z);
    }
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("button,textarea,input,a,select,[data-no-drag],.ask-draft-body")) return;
    const p = local(e);
    m.pending = true;
    m.sx = p.x; m.sy = p.y; m.px = p.x; m.py = p.y;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* the pointer is already gone */ }
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    if (!m.pending && !m.drag) return;
    const p = local(e);
    if (m.pending) {
      if (Math.hypot(p.x - m.sx, p.y - m.sy) < 3) return;
      m.pending = false;
      begin();
    }
    m.px = p.x; m.py = p.y;
    const t = performance.now();
    m.hist.push({ t, x: p.x, y: p.y });
    while (m.hist.length > 2 && t - (m.hist[0]?.t ?? t) > 90) m.hist.shift();
    track(p);
    kick();
  };
  const end = (cancel: boolean) => {
    m.pending = false;
    if (!m.drag) return;
    window.removeEventListener("keydown", listener);
    finish(cancel);
  };

  return {
    surfaceRef, dock, hover, carried, spots, moveTo, refresh,
    setHeight: (h: number | null, edge: "top" | "bottom" = "bottom") => {
      if (h === null) { m.userH = null; refresh(); return; }
      const bottomGap = cfg.current.insets.bottom;
      const next = Math.min(h, m.H - bottomGap - cfg.current.toolbarClear - (latest.current.topInset?.() ?? 0));
      if (dockRef.current === "free" && edge === "top") m.free = { x: m.free.x, y: m.y + m.h - next };
      m.userH = next;
      const b = box(dockRef.current);
      m.tx = b.x; m.ty = b.y; m.tw = b.w; m.th = b.h; m.x = b.x; m.y = b.y; m.w = b.w; m.h = b.h;
      m.vx = 0; m.vy = 0; m.vw = 0; m.vh = 0;
      paint();
    },
    height: () => m.h,
    bind: { onPointerDown, onPointerMove, onPointerUp: () => end(false), onPointerCancel: () => end(true) },
  };
}
