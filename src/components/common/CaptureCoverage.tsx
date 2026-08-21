import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function monthLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.getFullYear() === new Date().getFullYear()
    ? MONTHS[date.getMonth()]!
    : `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * What Lasso can and cannot see, said plainly. Coverage is stated next to any
 * claim so nobody reads a partial record as a whole one. The count of private
 * work is shown to the person who owns it and to nobody else.
 */
export function CaptureCoverage({
  profileId,
  itemCount,
  scopeLabel,
  dates,
  isOwner = true,
  eligibleEpisodes,
}: {
  profileId: string | undefined;
  itemCount: number;
  scopeLabel: string;
  dates?: string[] | undefined;
  isOwner?: boolean | undefined;
  eligibleEpisodes?: number | undefined;
}) {
  const { data } = useQuery({
    queryKey: ["capture-coverage", profileId],
    enabled: Boolean(profileId),
    queryFn: async () => {
      const [connectors, privateItems] = await Promise.all([
        supabase
          .from("connector_accounts")
          .select("toolkit")
          .eq("profile_id", profileId!)
          .eq("status", "connected"),
        supabase
          .from("work_items")
          .select("id", { count: "exact", head: true })
          .eq("owner_id", profileId!)
          .eq("visibility", "private"),
      ]);
      return {
        channels: (connectors.data ?? []).map((row) => row.toolkit),
        privateCount: privateItems.count ?? 0,
      };
    },
  });

  const sorted = (dates ?? [])
    .map((d) => new Date(d))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const spanText =
    first && last
      ? monthLabel(first.toISOString()) === monthLabel(last.toISOString())
        ? monthLabel(first.toISOString())
        : `${monthLabel(first.toISOString())} to ${monthLabel(last.toISOString())}`
      : "";

  const channels = data?.channels ?? [];
  const channelText =
    channels.length > 0
      ? `Connected across your record: ${channels.join(", ")}.`
      : "No tools connected yet.";

  return (
    <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
      Based on the {itemCount} {itemCount === 1 ? "piece" : "pieces"} of work in {scopeLabel}
      {spanText ? `, ${spanText}` : ""}. {channelText}
      {isOwner && (data?.privateCount ?? 0) > 0
        ? ` Across your record, ${data!.privateCount} ${data!.privateCount === 1 ? "item is" : "items are"} kept private and read by nobody else.`
        : ""}
      {typeof eligibleEpisodes === "number"
        ? ` Read across ${eligibleEpisodes} ${eligibleEpisodes === 1 ? "piece" : "pieces"} of work.`
        : ""}{" "}
      Lasso only sees what you connect and map.
    </p>
  );
}
