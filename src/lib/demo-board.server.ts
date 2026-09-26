import { buildSharedBoardModel } from "@/components/canvas-lab/SharedBoardView";

import type { SharedBoardDto } from "./board-share-shared";
import { publicDemoPresets, type DemoPreset, type DemoPresetRow } from "./demo-presets-shared";
import type { LandingProof } from "./landing-proof-shared";
import { publicSafeTurnExcerpts, publicSafeWork } from "./public-work-allowlist";
import { readBoard } from "./board-share-open.server";

type AdminDb = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

/* ------------------------------------------------------------------------ */
/* Product shell 1.3: the public demo. Same reader, viewer null, so only     */
/* mapped work and confirmed decisions travel. The org is found ONLY through */
/* orgs.is_demo = true; no caller can name an org, board or engagement id.   */
/* ------------------------------------------------------------------------ */

export type DemoEngagementCard = {
  code: string;
  title: string;
  clientLabel: string | null;
  workCount: number;
  preview: { frames: { x: number; y: number; w: number; h: number; fill: string | null }[]; nodes: { x: number; y: number; w: number; h: number }[] };
};

export type DemoHomeResult = { engagements: DemoEngagementCard[] };
export type DemoBoardResult =
  | {
      status: "open";
      board: SharedBoardDto;
      engagement: { code: string; title: string; clientLabel: string | null };
      /** Unit 2: saved Ask Lasso answers, answered rows only. */
      presets: DemoPreset[];
      proof: LandingProof | null;
    }
  | { status: "not_found" };

const DEMO_EXPIRY_MS = 48 * 60 * 60 * 1000;

export async function demoOrgId(db: AdminDb): Promise<string | null> {
  const { data } = await db.from("orgs").select("id").eq("is_demo", true).limit(2);
  return data && data.length === 1 ? data[0]!.id : null;
}

async function demoBoard(db: AdminDb, orgId: string, engagementId: string): Promise<SharedBoardDto | null> {
  const { data: wb } = await db.from("workboards").select("id").eq("engagement_id", engagementId).maybeSingle();
  if (!wb) return null;
  const dto = await readBoard(db, wb.id, { org_id: orgId, expires_at: new Date(Date.now() + DEMO_EXPIRY_MS).toISOString() }, null);
  return dto ? demoSafeBoard(dto) : null;
}

export async function openDemoHome(): Promise<DemoHomeResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const orgId = await demoOrgId(supabaseAdmin);
  if (!orgId) return { engagements: [] };
  const { data: rows } = await supabaseAdmin
    .from("engagements")
    .select("id, code, title, client_label")
    .eq("org_id", orgId)
    .order("created_at", { ascending: true })
    .limit(12);
  const cards = await Promise.all(
    (rows ?? []).map(async (row): Promise<DemoEngagementCard> => {
      const dto = await demoBoard(supabaseAdmin, orgId, row.id).catch(() => null);
      return {
        code: row.code,
        title: row.title,
        clientLabel: row.client_label,
        workCount: dto?.seed.work.length ?? 0,
        preview: dto ? seededPreview(dto) : { frames: [], nodes: [] },
      };
    }),
  );
  return { engagements: cards };
}

export async function openDemoBoard(code: string): Promise<DemoBoardResult> {
  if (typeof code !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(code)) return { status: "not_found" };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const orgId = await demoOrgId(supabaseAdmin);
  if (!orgId) return { status: "not_found" };
  const { data: row } = await supabaseAdmin
    .from("engagements")
    .select("id, code, title, client_label")
    .eq("org_id", orgId)
    .eq("code", code)
    .maybeSingle();
  if (!row) return { status: "not_found" };
  const board = await demoBoard(supabaseAdmin, orgId, row.id).catch(() => null);
  if (!board) return { status: "not_found" };
  const presets = await loadDemoPresets(supabaseAdmin, orgId, row.id, board).catch(() => []);
  const proofItem = board.seed.work.find((item) => item.type === "ai_thread" && item.title === "Partnership scenarios: year-two net benefit");
  const proof: LandingProof | null = proofItem ? {
    itemId: proofItem.id,
    title: proofItem.title,
    vendor: proofItem.source_vendor ?? proofItem.source_meta?.vendor ?? proofItem.source,
    turns: publicSafeTurnExcerpts(board.turns[proofItem.id] ?? [], 2, 6),
  } : null;
  return { status: "open", board, engagement: { code: row.code, title: row.title, clientLabel: row.client_label }, presets, proof };
}

