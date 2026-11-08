import { stableMemo } from "@/components/canvas-lab/stable-memo";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";

import type { LabAnchor, LabNode, LabResizeCorner } from "@/components/canvas-lab/canvas-lab-model";
import { cardBodyClickSelects, createCardClickController, type CardSelectVia } from "@/lib/card-click";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { serializeWorkboardImageBody, type WorkboardImageBody, type WorkboardNodeInput } from "@/lib/canvas-lab-shared";
import { storageObjectKey } from "@/lib/upload-payload";
import { signWorkboardFileUrl } from "@/lib/workboard-file-sign";

export const BOARD_IMAGE_COPY = {
  failed: "This image could not be loaded.",
  remove: "Remove image",
  label: "Image",
} as const;

export const BOARD_IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/avif", "image/svg+xml"] as const;

export function isBoardImageFile(file: File): boolean {
  return (BOARD_IMAGE_MIME_TYPES as readonly string[]).includes(file.type);
}

export function fitWithin(width: number, height: number, max = 2048): { width: number; height: number } {
  const ratio = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) };
}

type PreparedImage = { file: File; size: { width: number; height: number } };
const preparedImages = new WeakMap<File, Promise<PreparedImage>>();

/** Prepare once per file so sizing and upload always use the same bytes. */
function prepareBoardImage(file: File): Promise<PreparedImage> {
  const existing = preparedImages.get(file);
  if (existing) return existing;
  const unchanged: PreparedImage = { file, size: { width: 0, height: 0 } };
  const canvas = typeof document === "undefined" ? null : document.createElement("canvas");
  let context: CanvasRenderingContext2D | null = null;
  try { context = canvas?.getContext("2d") ?? null; } catch { /* Canvas is unavailable. */ }
  if (!canvas || !context) {
    const fallback = Promise.resolve(unchanged);
    preparedImages.set(file, fallback);
    return fallback;
  }
  const drawingContext = context;
  let url: string | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<PreparedImage>((resolve) => {
    timer = setTimeout(() => resolve(unchanged), 4000);
  });
  const decode = new Promise<PreparedImage>((resolve, reject) => {
    url = URL.createObjectURL(file);
    const imageUrl = url;
    const image = new Image();
    image.onerror = () => { URL.revokeObjectURL(imageUrl); reject(new Error("unreadable")); };
    image.onload = () => {
      const original = { width: image.naturalWidth, height: image.naturalHeight };
      const size = fitWithin(original.width, original.height);
      if (original.width <= 0 || original.height <= 0) {
        URL.revokeObjectURL(imageUrl);
        reject(new Error("no size"));
        return;
      }
      if (size.width === original.width && size.height === original.height) {
        URL.revokeObjectURL(imageUrl);
        resolve({ file, size: original });
        return;
      }
      try {
        canvas.width = size.width;
        canvas.height = size.height;
        drawingContext.drawImage(image, 0, 0, size.width, size.height);
        URL.revokeObjectURL(imageUrl);
        const type = file.type === "image/png" ? "image/png" : "image/jpeg";
        canvas.toBlob(async (blob) => {
          if (!blob) { resolve({ file, size: original }); return; }
          const scaled = new File([blob], file.name, { type });
          try { resolve({ file: scaled, size: await readNaturalImageSize(scaled) }); }
          catch { resolve({ file, size: original }); }
        }, type, 0.9);
      } catch {
        URL.revokeObjectURL(imageUrl);
        resolve({ file, size: original });
      }
    };
    image.src = imageUrl;
  });
  const prepared = Promise.race([decode.catch(() => unchanged), timeout]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
    if (url !== null) URL.revokeObjectURL(url);
  });
  preparedImages.set(file, prepared);
  return prepared;
}

/** Read the encoded blob's natural pixel size. The object URL is always revoked. */
function readNaturalImageSize(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const size = { width: image.naturalWidth, height: image.naturalHeight };
      URL.revokeObjectURL(url);
      if (size.width > 0 && size.height > 0) resolve(size);
      else reject(new Error("no size"));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("unreadable"));
    };
    image.src = url;
  });
}

export async function readImageSize(file: File): Promise<{ width: number; height: number }> {
  return (await prepareBoardImage(file)).size;
}

/** Same bucket and folder convention as the existing capture path: {userId}/{uuid}-{name}. */
export async function uploadBoardImage(file: File): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id;
  if (!userId) return null;
  let upload = file;
  try { upload = (await prepareBoardImage(file)).file; } catch { /* Undecodable files upload unchanged. */ }
  const path = storageObjectKey(userId, crypto.randomUUID(), file.name);
  const { error } = await supabase.storage.from("work-files").upload(path, upload);
  return error ? null : path;
}

/** Deleting an image node deletes its file. Nothing in the database cascades to storage. */
export async function removeBoardImageObject(path: string): Promise<boolean> {
  const { error } = await supabase.storage.from("work-files").remove([path]);
  return !error;
}

export function buildImageNodeInput(input: { clientKey: string; body: WorkboardImageBody; x: number; y: number; w: number; h: number; hidden?: boolean }): WorkboardNodeInput {
  return {
    clientKey: input.clientKey,
    frameKey: null,
    kind: "image",
    workItemId: null,
    decisionId: null,
    body: serializeWorkboardImageBody(input.body),
    x: input.x,
    y: input.y,
    w: input.w,
    h: input.h,
    hidden: input.hidden ?? false,
  };
}

const CORNERS: LabResizeCorner[] = ["nw", "ne", "se", "sw"];

