import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

export function AccountEmailCard() {
  const [current, setCurrent] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      setCurrent(data.user?.email ?? null);
      setPendingEmail((data.user?.new_email as string | undefined) ?? null);
    });
  }, []);

  async function changeEmail(event: React.FormEvent) {
    event.preventDefault();
    const email = value.trim();
    if (!email) return;
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ email });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setPendingEmail(email);
    setValue("");
    toast.success("Check your new address for a confirmation link");
  }

  return (
    <section>
      <h2 className="micro-label">Account</h2>
      <div className="mt-3 space-y-3 rounded-[var(--radius)] border border-border bg-card px-4 py-4 shadow-card">
        <p className="text-sm text-muted-foreground">
          Your work record belongs to your account. If you&apos;re leaving a company, switch to a
          personal email to keep signing in.
        </p>
        <p className="text-sm text-foreground">
          Signing in as <span className="font-medium">{current ?? "…"}</span>
        </p>
        {pendingEmail ? (
          <p className="rounded-[var(--radius)] border border-border bg-secondary px-3 py-2 text-xs text-muted-foreground">
            Pending change to <span className="font-mono">{pendingEmail}</span>, confirm it from
            the link we sent to that address.
          </p>
        ) : null}
        <form onSubmit={changeEmail} className="flex flex-wrap items-center gap-2">
          <Input
            type="email"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="you@personal.com"
            className="max-w-xs"
          />
          <Button type="submit" disabled={saving}>
            {saving ? "Sending…" : "Change login email"}
          </Button>
        </form>
      </div>
    </section>
  );
}
