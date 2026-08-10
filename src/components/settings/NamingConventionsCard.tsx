import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";

export function NamingConventionsCard() {
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);

  const canEdit = profile?.role === "admin" || profile?.role === "lead";

  const { data: settings } = useQuery({
    queryKey: ["org-settings", profile?.org_id],
    enabled: Boolean(profile?.org_id) && canEdit,
    queryFn: async (): Promise<Record<string, unknown>> => {
      const { data, error } = await supabase
        .from("orgs")
        .select("settings")
        .eq("id", profile?.org_id as string)
        .maybeSingle();
      if (error) throw error;
      return (data?.settings as Record<string, unknown> | null) ?? {};
    },
  });

  useEffect(() => {
    if (settings) setValue(String(settings["naming_conventions"] ?? ""));
  }, [settings]);

  if (!canEdit) return null;

  async function save() {
    if (!profile) return;
    setPending(true);
    const merged = { ...(settings ?? {}), naming_conventions: value };
    const { error } = await supabase
      .from("orgs")
      .update({ settings: merged })
      .eq("id", profile.org_id);
    setPending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["org-settings", profile.org_id] });
    toast.success("Naming conventions saved");
  }

  return (
    <section>
      <h2 className="micro-label">Naming conventions</h2>
      <div className="mt-3 space-y-3 rounded-[var(--radius)] border border-border bg-card px-4 py-4 shadow-card">
        <Textarea
          rows={5}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Teach Lasso your labels. e.g. EMP-COAL = Employer Coalition engagement; files starting WM_ belong to Weight Management; decks named *_client are final versions."
        />
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Used only to improve mapping suggestions. Plain text, any format.
          </p>
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => void save()}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </section>
  );
}
