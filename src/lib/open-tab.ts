/**
 * H7g: open a page in a new tab and say whether it opened.
 *
 * window.open with "noopener" always returns null (the spec hides the new window), so it cannot tell an
 * opened tab from a blocked pop-up: every successful hand-off read as blocked, said "Pop-up blocked", and
 * then waited on a clipboard write in a page that had just lost focus, which held back its event. Open
 * plainly, then cut the opener link at once, before the new page can run anything.
 */
export function openInNewTab(url: string): boolean {
  const opened = window.open(url, "_blank");
  if (!opened) return false;
  try {
    opened.opener = null;
  } catch {
    /* a cross-origin window that already dropped it */
  }
  return true;
}
