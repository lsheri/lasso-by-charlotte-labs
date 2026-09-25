/**
 * Product shell 1.3: the public demo entrance. No session is needed and none
 * is read. The only org these can reach is the one marked is_demo.
 */

import { createServerFn } from "@tanstack/react-start";

import type { DemoBoardResult, DemoHomeResult } from "./board-share-open.server";

export const openDemoHomeFn = createServerFn({ method: "POST" }).handler(async (): Promise<DemoHomeResult> => {
  const { openDemoHome } = await import("./board-share-open.server");
  return openDemoHome();
});

export const openDemoBoardFn = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string }) => ({
    code: typeof input?.code === "string" ? input.code.slice(0, 64) : "",
  }))
  .handler(async ({ data }): Promise<DemoBoardResult> => {
    const { openDemoBoard } = await import("./board-share-open.server");
    return openDemoBoard(data.code);
  });
