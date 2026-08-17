import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useEngagements } from "@/hooks/use-engagements";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { dateLabel } from "@/lib/decisions-shared";
import { engagementLabel } from "@/lib/clients";

export function AddDecisionDialog({ trigger }: { trigger: React.ReactNode }) {
  const { data: profile } = useProfile();
  const { data: engagements } = useEngagements(profile?.id);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [situation, setSituation] = useState("");
  const [callText, setCallText] = useState("");
  const [why, setWhy] = useState("");
  const [engagementId, setEngagementId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!profile) return;
    setSaving(true);
    setError(null);
    const { error: insertError } = await supabase.from("decisions").insert({
      owner_id: profile.id,
      engagement_id: engagementId || null,
      situation: situation.trim(),
      call_text: callText.trim(),
      why: why.trim(),
      status: "confirmed",
      author: "human",
      date_label: dateLabel(new Date()),
      resolved_at: new Date().toISOString(),
    });
    setSaving(false);
    if (insertError) return setError(insertError.message);
    await queryClient.invalidateQueries({ queryKey: ["decisions"] });
    setSituation("");
    setCallText("");
    setWhy("");
    setEngagementId("");
    setOpen(false);
  }

  const valid = situation.trim() && callText.trim() && why.trim();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="page-title">Add a decision</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <div className="micro-label mb-1.5">The situation</div>
            <Textarea rows={2} value={situation} onChange={(e) => setSituation(e.target.value)} />
          </div>
          <div>
            <div className="micro-label mb-1.5">The call</div>
            <Textarea rows={2} value={callText} onChange={(e) => setCallText(e.target.value)} />
          </div>
          <div>
            <div className="micro-label mb-1.5">Why it was the right call</div>
            <Textarea rows={3} value={why} onChange={(e) => setWhy(e.target.value)} />
          </div>
          <div>
            <div className="micro-label mb-1.5">Engagement (optional)</div>
            <select
              value={engagementId}
              onChange={(e) => setEngagementId(e.target.value)}
              className="w-full rounded-[var(--radius)] border border-border bg-card px-3 py-2 text-sm"
            >
              <option value="">No engagement</option>
              {(engagements ?? []).map((e) => (
                <option key={e.id} value={e.id}>
                  {engagementLabel(e)}
                </option>
              ))}
            </select>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex justify-end">
            <Button type="button" disabled={!valid || saving} onClick={() => void save()}>
              {saving ? "Saving…" : "Save decision"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