function demoSafeBoard(dto: SharedBoardDto): SharedBoardDto {
  return { ...dto, seed: { ...dto.seed, work: publicSafeWork(dto.seed.work) } };
}

/** The same seeded layout the board draws, reduced to Home thumbnail rects. */
function seededPreview(dto: SharedBoardDto): DemoEngagementCard["preview"] {
  try {
    const model = buildSharedBoardModel(dto);
    return {
      frames: model.frames.slice(0, 12).map((f) => ({ x: f.x, y: f.y, w: f.width, h: f.height, fill: f.fill ?? null })),
      nodes: model.nodes.slice(0, 60).map((n) => ({ x: n.x, y: n.y, w: n.width, h: n.height })),
    };
  } catch {
    return { frames: [], nodes: [] };
  }
}

/**
 * Unit 2: preset rows are read only here, and only after the engagement is
 * proven to sit in the one demo org. Any other engagement gets nothing.
 */
export async function loadDemoPresets(
  db: AdminDb,
  orgId: string,
  engagementId: string,
  board: SharedBoardDto,
): Promise<DemoPreset[]> {
  const { data: eng } = await db.from("engagements").select("id, org_id").eq("id", engagementId).maybeSingle();
  if (!eng || eng.org_id !== orgId) return [];
  const { data } = await db
    .from("demo_presets")
    .select("position, question, answer, context_manifest, turn_refs, generated_at")
    .eq("engagement_id", engagementId)
    .order("position", { ascending: true });
  const workIds = new Set(board.seed.work.map((w) => w.id));
  return publicDemoPresets((data ?? []) as DemoPresetRow[], workIds);
}

/* ------------------------------------------------------------------------ */
/* Unit 4: the public demo "All AI Conversations". Built only from the demo  */
/* boards above, so every item already passed publicSafeWork and the reader. */
/* ------------------------------------------------------------------------ */

export type DemoConversationItem = { code: string; item: SharedBoardDto["seed"]["work"][number] };
export type DemoConversationsResult = {
  items: DemoConversationItem[];
  turns: SharedBoardDto["turns"];
  filePreviews: SharedBoardDto["filePreviews"];
};

export async function openDemoConversations(): Promise<DemoConversationsResult> {
  const empty: DemoConversationsResult = { items: [], turns: {}, filePreviews: {} };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const orgId = await demoOrgId(supabaseAdmin);
  if (!orgId) return empty;
  const { data: rows } = await supabaseAdmin
    .from("engagements")
    .select("id, code")
    .eq("org_id", orgId)
    .order("created_at", { ascending: true })
    .limit(12);
  const out: DemoConversationsResult = { items: [], turns: {}, filePreviews: {} };
  const seen = new Set<string>();
  for (const row of rows ?? []) {
    const dto = await demoBoard(supabaseAdmin, orgId, row.id).catch(() => null);
    if (!dto) continue;
    for (const item of dto.seed.work) {
      if (seen.has(item.id)) continue;
      if (item.type !== "ai_thread" && item.type !== "document") continue;
      seen.add(item.id);
      // Already passed publicSafeWork inside demoBoard.
      out.items.push({ code: row.code, item: { ...item, placedIn: [] } });
      if (dto.turns[item.id]) out.turns[item.id] = dto.turns[item.id]!;
      if (dto.filePreviews[item.id]) out.filePreviews[item.id] = dto.filePreviews[item.id]!;
    }
  }
  return out;
}

/** Exported for the public payload test. */
export { demoSafeBoard, seededPreview };
