import {
  BASELINE_SURFACES,
  VIEWPORTS,
  type BaselineSurface,
  type ViewportId,
} from "../../../tests/e2e/baseline-surfaces";

/** Skins shown even before any picture exists for them. Any other skin folder found is added after. */
export const BASE_SKINS = ["lasso", "charlotte"] as const;

export type Cell = { skin: string; src: string | null };
export type Row = { surface: BaselineSurface; cells: Cell[] };
export type Band = { viewport: ViewportId; width: number; height: number; rows: Row[] };

/**
 * Lay out baseline pictures as bands (one per viewport) of rows (one per surface)
 * with one cell per skin. `pictures` maps a path ending in
 * <skin>/<viewport>/<surface>.png to its URL. A missing picture is a null cell.
 */
export function screensGrid(pictures: Record<string, string>): Band[] {
  const found = new Map<string, string>();
  const skins: string[] = [...BASE_SKINS];
  for (const [file, src] of Object.entries(pictures)) {
    const match = /([^/]+)\/([^/]+)\/([^/]+)\.png$/.exec(file);
    if (!match) continue;
    const [, skin = "", viewport = "", surface = ""] = match;
    found.set(`${skin}/${viewport}/${surface}`, src);
    if (!skins.includes(skin)) skins.push(skin);
  }
  return VIEWPORTS.map((viewport) => ({
    viewport: viewport.id,
    width: viewport.width,
    height: viewport.height,
    rows: (BASELINE_SURFACES as readonly BaselineSurface[])
      .filter((surface) => !surface.only || surface.only === viewport.id)
      .map((surface) => ({
        surface,
        cells: skins.map((skin) => ({
          skin,
          src: found.get(`${skin}/${viewport.id}/${surface.id}`) ?? null,
        })),
      })),
  }));
}
