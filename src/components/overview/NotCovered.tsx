import { ToneCard } from "@/components/notebook/ToneCard";
import { useConnectorAccounts, TOOLKIT_LABELS } from "@/hooks/use-connector-accounts";
import { CONNECTOR_TOOLKITS } from "@/lib/connector-toolkits";

/**
 * Figma 21:2, the amber "NOT COVERED" callout. The honest counterpart to
 * "What Lasso is reading": the tools that are NOT connected, so a person is
 * never left assuming their whole working life is in the record.
 *
 * This component owns its own read, so the page's hook list is untouched.
 *
 * Deliberate deviation from the frame: Figma names "Gemini and Teams". Neither
 * is a ConnectorToolkit, so naming them would describe a product that does not
 * exist. The real unconnected toolkits are named instead.
 */

/** "Slack, Notion and Gmail" — an Oxford-free list a sentence can swallow. */
function nameList(names: string[]): string {
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

export function NotCovered() {
  const { data: accounts } = useConnectorAccounts();

  // Undefined while the read is in flight. Saying "nothing is connected"
  // before we know would be a false claim, so the callout stays silent.
  if (!accounts) return null;

  const missing = CONNECTOR_TOOLKITS.filter((toolkit) => {
    const account = accounts[toolkit];
    return !account || account.status === "not_connected" || account.status === "disconnected";
  }).map((toolkit) => TOOLKIT_LABELS[toolkit]);

  if (missing.length === 0) return null;

  const verb = missing.length === 1 ? "is" : "are";

  return (
    <div className="mt-6" data-testid="overview-not-covered">
      <ToneCard tone="attention" label="NOT COVERED" className="w-[560px] max-w-full">
        <p className="leading-[17px]">
          {nameList(missing)} {verb} not connected. Work you do there will never appear in your
          record.
        </p>
      </ToneCard>
    </div>
  );
}
