import type { SharedBoardDto, SharedSeedWork } from "./board-share-shared";
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
  | { status: "open"; board: SharedBoardDto; engagement: { code: string; title: string; clientLabel: string | null } }
  | { status: "not_found" };

const DEMO_EXPIRY_MS = 48 * 60 * 60 * 1000;

async function demoOrgId(db: AdminDb): Promise<string | null> {
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
        preview: {
          frames: (dto?.board.frames ?? []).slice(0, 12).map((f) => ({ x: f.x, y: f.y, w: f.w, h: f.h, fill: f.fill ?? null })),
          nodes: (dto?.board.nodes ?? []).slice(0, 60).map((n) => ({ x: n.x, y: n.y, w: n.w, h: n.h })),
        },
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
  return { status: "open", board, engagement: { code: row.code, title: row.title, clientLabel: row.client_label } };
}

/**
 * The demo field allowlist. Whatever a work item carries in source_meta and
 * meta (urls, notes, storage keys, Drive and Gmail ids) never travels, nor do
 * content_ref or orig_conversation_id. Chats pushed together keep bundling
 * through an opaque per-response group key instead of the real id.
 */
export function demoSafeWork(items: readonly SharedSeedWork[]): SharedSeedWork[] {
  const groups = new Map<string, string>();
  return items.map((item) => {
    const {
      source_meta: _sourceMeta,
      meta: _meta,
      content_ref: _contentRef,
      orig_conversation_id: origId,
      ...rest
    } = item;
    let group: string | null = null;
    if (origId) {
      group = groups.get(origId) ?? `group-${groups.size + 1}`;
      groups.set(origId, group);
    }
    return { ...rest, content_ref: null, orig_conversation_id: group } as SharedSeedWork;
  });
}

function demoSafeBoard(dto: SharedBoardDto): SharedBoardDto {
  return { ...dto, seed: { ...dto.seed, work: demoSafeWork(dto.seed.work) } };
}
