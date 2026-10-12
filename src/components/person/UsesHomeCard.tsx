import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { UsesChips } from "@/components/person/UsesChips";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { saveUses, usesDim, USES_COPY, type PersonUse } from "@/lib/person-uses";
import { logEvent } from "@/lib/telemetry";

export const MY_USES_KEY = ["my-uses"] as const;

/**
 * F4 / ST-4: one-time card for anyone whose own people row has no uses.
 * Dismissible only by answering. Reads only the signed-in person's row.
 */
export function UsesHomeCard({ orgId }: { orgId: string | null | undefined }) {
  const queryClient = useQueryClient();
  const q = useQuery({
    queryKey: MY_USES_KEY,
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return { uid: null, uses: null as string[] | null };
      const { data, error } = await supabase
        .from("people")
        .select("uses")
        .eq("user_id", uid)
        .maybeSingle();
      if (error) throw error;
      return { uid, uses: (data?.uses as string[] | null | undefined) ?? null };
    },
    staleTime: 5 * 60_000,
  });
  const [picks, setPicks] = useState<PersonUse[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  if (!q.data?.uid || (q.data.uses && q.data.uses.length > 0)) return null;
  const uid = q.data.uid;

  async function save() {
    setPending(true);
    setError(false);
    const res = await saveUses(supabase, uid, picks).catch(() => ({ ok: false, uses: [] }));
    setPending(false);
    if (!res.ok) {
      setError(true);
      return;
    }
    if (orgId) logEvent("person.uses_declared", orgId, { uses: usesDim(res.uses) });
    queryClient.setQueryData(MY_USES_KEY, { uid, uses: res.uses });
  }

  return (
    <div
      data-testid="uses-home-card"
      className="mx-4 mt-4 rounded-[var(--radius)] border border-border bg-card p-4 shadow-card md:mx-6"
    >
      <UsesChips value={picks} onChange={setPicks} disabled={pending} />
      {error ? <p className="mt-2 text-sm text-destructive">{USES_COPY.error}</p> : null}
      <Button
        type="button"
        className="mt-3"
        disabled={pending || picks.length === 0}
        onClick={() => void save()}
      >
        {pending ? USES_COPY.saving : USES_COPY.save}
      </Button>
    </div>
  );
}
