import { BrandLogo, brandLabel, type BrandKey } from "@/components/connectors/BrandLogo";
import { useVendorVisible } from "@/hooks/use-vendor-display";

export function ReaderVendorMark({ brand, hue }: { brand: BrandKey; hue: string }) {
  const visible = useVendorVisible();
  if (!visible) return null;
  return <span className="flex shrink-0 items-center gap-2 border-b pb-1 text-sm text-foreground" style={{ borderColor: `var(${hue})` }}>
    <BrandLogo brand={brand} size={20} />
    <span>{brandLabel(brand)}</span>
  </span>;
}