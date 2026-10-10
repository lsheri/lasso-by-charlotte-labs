import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { logV2 } from "@/lib/telemetry-v2";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { INDUSTRIES, SIZE_BANDS } from "@/lib/org-segments";
import { orgTypeDisplayLabel } from "@/lib/org-type";

type OrgRow = {
  industry: string | null;
  size_band: string | null;
  country: string | null;
  data_use_tier: string | null;
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="micro-label">{label}</p>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

/** Admin only. Every field is optional and none of it is shown as a score. */
export function OrgDimensionsCard() {
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<OrgRow | null>(null);
  const [pending, setPending] = useState(false);
  const canEdit = profile?.role === "admin";

  const { data } = useQuery({
    queryKey: ["org-dimensions", profile?.org_id],
    enabled: Boolean(profile?.org_id),
    queryFn: async (): Promise<OrgRow> => {
      const { data: row, error } = await supabase
        .from("orgs")
        .select("industry, size_band, country, data_use_tier")
        .eq("id", profile?.org_id as string)
        .maybeSingle();
      if (error) throw error;
      return (row as OrgRow | null) ?? {
        industry: null,
        size_band: null,
        country: null,
        data_use_tier: null,
      };
    },
  });

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  if (!canEdit || !form) return null;

  async function save() {
    if (!profile || !form) return;
    setPending(true);
    const { error } = await supabase
      .from("orgs")
      .update({
        industry: form.industry,
        size_band: form.size_band,
        country: form.country,
      })
      .eq("id", profile.org_id);
    setPending(false);
    if (error) return void toast.error(error.message);
    await queryClient.invalidateQueries({ queryKey: ["org-dimensions", profile.org_id] });
    logV2("organization.segment_updated", {
      fields_set: [form.industry, form.size_band, form.country].filter(
        (v) => Boolean(v),
      ).length,
    }, { profileId: profile.id });
    toast.success("Workspace details saved");
  }

  function set(key: keyof OrgRow, value: string) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  return (
    <section>
      <h2 className="micro-label micro-label-section">About this workspace</h2>
      <div className="mt-3 space-y-4 rounded-[var(--radius)] border border-border bg-card px-4 py-4 shadow-card">
        <p className="text-sm text-muted-foreground">
          All optional. We use this to understand who Lasso is for, and nothing on this card changes how Lasso behaves.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Kind of organisation">
            <p className="text-sm text-foreground">{orgTypeDisplayLabel(profile?.org_type)}</p>
            <p className="text-sm text-muted-foreground">Set when this workspace was created.</p>
          </Field>
          <Field label="Industry">
            <Select value={form.industry ?? ""} onValueChange={(v) => set("industry", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Not set" />
              </SelectTrigger>
              <SelectContent>
                {INDUSTRIES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="People">
            <Select value={form.size_band ?? ""} onValueChange={(v) => set("size_band", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Not set" />
              </SelectTrigger>
              <SelectContent>
                {SIZE_BANDS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Country">
            <Input
              value={form.country ?? ""}
              onChange={(e) => set("country", e.target.value)}
              placeholder="Not set"
            />
          </Field>
          <Field label="Data use">
            <p className="text-sm text-foreground">{form.data_use_tier ?? "Operate only"}</p>
          </Field>
        </div>
        <Button type="button" onClick={() => void save()} disabled={pending}>
          Save
        </Button>
      </div>
    </section>
  );
}
