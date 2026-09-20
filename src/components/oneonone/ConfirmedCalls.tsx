import { useDecisions } from "@/hooks/use-decisions";

/**
 * PASS B · the calls a person already confirmed, sitting under the 1:1 prep as
 * sticky notes. Read only: a call travels with the work, it is not settled
 * again here.
 */
const TILT = ["-rotate-1", "rotate-1", "-rotate-2", "rotate-2"];

export function ConfirmedCalls() {
  const { data: decisions } = useDecisions();
  const confirmed = (decisions ?? []).filter((row) => row.status === "confirmed");
  if (confirmed.length === 0) return null;

  return (
    <section className="mt-10">
      <p className="font-hand text-[16px] text-soft">you confirm once, it travels with the work</p>
      <h2 className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-soft">
        Decisions you confirmed
      </h2>
      <div className="mt-4 flex flex-wrap gap-4">
        {confirmed.slice(0, 12).map((row, index) => (
          <div
            key={row.id}
            className={`w-[220px] max-w-full rounded-[var(--radius-sm)] border border-[var(--nb-pencil)] bg-[var(--nb-yellow-wash)] px-3 py-3 ${TILT[index % TILT.length]}`}
          >
            <p className="font-hand text-[16px] leading-[20px] text-foreground">
              {row.call_text ?? row.situation ?? "Untitled decision"}
            </p>
            {row.date_label ? (
              <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.08em] text-soft">
                {row.date_label}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
