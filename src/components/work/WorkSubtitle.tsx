import { useConnectorAccounts } from "@/hooks/use-connector-accounts";
import { CONNECTOR_TOOLKITS } from "@/lib/connector-toolkits";

/**
 * Figma 22:220 subtitle: "38 pieces of work · 6 unmapped · 4 tools connected".
 *
 * The third clause is the one the page could not say before, because the page
 * never reads connector accounts. This component owns that read itself, so the
 * page's hook list and hook order are untouched, and the clause simply does not
 * appear until the read lands rather than showing a guess of zero.
 */
export function WorkSubtitle({ pieces, unmapped }: { pieces: number; unmapped: number }) {
  const { data: accounts } = useConnectorAccounts();

  const connected =
    accounts === undefined
      ? null
      : CONNECTOR_TOOLKITS.filter((toolkit) => accounts[toolkit]?.status === "connected").length;

  const parts = [
    `${pieces} piece${pieces === 1 ? "" : "s"} of work`,
    `${unmapped} unmapped`,
    connected === null ? "" : `${connected} tool${connected === 1 ? "" : "s"} connected`,
  ].filter(Boolean);

  return <>{parts.join(" · ")}</>;
}