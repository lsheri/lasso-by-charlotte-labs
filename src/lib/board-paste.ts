/** What a paste on the board holds. Pure, so every source can be tested without a clipboard. */
export type PasteInput = {
  files: ReadonlyArray<{ name: string; type: string }>;
  text: string;
  html: string;
  uriList: string;
};

export type PasteRead =
  | { kind: "files" }
  | { kind: "text"; text: string; capped: boolean }
  | { kind: "refused"; reason: "figma" | "finder" }
  | { kind: "none" };

export const BOARD_PASTE_TEXT_CAP = 4000;

export const BOARD_PASTE_COPY = {
  figma: "FigJam copied its own objects, not a picture. Use Copy as PNG (Shift Cmd C), then paste here.",
  finder: "Your browser only gets an icon from a Finder copy. Drag the file onto the board instead.",
  capped: "Added the first 4,000 characters.",
  failed: "That paste did not come in.",
} as const;

const FILE_NAME = /^[^\t/\\:]+\.[A-Za-z0-9]{1,8}$/;

export function readPaste(input: PasteInput): PasteRead {
  const names = input.text.split(/\r\n|\r|\n/).map((line) => line.trim()).filter(Boolean);
  const hasFiles = input.files.length > 0;
  // Figma and FigJam put their own objects on the clipboard as marked HTML. Copy as PNG arrives as a file.
  if (!hasFiles && /\(fig(ma|meta)\)/.test(input.html)) return { kind: "refused", reason: "figma" };
  if (!hasFiles && input.uriList.trim().startsWith("file:")) return { kind: "refused", reason: "finder" };
  // Chrome on macOS hands over the file names as text and the Finder icon as the file.
  if (hasFiles && names.length > 0 && names.every((name) => FILE_NAME.test(name)) && !names.every((name) => input.files.some((file) => file.name === name))) {
    return { kind: "refused", reason: "finder" };
  }
  if (hasFiles) return { kind: "files" };
  const text = input.text.trim();
  if (!text) return { kind: "none" };
  return text.length > BOARD_PASTE_TEXT_CAP
    ? { kind: "text", text: text.slice(0, BOARD_PASTE_TEXT_CAP), capped: true }
    : { kind: "text", text, capped: false };
}

/** A paste belongs to the field the person is typing in, or to an open dialog, never the board. */
export function pasteBelongsToBoard(target: EventTarget | null, activeElement: Element | null): boolean {
  for (const el of [target, activeElement]) {
    if (!(el instanceof Element)) continue;
    if (el.closest('input, textarea, select, [contenteditable="true"], [role="textbox"], [role="dialog"], .ask-draft')) return false;
  }
  return true;
}
