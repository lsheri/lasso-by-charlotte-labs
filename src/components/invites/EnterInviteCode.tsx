import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Accepts a bare code or a full invite link and pulls out code + engagement. */
export function parseInvite(raw: string): { code: string; eng?: string } | null {
  const value = raw.trim();
  if (!value) return null;
  if (value.includes("?") || value.includes("://")) {
    const query = value.slice(value.indexOf("?") + 1);
    const params = new URLSearchParams(query);
    const code = params.get("code");
    const eng = params.get("eng");
    if (code) return eng ? { code, eng } : { code };
    return null;
  }
  return /^[a-zA-Z0-9-]{4,}$/.test(value) ? { code: value } : null;
}

export function EnterInviteCode({
  label = "Have an invite?",
  bare = false,
}: {
  label?: string;
  /** Render without card chrome when already inside a card. */
  bare?: boolean;
}) {
  const navigate = useNavigate();
  const [raw, setRaw] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = parseInvite(raw);
    if (!parsed) {
      setError("That doesn't look like an invite code or link.");
      return;
    }
    setError(null);
    navigate({
      to: "/join",
      search: parsed.eng ? { code: parsed.code, eng: parsed.eng } : { code: parsed.code },
    });
  }

  return (
    <form
      onSubmit={submit}
      className={
        bare ? "" : "rounded-[var(--radius)] border border-border bg-card p-5 shadow-card"
      }
    >
      <Label htmlFor="invite-entry" className="micro-label">
        {label}
      </Label>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Paste the code or the full link you were sent.
      </p>
      <div className="mt-3 grid gap-2">
        <Input
          id="invite-entry"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder="a1b2c3d4e5f6"
          className="w-full min-w-0 font-mono"
        />
        <Button type="submit" className={bare ? "w-full" : "sm:w-auto"}>
          Continue
        </Button>
      </div>
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
    </form>
  );
}
