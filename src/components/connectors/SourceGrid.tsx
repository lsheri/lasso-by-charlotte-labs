import { BrandLogo, type BrandKey } from "@/components/connectors/BrandLogo";

export type SourceId = "googledrive" | "gmail" | "granola" | "onedrive" | "sharepoint" | "wispr" | "claude" | "chatgpt";
export type SourceRow = { id: SourceId; name: string; brand: BrandKey; connected: boolean; ai?: boolean };

function Tile({ row, onPick }: { row: SourceRow; onPick: (id: SourceId) => void }) {
  const off = !row.connected;
  return (
    <button
      type="button"
      className="flex min-h-[52px] min-w-0 items-center gap-2.5 rounded-md border border-border bg-background px-2.5 py-2 text-left hover:border-foreground/50"
      data-source={row.id}
      data-off={row.connected ? undefined : "true"}
      onClick={() => onPick(row.id)}
    >
      <span className={off ? "opacity-[0.55]" : undefined}>
        <BrandLogo brand={row.brand} size={24} />
      </span>
      <span className="min-w-0">
        <span className={`block truncate text-sm font-medium${off ? " text-muted-foreground" : ""}`}>{row.name}</span>
        <span className="block font-mono text-[9.5px] uppercase tracking-[0.06em] text-muted-foreground">
          {row.ai ? (row.connected ? "Sends work here" : "Set up in Settings") : row.connected ? "Connected" : "Connect"}
        </span>
      </span>
    </button>
  );
}

const GRID = "grid grid-cols-1 gap-2 sm:grid-cols-2";

export function SourceGrid({ rows, onPick }: { rows: SourceRow[]; onPick: (id: SourceId) => void }) {
  const apps = rows.filter((row) => !row.ai);
  const ordered = [...apps.filter((row) => row.connected), ...apps.filter((row) => !row.connected)];
  const ai = rows.filter((row) => row.ai);
  return (
    <div>
      <div className={GRID}>
        {ordered.map((row) => <Tile key={row.id} row={row} onPick={onPick} />)}
      </div>
      {ai.length > 0 ? (
        <>
          <hr className="my-3 border-border" />
          <p className="micro-label">AI tools</p>
          <div className={`${GRID} mt-2`}>
            {ai.map((row) => <Tile key={row.id} row={row} onPick={onPick} />)}
          </div>
        </>
      ) : null}
    </div>
  );
}
