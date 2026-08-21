import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { Switch } from "@/components/ui/switch";
import { useProfile } from "@/hooks/use-profile";
import { PURPOSE_COPY } from "@/lib/consent-shared";
import { getDataUse, noteConsentPresented, setDataUse } from "@/lib/consent.functions";
import type { ConsentPurpose } from "@/lib/telemetry-v2-shared";

/**
 * Four purposes, one sentence each, with what declining actually changes.
 * Only an admin can answer for the organisation. Individual research
 * participation is not offered here and will not be until a protocol exists.
 */
export function DataUseCard() {
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const load = useServerFn(getDataUse);
  const save = useServerFn(setDataUse);
  const present = useServerFn(noteConsentPresented);
  const announced = useRef(false);

  const { data: state } = useQuery({
    queryKey: ["data-use", profile?.id],
    enabled: Boolean(profile?.id),
    queryFn: () => load({ data: { profile_id: profile?.id } }),
  });

  useEffect(() => {
    if (!state?.is_admin || announced.current) return;
    announced.current = true;
    void present({ data: { profile_id: profile?.id } }).catch(() => {
      /* a presentation note never interrupts the person reading it */
    });
  }, [state?.is_admin, present, profile?.id]);

  const [saveError, setSaveError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (input: { purpose: ConsentPurpose; granted: boolean }) =>
      save({ data: { ...input, profile_id: profile?.id } }),
    onMutate: () => setSaveError(null),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["data-use", profile?.id] });
      toast.success("Saved");
    },
    onError: (e: unknown) => {
      setSaveError((e as Error)?.message || "That could not be saved. Try again.");
      toast.error("That could not be saved. Try again.");
    },
  });

  if (!state) return null;

  return (
    <section>
      <h2 className="section-title">Data use</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {state.is_admin
          ? "What your workspace data may be used for. You can change any of these at any time."
          : "What your workspace data may be used for. Only an admin can change these."}
      </p>
      {saveError ? <p className="mt-2 text-sm text-destructive">{saveError}</p> : null}

      <div className="mt-4 space-y-3">
        {PURPOSE_COPY.map((purpose) => {
          const on = purpose.alwaysOn || state.grants[purpose.purpose] === true;
          return (
            <div
              key={purpose.purpose}
              className="flex items-start justify-between gap-4 rounded-[var(--radius)] border border-border bg-card px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{purpose.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{purpose.unlocks}</p>
                <p className="mt-1 text-xs text-muted-foreground">{purpose.declining}</p>
              </div>
              <Switch
                checked={on}
                disabled={purpose.alwaysOn || !state.is_admin || mutation.isPending}
                onCheckedChange={(next) =>
                  mutation.mutate({ purpose: purpose.purpose, granted: next })
                }
                aria-label={purpose.title}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
