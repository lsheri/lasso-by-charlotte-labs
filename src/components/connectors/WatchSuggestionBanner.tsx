import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { Suggested, SuggestDot } from "@/components/common/Suggested";
import { ConnectorPicker, type PickerKind } from "@/components/connectors/ConnectorPicker";
import { useProfile } from "@/hooks/use-profile";
import type { WatchSuggestion } from "@/lib/connector-watch-shared";
import { checkWatchedFolders, reviewWatchSuggestion } from "@/lib/connector-watch.functions";
import type { BrowsableToolkit } from "@/lib/connector-toolkits";

const PICKER_FOR: Record<BrowsableToolkit, PickerKind> = {
  googledrive: "googledrive",
  one_drive: "onedrive",
  sharepoint_graph: "sharepoint",
};

/**
 * Watched folders only ever suggest. This banner is the whole surface: it
 * tells you what changed and opens the picker, still default-unchecked.
 */
export function WatchSuggestionBanner() {
  const { data: profile } = useProfile();
  const check = useServerFn(checkWatchedFolders);
  const review = useServerFn(reviewWatchSuggestion);
  const [hidden, setHidden] = useState<string[]>([]);
  const [open, setOpen] = useState<WatchSuggestion | null>(null);

  const { data } = useQuery({
    queryKey: ["watch-suggestions", profile?.id],
    queryFn: () => check({ data: { profile_id: profile?.id } }),
    enabled: Boolean(profile?.id),
    staleTime: 30 * 60_000,
    refetchOnWindowFocus: false,
  });

  const suggestions = (data?.suggestions ?? []).filter((s) => !hidden.includes(s.folder_id));
  if (suggestions.length === 0 && !open) return null;

  function act(suggestion: WatchSuggestion, action: "opened" | "dismissed") {
    void review({
      data: {
        profile_id: profile?.id,
        toolkit: suggestion.source,
        folder_id: suggestion.folder_id,
        folder_name: suggestion.folder_name,
        action,
      },
    });
    if (action === "dismissed") setHidden((prev) => [...prev, suggestion.folder_id]);
  }

  return (
    <div className="space-y-2">
      {suggestions.map((suggestion) => (
        <Suggested
          key={`${suggestion.source}:${suggestion.folder_id}`}
          className="flex flex-wrap items-center gap-3"
        >
          <SuggestDot />
          <p className="min-w-0 flex-1 break-words text-sm text-foreground">
            {suggestion.new_count} new {suggestion.new_count === 1 ? "file" : "files"} in “
            {suggestion.folder_name}” since you last looked. Nothing was imported.
          </p>
          <button
            type="button"
            onClick={() => {
              act(suggestion, "opened");
              setOpen(suggestion);
            }}
            className="text-xs font-medium text-accent-deep underline-offset-4 transition-opacity hover:opacity-70"
          >
            Review
          </button>
          <button
            type="button"
            onClick={() => act(suggestion, "dismissed")}
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Dismiss
          </button>
        </Suggested>
      ))}

      {open ? (
        <ConnectorPicker
          kind={PICKER_FOR[open.source]}
          open
          onOpenChange={(next) => {
            if (!next) setOpen(null);
          }}
          initialFolder={{ id: open.folder_id, name: open.folder_name }}
          highlightIds={open.new_ids}
        />
      ) : null}
    </div>
  );
}
