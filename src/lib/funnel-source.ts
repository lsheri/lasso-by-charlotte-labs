export const FUNNEL_SOURCES = [
  "front_door",
  "lasso_landing",
  "ceiba",
  "edu_landing",
  "email",
  "direct",
] as const;

export type FunnelSource = (typeof FUNNEL_SOURCES)[number];

export function parseFunnelSource(value: unknown): FunnelSource | undefined {
  return typeof value === "string" && (FUNNEL_SOURCES as readonly string[]).includes(value)
    ? (value as FunnelSource)
    : undefined;
}