/** DD1-f: the picture itself on the board, no card chrome. */
function LabImageInner({ node, selected, layoutEditable, onSelect, onContextSelect, contextSelected = false, previewSelected = false, connecting = false, connectSourceAnchor = null, onAnchorPointerDown, onAnchorActivate, onDragStart, onResizeStart, onResizeKeyDown, onResizeKeyUp, onRemove }: {
  node: LabNode;
  selected: boolean;
  layoutEditable: boolean;
  onSelect: () => void;
  onContextSelect?: (via: CardSelectVia) => void;
  contextSelected?: boolean;
  previewSelected?: boolean;
  connecting?: boolean;
  connectSourceAnchor?: LabAnchor | null;
  onAnchorPointerDown?: (side: LabAnchor, event: ReactPointerEvent<HTMLButtonElement>) => void;
  onAnchorActivate?: (side: LabAnchor) => void;
  onDragStart: (event: ReactPointerEvent<HTMLElement>) => void;
  onResizeStart: (corner: LabResizeCorner, event: ReactPointerEvent<HTMLButtonElement>) => void;
  onResizeKeyDown: (corner: LabResizeCorner, event: ReactKeyboardEvent<HTMLButtonElement>) => void;
  onResizeKeyUp: (event: ReactKeyboardEvent<HTMLButtonElement>) => void;
  onRemove: () => void;
}) {
  const clickDownRef = useRef<{ x: number; y: number } | null>(null);
  const anchorDownRef = useRef<{ x: number; y: number } | null>(null);
  const contextSelectRef = useRef(onContextSelect);
  contextSelectRef.current = onContextSelect;
  const clickControllerRef = useRef<ReturnType<typeof createCardClickController> | null>(null);
  clickControllerRef.current ??= createCardClickController({ select: (via) => contextSelectRef.current?.(via), schedule: (run, ms) => window.setTimeout(run, ms), cancel: (id) => window.clearTimeout(id) });
  useEffect(() => () => clickControllerRef.current?.flush(), []);
  const [state, setState] = useState<{ status: "loading" | "ready" | "failed"; url: string | null }>({ status: "loading", url: null });
  const path = node.imagePath;
  useEffect(() => {
    let live = true;
    if (!path) { setState({ status: "failed", url: null }); return; }
    setState({ status: "loading", url: null });
    signWorkboardFileUrl(path, 3600)
      .then((url) => { if (live) setState(url ? { status: "ready", url } : { status: "failed", url: null }); })
      .catch(() => { if (live) setState({ status: "failed", url: null }); });
    return () => { live = false; };
  }, [path]);
  const style = { left: node.x, top: node.y, width: node.width, height: node.height } satisfies CSSProperties;
  return (
    <section data-testid={`image-${node.id}`} data-node-id={node.id} data-connecting={connecting} data-selected={selected} data-status={state.status} aria-label={BOARD_IMAGE_COPY.label} tabIndex={0} className={`canvas-lab-card absolute rounded-[2px] ${selected ? "outline outline-2 outline-offset-2 outline-primary" : ""}`} style={style} onFocus={onSelect} onPointerDown={(event) => { clickDownRef.current = { x: event.clientX, y: event.clientY }; if (!selected) onSelect(); onDragStart(event); }} onPointerCancel={() => { clickDownRef.current = null; }} onClick={(event) => {
      const onControl = Boolean((event.target as Element).closest("button,textarea,a,input,select,[role='menu'],[role='menuitem']"));
      if (cardBodyClickSelects({ readOnly: !onContextSelect, clickCount: event.detail, down: clickDownRef.current, up: { x: event.clientX, y: event.clientY }, onControl })) clickControllerRef.current?.click();
    }} onDoubleClick={() => clickControllerRef.current?.undo()}>
      <div data-selected={contextSelected} data-marquee-preview={previewSelected} className="canvas-lab-card-paper h-full w-full rounded-[2px]">
      {state.status === "ready" && state.url ? (
        <img src={state.url} alt="" draggable={false} className="block h-full w-full rounded-[2px] select-none" onError={() => setState({ status: "failed", url: null })} />
      ) : (
        <div data-testid="board-image-placeholder" className="flex h-full w-full items-center justify-center rounded-[2px] bg-muted p-2 text-center nb-type-small text-muted-foreground">
          {state.status === "failed" ? <span>{BOARD_IMAGE_COPY.failed}</span> : null}
        </div>
      )}
      </div>
      {selected && layoutEditable ? <div className="canvas-lab-text-block-controls" onPointerDown={(event) => event.stopPropagation()}>
        <Button type="button" size="sm" variant="ghost" onClick={onRemove}>{BOARD_IMAGE_COPY.remove}</Button>
      </div> : null}
      {selected && layoutEditable ? CORNERS.map((corner) => <button key={corner} type="button" className="canvas-lab-resize-handle" data-corner={corner} aria-label={`Resize image from ${corner}`} onPointerDown={(event) => onResizeStart(corner, event)} onKeyDown={(event) => onResizeKeyDown(corner, event)} onKeyUp={onResizeKeyUp} />) : null}
      {onAnchorPointerDown && onAnchorActivate ? (["top", "right", "bottom", "left"] as LabAnchor[]).map((side) => <Button key={side} type="button" variant="ghost" size="icon" className="canvas-lab-anchor" data-node-id={node.id} data-side={side} data-active={connectSourceAnchor === side} aria-label={`Connect from ${side}`} onPointerDown={(event) => { anchorDownRef.current = { x: event.clientX, y: event.clientY }; onAnchorPointerDown(side, event); }} onClick={(event) => { event.stopPropagation(); const down = anchorDownRef.current; anchorDownRef.current = null; if (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) >= 6) return; onAnchorActivate(side); }} />) : null}
    </section>
  );
}

/** BB-3: memoized so typing in one card never re-renders its siblings. */
export const LabImage = stableMemo(LabImageInner);
