import { useEffect, useState } from "react";

import { ANY_DIALOG, anyDialogOpen } from "./measure-anchor";

/**
 * Whether a dialog is open anywhere on the page. The story gives way to it: a card drawn over a dialog hides the
 * dialog's own controls, and a press on that card counts as a press outside the dialog, which closes it.
 *
 * It watches the page only while `watching` is true, so a person who never opened the story pays nothing for it.
 */
export function useDialogOpen(watching: boolean): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!watching) {
      setOpen(false);
      return;
    }
    const watched = new WeakSet<Element>();
    // A dialog built by hand shows and hides through its own style, class or hidden attribute. Watch those on the
    // dialog itself, never on the whole page, where every drag on a board changes a style.
    const own = new MutationObserver(() => read());
    function read() {
      for (const dialog of document.querySelectorAll(ANY_DIALOG)) {
        if (dialog.hasAttribute("data-state") || watched.has(dialog)) continue;
        watched.add(dialog);
        own.observe(dialog, { attributes: true, attributeFilter: ["style", "class", "hidden"] });
      }
      setOpen(anyDialogOpen());
    }
    read();
    const page = new MutationObserver(read);
    page.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-state", "role"] });
    return () => {
      page.disconnect();
      own.disconnect();
    };
  }, [watching]);

  return open;
}
