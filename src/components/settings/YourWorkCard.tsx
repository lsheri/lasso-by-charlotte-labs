import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
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

const SENIORITY = ["student", "early_career", "mid", "senior", "lead", "exec"];
const EXPERIENCE = ["<1", "1-2", "3+"];
const WORK_TYPES = [
  "ai_thread",
  "document",
  "deck",
  "sheet",
  "call",
  "email",
  "message",
  "image",
] as const;

const WORK_TYPE_LABELS: Record<string, string> = {
  ai_thread: "AI conversations",
  document: "Documents",
  deck: "Decks",
  sheet: "Spreadsheets",
  call: "Calls",
  email: "Email",
  message: "Messages",
  image: "Images",
};

type Row = {
  role_family: string | null;
  seniority_band: string | null;
  experience_band: string | null;
  function_area: string | null;
  primary_work_types: string[] | null;
};

/** One screen, all optional. Never shown to anyone as a score. */
export function YourWorkCard() {
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Row | null>(null);
  const [pending, setPending] = useState(false);

  const { data } = useQuery({
    queryKey: ["profile-dimensions", profile?.id],
    enabled: Boolean(profile?.id),
    queryFn: async (): Promise<Row> => {
      const { data: row, error } = await supabase
        .from("profiles")
        .select("role_family, seniority_band, experience_band, function_area, primary_work_types")
        .eq("id", profile?.id as string)
        .maybeSingle();
      if (error) throw error;
      return (row as Row | null) ?? {
        role_family: null,
        seniority_band: null,
        experience_band: null,
        function_area: null,
        primary_work_types: null,
      };
    },
  });

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  if (!form) return null;

  function set(key: keyof Row, value: string | string[]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function toggleType(type: string) {
    setForm((prev) => {
      if (!prev) return prev;
      const current = prev.primary_work_types ?? [];
      return {
        ...prev,
        primary_work_types: current.includes(type)
          ? current.filter((t) => t !== type)
          : [...current, type],
      };
    });
  }

  async function save() {
    if (!profile || !form) return;
    setPending(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        role_family: form.role_family,
        seniority_band: form.seniority_band,
        experience_band: form.experience_band,
        function_area: form.function_area,
        primary_work_types: (form.primary_work_types ?? []) as never,
      })
      .eq("id", profile.id);
    setPending(false);
    if (error) return void toast.error(error.message);
    await queryClient.invalidateQueries({ queryKey: ["profile-dimensions", profile.id] });
    toast.success("Saved");
  }

  return (
    <section>
      <h2 className="micro-label">Your work</h2>
      <div className="mt-3 space-y-4 rounded-[var(--radius)] border border-border bg-card px-4 py-4 shadow-card">
        <p className="text-sm text-muted-foreground">
          This helps Lasso make decisions and 1:1 prep more relevant. It is never shown to anyone as
          a score.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="micro-label">What you do</p>
            <Input
              className="mt-1.5"
              value={form.role_family ?? ""}
              onChange={(e) => set("role_family", e.target.value)}
              placeholder="Consultant, designer, analyst"
            />
          </div>
          <div>
            <p className="micro-label">Where you are</p>
            <Select
              value={form.seniority_band ?? ""}
              onValueChange={(v) => set("seniority_band", v)}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Not set" />
              </SelectTrigger>
              <SelectContent>
                {SENIORITY.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value.replace("_", " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="micro-label">Years working with AI</p>
            <Select
              value={form.experience_band ?? ""}
              onValueChange={(v) => set("experience_band", v)}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Not set" />
              </SelectTrigger>
              <SelectContent>
                {EXPERIENCE.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="micro-label">Function</p>
            <Input
              className="mt-1.5"
              value={form.function_area ?? ""}
              onChange={(e) => set("function_area", e.target.value)}
              placeholder="Strategy, delivery, marketing"
            />
          </div>
        </div>
        <div>
          <p className="micro-label">Mostly you work with</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {WORK_TYPES.map((type) => {
              const on = (form?.primary_work_types ?? []).includes(type);
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggleType(type)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-opacity hover:opacity-85 ${
                    on
                      ? "bg-ember text-ember-foreground"
                      : "border border-border bg-card text-foreground"
                  }`}
                >
                  {WORK_TYPE_LABELS[type]}
                </button>
              );
            })}
          </div>
        </div>
        <Button type="button" onClick={() => void save()} disabled={pending}>
          Save
        </Button>
      </div>
    </section>
  );
}
