import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Fragment, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { tagVariants } from "@/components/ui/tag";
import { ChevronDown, ChevronRight } from "@/design/brand/icons";
import {
  AI_COSTS_COPY as C,
  COST_DEFAULT_DAYS,
  COST_MAX_CUSTOM_DAYS,
  COST_RANGE_DAYS,
  formatUsd,
  type AiCostReport,
  type CostRangeInput,
} from "@/lib/ai-costs-shared";
import { getAiCostReport } from "@/lib/ai-costs.functions";
import { cn } from "@/lib/utils";

/** A 403 from the gate, or no session at all: the page shows nothing about costs. */
export function isRefusal(error: unknown): boolean {
  if (error instanceof Response) return error.status === 403 || error.status === 401;
  const message = error instanceof Error ? error.message : "";
  return /^(Unauthorized|Forbidden)/.test(message);
}

function customRangeOk(from: string, to: string): boolean {
  if (!from || !to || from > to) return false;
  const span = (Date.parse(to) - Date.parse(from)) / 86_400_000 + 1;
  return Number.isFinite(span) && span <= COST_MAX_CUSTOM_DAYS;
}

const num = new Intl.NumberFormat("en-US");

/**
 * 18 Nov 2026, founder AI costs: /founder/costs. Charlotte Labs staff only, enforced by the server function; this page
 * only renders what it is handed and says nothing about costs when refused. Not linked from any navigation.
 */
