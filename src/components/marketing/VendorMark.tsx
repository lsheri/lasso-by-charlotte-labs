/** Small brand marks for the four AI products shown in the collage. */
export type VendorKey = "chatgpt" | "claude" | "gemini" | "lovable";

export function VendorMark({ vendor, size = 16 }: { vendor: VendorKey; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", "aria-hidden": true } as const;

  if (vendor === "chatgpt") {
    return (
      <svg {...common} fill="none" stroke="var(--nb-graphite)" strokeWidth={1.4}>
        <path d="M12 3.4a3.2 3.2 0 0 1 5.6 1.2 3.2 3.2 0 0 1 2.2 4.8 3.2 3.2 0 0 1 0 5.2 3.2 3.2 0 0 1-2.2 4.8A3.2 3.2 0 0 1 12 20.6a3.2 3.2 0 0 1-5.6-1.2 3.2 3.2 0 0 1-2.2-4.8 3.2 3.2 0 0 1 0-5.2 3.2 3.2 0 0 1 2.2-4.8A3.2 3.2 0 0 1 12 3.4Z" />
        <path d="M12 8v8M8.2 9.9 12 12l3.8-2.1M8.2 14.1 12 12l3.8 2.1" />
      </svg>
    );
  }
  if (vendor === "claude") {
    return (
      <svg {...common} fill="var(--vendor-claude, #d97757)">
        <path d="M6.4 17.6 10.4 6h3.2l4 11.6h-2.6l-.9-2.7h-4l-.9 2.7H6.4Zm4.4-4.8h2.5L12 8.9l-1.2 3.9Z" />
      </svg>
    );
  }
  if (vendor === "gemini") {
    return (
      <svg {...common} fill="#1a73e8">
        <path d="M12 2c.5 5.2 4.3 9.3 10 10-5.7.7-9.5 4.8-10 10-.5-5.2-4.3-9.3-10-10 5.7-.7 9.5-4.8 10-10Z" />
      </svg>
    );
  }
  return (
    <svg {...common} fill="none" stroke="#ff6154" strokeWidth={1.8} strokeLinejoin="round">
      <path d="M12 19.5 4.8 12.6a4.3 4.3 0 0 1 6.1-6l1.1 1.1 1.1-1.1a4.3 4.3 0 0 1 6.1 6L12 19.5Z" />
    </svg>
  );
}

export function VendorLabel({ vendor, name }: { vendor: VendorKey; name: string }) {
  return (
    <div className="mb-1.5 flex items-center gap-2">
      <VendorMark vendor={vendor} />
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        {name}
      </span>
    </div>
  );
}
