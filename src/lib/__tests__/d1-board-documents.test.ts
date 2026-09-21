import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { buildEngagementBlocks, loadScopeData } from "@/lib/reflect-context.server";
import { scopeItemCount } from "@/lib/record-catalogue.server";

/**
 * D1: a board document belongs to the people, never to the record.
 *
 * Every check here asserts an absence against the real path. The stub is
 * poisoned on purpose: the document row carries a phrase that exists nowhere
 * else, so if any real query ever reached the documents table the phrase would
 * turn up in the assembled context or the returned items.
 */

const PHRASE = "zarquon-lattice-quaymark";

type Row = Record<string, unknown>;

function world(): Record<string, Row[]> {
  return {
    tasks: [
      {
        id: "t1",
        name: "Discovery",
        goal: null,
        detail: null,
        when_label: null,
        status: "open",
        position: 1,
        engagement_id: "e1",
        owner_id: "p1",
        engagements: {
          id: "e1",
          code: "ENG-1",
          title: "Pricing review",
          client_label: null,
          brief: null,
          term_label: null,
          outcome: null,
          clients: null,
        },
      },
    ],
    work_item_tasks: [{ work_item_id: "w1", task_id: "t1", step_no: 1, step_confirmed: true }],
    work_items: [
      {
        id: "w1",
        owner_id: "p1",
        title: "A conversation",
        type: "ai_thread",
        source: null,
        visibility: "mapped",
        captured_at: "2026-01-02T00:00:00Z",
        work_date: null,
        created_at_source: null,
        content_fidelity: "full",
        source_vendor: null,
        ts_precision: "capture",
      },
    ],
    // The poison. Only a query against this table can surface the phrase.
    board_documents: [
      { id: "d1", task_id: "t1", title: PHRASE, content: { text: `${PHRASE} draft note` } },
    ],
  };
}

/** A Supabase-shaped stub that records every table a real query asks for. */
function stub(tables: Record<string, Row[]>) {
  const touched: string[] = [];
  function builder(table: string) {
    touched.push(table);
    const eqs: [string, unknown][] = [];
    const ins: [string, unknown[]][] = [];
    const run = () => {
      const rows = (tables[table] ?? []).filter(
        (row) =>
          eqs.every(([col, value]) => row[col] === value) &&
          ins.every(([col, values]) => values.includes(row[col])),
      );
      return { data: rows, error: null, count: rows.length };
    };
    const api: Record<string, unknown> = {
      select: () => api,
      order: () => api,
      limit: () => api,
      eq: (col: string, value: unknown) => {
        eqs.push([col, value]);
        return api;
      },
      in: (col: string, values: unknown[]) => {
        ins.push([col, values]);
        return api;
      },
      maybeSingle: () => Promise.resolve({ data: run().data[0] ?? null, error: null }),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(resolve(run())),
    };
    return api;
  }
  const client = { from: (table: string) => builder(table) };
  return { client: client as never, touched };
}

function sourceFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path));
    else if (/\.(ts|tsx)$/.test(entry)) out.push(path);
  }
  return out;
}

const REPO = new URL("../../..", import.meta.url).pathname;
const DOCUMENT_MODULES = ["board-documents-shared", "board-documents.functions", "WorkstreamDocument"];

/** Every table name a module reads or writes, read off the real source. */
function tablesUsedIn(path: string): string[] {
  const source = readFileSync(path, "utf8");
  return [...source.matchAll(/\.from\(\s*"([a-z_]+)"/g)].map((match) => match[1] as string);
}

describe("D1 · a board document is never a source", () => {
  it("keeps the document out of Ask Lasso's assembled context", async () => {
    const tables = world();
    const { client, touched } = stub(tables);

    const { tasks, linkRows, items } = await loadScopeData(client, "p1", {
      mode: "tasks",
      ids: ["t1"],
    });
    const assembled = [
      ...buildEngagementBlocks(tasks, linkRows, items as { id: string; title: string }[]),
      JSON.stringify(items),
    ].join("\n");

    expect(assembled).not.toContain(PHRASE);
    expect(touched).not.toContain("board_documents");
    // The poison is real: it is in the stub the same queries ran against.
    expect(JSON.stringify(tables["board_documents"])).toContain(PHRASE);
  });

  it("leaves the document out of the engagement's contribution set", async () => {
    const tables = world();
    const { client, touched } = stub(tables);

    const { items } = await loadScopeData(client, "p1", { mode: "tasks", ids: ["t1"] });
    const count = await scopeItemCount(client, "p1", { mode: "tasks", ids: ["t1"] });

    const ids = items.map((item) => item.id);
    const documentIds = (tables["board_documents"] ?? []).map((row) => row["id"] as string);
    for (const id of documentIds) expect(ids).not.toContain(id);
    expect(count).toBe(ids.length);
    expect(touched).not.toContain("board_documents");
  });

  it("puts the document beyond every table Find it searches", () => {
    const findIt = tablesUsedIn(join(REPO, "src/lib/find-it.functions.ts"));
    expect(findIt.length).toBeGreaterThan(0);
    expect(findIt).not.toContain("board_documents");

    // Nothing outside the document's own modules touches the table at all, so
    // no later query can pull one into a search index by accident.
    const readers = [
      ...sourceFiles(join(REPO, "src/lib")),
      ...sourceFiles(join(REPO, "src/components")),
      ...sourceFiles(join(REPO, "src/pages")),
    ].filter((path) => !path.includes("__tests__") && tablesUsedIn(path).includes("board_documents"));

    for (const path of readers) {
      expect(DOCUMENT_MODULES.some((name) => path.includes(name))).toBe(true);
    }
  });

  it("cannot represent a lineage link that points at a document", () => {
    // Lineage rows reference work_items(id). A document id lives only in
    // board_documents, so the foreign key refuses it: proven against the live
    // database with a rolled back insert, and kept unrepresentable here by
    // never letting a document module reach a lineage table.
    for (const name of DOCUMENT_MODULES) {
      const matches = [
        ...sourceFiles(join(REPO, "src/lib")),
        ...sourceFiles(join(REPO, "src/components")),
      ].filter((path) => path.includes(name));
      for (const path of matches) {
        const used = tablesUsedIn(path);
        expect(used).not.toContain("work_item_links");
        expect(used).not.toContain("span_links");
        expect(used).not.toContain("work_items");
      }
    }
  });
});
