export function CanvasLabStatusLine({ loading, unavailable, empty }: { loading: boolean; unavailable: boolean; empty: boolean }) {
  if (loading) return <p className="absolute left-4 top-4 font-hand text-[16px] text-[var(--nb-mid)]">reading the engagement</p>;
  if (unavailable) return <p className="absolute left-4 top-4 text-[13px] text-muted-foreground">This workboard could not be opened.</p>;
  if (empty) return <p className="absolute left-4 top-4 font-hand text-[16px] text-[var(--nb-mid)]">nothing is on this workboard yet</p>;
  return null;
}