export function AiCostsPage() {
  const load = useServerFn(getAiCostReport);
  const [preset, setPreset] = useState<string>(String(COST_DEFAULT_DAYS));
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [applied, setApplied] = useState<CostRangeInput>({ days: COST_DEFAULT_DAYS });
  const [open, setOpen] = useState<Set<string>>(new Set());

  const report = useQuery<AiCostReport>({
    queryKey: ["founder-ai-costs", applied],
    queryFn: () => load({ data: applied }),
    retry: false,
    staleTime: 60_000,
  });

  if (report.error && isRefusal(report.error)) {
    return (
      <div className="mx-auto max-w-xl p-8">
        <p role="alert" className="text-(length:--type-body) text-muted-foreground">
          {C.refused}
        </p>
      </div>
    );
  }

  function choosePreset(value: string) {
    setPreset(value);
    if (value !== "custom") setApplied({ days: Number(value) });
  }

  function applyCustom(event: FormEvent) {
    event.preventDefault();
    if (customRangeOk(from, to)) setApplied({ from, to });
  }

  const customInvalid = preset === "custom" && !!from && !!to && !customRangeOk(from, to);
  const data = report.data;
  const maxDay = data ? Math.max(0, ...data.daily.map((d) => d.costUsd)) : 0;

  function toggle(key: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-4 sm:p-8">
      <header className="space-y-2">
        <h1 className="page-title">{C.title}</h1>
        <p className="text-(length:--type-small) text-muted-foreground">{C.intro}</p>
      </header>

      <form className="flex flex-wrap items-end gap-3" onSubmit={applyCustom}>
        <label className="flex flex-col gap-1 text-(length:--type-small) text-muted-foreground">
          {C.range}
          <NativeSelect
            aria-label={C.range}
            className="w-48"
            value={preset}
            onChange={(e) => choosePreset(e.target.value)}
          >
            {COST_RANGE_DAYS.map((days) => (
              <option key={days} value={String(days)}>
                {C.rangeOption(days)}
              </option>
            ))}
            <option value="custom">{C.custom}</option>
          </NativeSelect>
        </label>
        {preset === "custom" ? (
          <>
            <label className="flex flex-col gap-1 text-(length:--type-small) text-muted-foreground">
              {C.from}
              <Input type="date" className="w-44" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-(length:--type-small) text-muted-foreground">
              {C.to}
              <Input type="date" className="w-44" value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
            <Button type="submit" disabled={!customRangeOk(from, to)}>
              {C.apply}
            </Button>
          </>
        ) : null}
      </form>
      {customInvalid ? (
        <p role="alert" className="text-(length:--type-small) text-destructive">
          {C.badRange}
        </p>
      ) : null}

      {report.isPending ? (
        <p role="status" className="text-(length:--type-small) text-muted-foreground">
          {C.loading}
        </p>
      ) : report.error ? (
        <div role="alert" className="space-y-3">
          <p className="text-(length:--type-small) text-destructive">
            {report.error instanceof Error && report.error.message === C.badRange ? C.badRange : C.failed}
          </p>
          <Button type="button" variant="outline" onClick={() => void report.refetch()}>
            {C.retry}
          </Button>
        </div>
      ) : data && data.totals.calls === 0 ? (
        <p className="text-(length:--type-small) text-muted-foreground">{C.empty}</p>
      ) : data ? (
        <>
          <section aria-label={data.range.label} className="flex flex-wrap gap-4">
            <div className="min-w-40 rounded-[var(--radius-control)] border border-border p-4">
              <div className="text-(length:--type-small) text-muted-foreground">{C.totalCalls}</div>
              <div className="text-(length:--type-title) text-foreground" data-testid="total-calls">
                {num.format(data.totals.calls)}
              </div>
            </div>
            <div className="min-w-40 rounded-[var(--radius-control)] border border-border p-4">
              <div className="text-(length:--type-small) text-muted-foreground">{C.totalCost}</div>
              <div className="text-(length:--type-title) text-foreground" data-testid="total-cost">
                {formatUsd(data.totals.costUsd)}
              </div>
            </div>
            <span className={cn(tagVariants({ tone: "muted" }), "self-start")}>{data.range.label}</span>
          </section>

          <section className="space-y-2">
            <h2 className="text-(length:--type-lead) text-foreground">{C.firms}</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{C.firm}</TableHead>
                  <TableHead className="text-right">{C.people}</TableHead>
                  <TableHead className="text-right">{C.calls}</TableHead>
                  <TableHead className="text-right">{C.cost}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.firms.map((firm) => {
                  const key = firm.orgId ?? "none";
                  const isOpen = open.has(key);
                  const Chevron = isOpen ? ChevronDown : ChevronRight;
                  return (
                    <Fragment key={key}>
                      <TableRow>
                        <TableCell>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 text-left text-foreground hover:underline"
                            aria-expanded={isOpen}
                            aria-label={isOpen ? C.hidePeople(firm.name) : C.showPeople(firm.name)}
                            onClick={() => toggle(key)}
                          >
                            <Chevron className="size-4 text-muted-foreground" aria-hidden />
                            {firm.name}
                          </button>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{num.format(firm.people)}</TableCell>
                        <TableCell className="text-right tabular-nums">{num.format(firm.calls)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatUsd(firm.costUsd)}</TableCell>
                      </TableRow>
                      {isOpen
                        ? firm.persons.map((person) => (
                            <TableRow key={`${key}:${person.profileId ?? "system"}`} className="bg-muted">
                              <TableCell className="pl-10 text-muted-foreground">{person.name}</TableCell>
                              <TableCell />
                              <TableCell className="text-right tabular-nums">{num.format(person.calls)}</TableCell>
                              <TableCell className="text-right tabular-nums">{formatUsd(person.costUsd)}</TableCell>
                            </TableRow>
                          ))
                        : null}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </section>

          <section className="space-y-2">
            <h2 className="text-(length:--type-lead) text-foreground">{C.surfaces}</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{C.surface}</TableHead>
                  <TableHead className="text-right">{C.calls}</TableHead>
                  <TableHead className="text-right">{C.cost}</TableHead>
                  <TableHead className="text-right">{C.avg}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.surfaces.map((s) => (
                  <TableRow key={s.surface}>
                    <TableCell className="font-mono text-(length:--type-small)">{s.surface}</TableCell>
                    <TableCell className="text-right tabular-nums">{num.format(s.calls)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatUsd(s.costUsd)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatUsd(s.avgCostUsd)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>

          <section className="space-y-2">
            <h2 className="text-(length:--type-lead) text-foreground">{C.daily}</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{C.day}</TableHead>
                  <TableHead className="text-right">{C.calls}</TableHead>
                  <TableHead className="text-right">{C.cost}</TableHead>
                  <TableHead className="w-1/3">
                    <span className="sr-only">{C.cost}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.daily.map((d) => (
                  <TableRow key={d.day}>
                    <TableCell className="tabular-nums">{d.day}</TableCell>
                    <TableCell className="text-right tabular-nums">{num.format(d.calls)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatUsd(d.costUsd)}</TableCell>
                    <TableCell>
                      <div className="h-2 w-full rounded-[var(--radius-control)] bg-muted" aria-hidden>
                        <div
                          className="h-2 rounded-[var(--radius-control)] bg-primary"
                          style={{ width: `${maxDay > 0 ? Math.round((d.costUsd / maxDay) * 100) : 0}%` }}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        </>
      ) : null}
    </div>
  );
}
