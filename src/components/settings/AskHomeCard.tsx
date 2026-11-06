import { useEffect, useState } from "react";

import { useProfile } from "@/hooks/use-profile";
import { ASK_HOMES, readAskHome, writeAskHome, type AskHome } from "@/lib/ask-draft";
import { logEvent } from "@/lib/telemetry";

/** SET-1: where a new Ask Lasso chat opens. Browser-local, per person. */
export function AskHomeCard() {
  const { data: profile } = useProfile();
  const [home, setHome] = useState<AskHome>("bottom_right");

  useEffect(() => {
    if (typeof window === "undefined") return;
    setHome(readAskHome(window.localStorage));
  }, []);

  function choose(id: AskHome) {
    writeAskHome(id, typeof window === "undefined" ? null : window.localStorage);
    setHome(id);
    if (profile?.org_id) logEvent("settings.changed", profile.org_id, { section: "appearance", setting: "ask_home", change: "updated" });
  }

  return (
    <section>
      <h2 className="micro-label micro-label-section">Where Ask Lasso opens</h2>
      <div className="mt-3 space-y-4 rounded-[var(--radius)] border border-border bg-card px-4 py-4 shadow-card">
        <p className="text-sm text-muted-foreground">A new chat starts here, closed. You can still drag it anywhere.</p>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Where Ask Lasso opens">
          {ASK_HOMES.map((option) => (
            <label key={option.id} className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="radio" name="ask-home" value={option.id} checked={home === option.id} onChange={() => choose(option.id)} />
              {option.label}
            </label>
          ))}
        </div>
      </div>
    </section>
  );
}
