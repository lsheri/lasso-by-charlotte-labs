import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAffiliation } from "@/hooks/use-affiliation";
import { useProfile } from "@/hooks/use-profile";
import { normalizeCode, type RedeemOutcome } from "@/lib/activation-keys";
import { redeemActivationKeyFn } from "@/lib/activation-keys.functions";
import { logEvent } from "@/lib/telemetry";

type Result = RedeemOutcome & { institution_name?: string };

export function ActivationKeyCard() {
  const { data: profile } = useProfile();
  const { data: affiliation } = useAffiliation();
  const queryClient = useQueryClient();
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  // Admin only. Redeeming links the WHOLE workspace to an institution, and
  // that affiliation is one per workspace and effectively permanent, so an
  // ordinary member must not be able to do it. Every personal and school
  // workspace profile is already admin, so this locks out nobody who would
  // legitimately hold a key.
  if (!profile || profile.role !== "admin") return null;

  const institution = affiliation?.institution ?? null;

  if (institution) {
    return (
      <section>
        <h2 className="micro-label micro-label-section">Activation key</h2>
        <div className="mt-3 space-y-4 rounded-[var(--radius)] border border-border bg-card px-4 py-4 shadow-card">
          <p className="text-sm text-foreground">
            This workspace is linked to {institution.name}.{" "}
            <Link to="/affiliation" className="underline underline-offset-2">
              What {institution.name} sees
            </Link>
          </p>
        </div>
      </section>
    );
  }

  // Display only. The database normalises the code independently inside
  // redeem_activation_key; this is not the check.
  const display = normalizeCode(raw);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!profile || !display || busy) return;
    setBusy(true);
    let outcome: Result;
    try {
      // profile_id is required: without it the server falls back to the
      // caller's oldest workspace, the wrong one for anyone with several.
      outcome = await redeemActivationKeyFn({
        data: { code: raw, profile_id: profile.id },
      });
    } catch {
      outcome = { ok: false, reason: "error", message: "Something went wrong. Try again in a moment." };
    }
    setResult(outcome);
    setBusy(false);
    // Reason and entry point only. Never the key.
    logEvent("activation_key.submitted", profile.org_id, {
      reason: outcome.reason,
      from: "settings",
    });
    if (outcome.ok) {
      void queryClient.invalidateQueries({ queryKey: ["affiliation"] });
    }
  }

  return (
    <section>
      <h2 className="micro-label micro-label-section">Activation key</h2>
      <form
        onSubmit={submit}
        className="mt-3 space-y-4 rounded-[var(--radius)] border border-border bg-card px-4 py-4 shadow-card"
      >
        <p className="text-sm text-muted-foreground">
          A school or employer may have given you a key. Entering it links this workspace to that
          organisation.
        </p>
        <div className="grid gap-2">
          <Label htmlFor="activation-key-entry" className="micro-label">
            Key
          </Label>
          <Input
            id="activation-key-entry"
            value={display}
            onChange={(e) => setRaw(e.target.value)}
            placeholder="ABCD1234"
            className="w-full min-w-0 font-mono"
          />
          <Button type="submit" disabled={busy || !display} className="sm:w-auto">
            {busy ? "Checking" : "Link workspace"}
          </Button>
        </div>
        {result ? (
          result.ok ? (
            <p className="text-sm text-muted-foreground">
              {result.message}
              {result.institution_name ? ` Linked to ${result.institution_name}.` : ""}
            </p>
          ) : (
            <p className="text-sm text-destructive">{result.message}</p>
          )
        ) : null}
      </form>
    </section>
  );
}
