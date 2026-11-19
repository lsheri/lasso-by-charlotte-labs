import { useEffect, useState } from "react";

import { OPEN_DIALOG } from "./measure-anchor";

/**
 * Whether a dialog is open anywhere on the page. The story gives way to it: a card drawn over a dialog hides the
 * dialog's own controls, and a press on that card counts as a press outside the dialog, which closes it.
 */
export function useDialogOpen(): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const read = () => setOpen(document.querySelector(OPEN_DIALOG) !== null);
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-state", "role"] });
    return () => observer.disconnect();
  }, []);

  return open;
}
