import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

/**
 * A one time pointer to the AI record page. Content free: it names a place,
 * never a piece of work. Once dismissed, or once the person has opened AI
 * record, it never comes back.
 *
 * Note for the architect: profiles has no meta column and this pass forbids
 * schema changes, so the flag lives in the browser. Move it to a profile
 * column when one exists.
 */
const KEY = "lasso.ai_record_pointer_done";

export function markAiRecordSeen(): void {
  try {
    window.localStorage.setItem(KEY, "1");
  } catch {
    /* a pointer is a convenience, never a requirement */
  }
}

export function AiRecordPointer() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      setShow(window.localStorage.getItem(KEY) !== "1");
    } catch {
      setShow(false);
    }
  }, []);

  if (!show) return null;

  return (
    <div className="flex items-start justify-between gap-3 rounded-[var(--radius-md)] border border-border bg-muted/40 px-4 py-2">
      <p className="text-xs text-muted-foreground">
        Your full AI history now lives in{" "}
        <Link
          to="/ai-record"
          onClick={markAiRecordSeen}
          className="text-accent-deep underline underline-offset-2"
        >
          AI record
        </Link>
        , in the sidebar under Your work.
      </p>
      <button
        type="button"
        onClick={() => {
          markAiRecordSeen();
          setShow(false);
        }}
        aria-label="Dismiss"
        className="font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        ✕
      </button>
    </div>
  );
}
