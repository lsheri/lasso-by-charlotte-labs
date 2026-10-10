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
import {
  COUNTRIES,
  INDUSTRIES,
  SIZE_BANDS,
  USE_FOR_OPTIONS,
  segmentFieldsFor,
} from "@/lib/org-segments";
import { orgTypeDisplayLabel } from "@/lib/org-type";

type OrgRow = {
  name: string;
  industry: string | null;
  size_band: string | null;
  country: string | null;
  use_for: string | null;
};

export const NAME_REQUIRED_LINE = "A workspace needs a name.";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="micro-label">{label}</p>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function PickField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | null;
  options: readonly { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <Field label={label}>
      <Select value={value ?? ""} onValueChange={onChange}>
        <SelectTrigger aria-label={label}>
          <SelectValue placeholder="Not set" />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

const asOptions = (list: readonly string[]) => list.map((v) => ({ value: v, label: v }));

/** Admin only. Every field is optional and none of it is shown as a score. */
export function OrgDimensionsCard() {
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<OrgRow | null>(null);
  const [pending, setPending] = useState(false);
  const [nameError, setNameError] = useState(false);
  const canEdit = profile?.role === "admin";
  const fields = segmentFieldsFor(profile?.org_type);
  const isOrg = fields.includes("industry");

  const { data } = useQuery({
    queryKey: ["org-dimensions", profile?.org_id],
    enabled: Boolean(profile?.org_id),
    queryFn: async (): Promise<OrgRow> => {
      const { data: row, error } = await supabase
        .from("orgs")
        .select("name, industry, size_band, country, use_for")
        .eq("id", profile?.org_id as string)
        .maybeSingle();
      if (error) throw error;
      return (row as OrgRow | null) ?? {
        name: "",
        industry: null,
        size_band: null,
        country: null,
        use_for: null,
      };
    },
  });

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  if (!canEdit || !form) return null;

  async function save() {
    if (!profile || !form) return;
    const name = form.name.trim();
    if (!name) {
      setNameError(true);
      return;
    }
    setNameError(false);
    setPending(true);
    const segment = isOrg
      ? { industry: form.industry, size_band: form.size_band, country: form.country }
      : { use_for: form.use_for, country: form.country };
    const { error } = await supabase.from("orgs").update({ name, ...segment }).eq("id", profile.org_id);
    setPending(false);
    if (error) return void toast.error(error.message);
    await queryClient.invalidateQueries({ queryKey: ["org-dimensions", profile.org_id] });
    await queryClient.invalidateQueries({ queryKey: ["profiles"] });
    logV2("organization.segment_updated", {
      fields_set: Object.values(segment).filter((v) => Boolean(v)).length,
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
        <div className="grid gap-4 sm:grid-cols-2" data-testid="workspace-identity">
          <Field label="Workspace name">
            <Input
              aria-label="Workspace name"
              value={form.name}
              onChange={(e) => {
                set("name", e.target.value);
                if (e.target.value.trim()) setNameError(false);
              }}
            />
            {nameError ? <p className="mt-1.5 text-sm text-destructive">{NAME_REQUIRED_LINE}</p> : null}
          </Field>
          <Field label="Kind of organisation">
            <p className="text-sm text-foreground">{orgTypeDisplayLabel(profile?.org_type)}</p>
            <p className="text-sm text-muted-foreground">Set when this workspace was created.</p>
          </Field>
        </div>
        <div className="space-y-3 border-t border-border pt-4" data-testid="workspace-about">
          <h3 className="micro-label">About this workspace, for our understanding only</h3>
          <p className="text-sm text-muted-foreground">
            All optional. We use this to understand who Lasso is for, and nothing on this card changes how Lasso behaves.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {isOrg ? (
              <>
                <PickField label="Industry" value={form.industry} options={asOptions(INDUSTRIES)} onChange={(v) => set("industry", v)} />
                <PickField label="People" value={form.size_band} options={asOptions(SIZE_BANDS)} onChange={(v) => set("size_band", v)} />
              </>
            ) : (
              <PickField label="What is this for" value={form.use_for} options={USE_FOR_OPTIONS} onChange={(v) => set("use_for", v)} />
            )}
            <PickField label="Country" value={form.country} options={COUNTRIES} onChange={(v) => set("country", v)} />
          </div>
        </div>
        <Button type="button" onClick={() => void save()} disabled={pending}>
          Save
        </Button>
      </div>
    </section>
  );
}
