import { useEffect, useRef } from "react";

import { useProfile } from "@/hooks/use-profile";
import { logEvent } from "@/lib/telemetry";

/**
 * Unit B5X: every card on the onboarding connect screen records
 * connector.setup_opened once, with the same surface and had_connector dims
 * McpSetupCard sends. Pass null for hadConnector until its read has settled.
 */
export function useSetupOpened(hadConnector: boolean | null): void {
  const { data: profile } = useProfile();
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current || !profile || hadConnector === null) return;
    sent.current = true;
    logEvent("connector.setup_opened", profile.org_id, {
      surface: "onboarding",
      had_connector: hadConnector,
    });
  }, [profile, hadConnector]);
}
