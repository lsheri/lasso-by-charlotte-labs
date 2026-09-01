import { VendorMark, type VendorKey } from "@/components/marketing/VendorMark";

/**
 * The gap, drawn: named products feed the work on the left, drift into a
 * blurred band where the judgment, drafts and decisions become unreadable,
 * and only the finished deliverable comes out the other side.
 *
 * Motion is decorative. Under prefers-reduced-motion the marks hold still and
 * the blurred band stays, so the meaning survives without the drift.
 */

const FEEDS: Array<{ key: VendorKey | "drive" | "slack" | "email"; name: string; delay: string }> =
  [
    { key: "chatgpt", name: "ChatGPT", delay: "0s" },
    { key: "claude", name: "Claude", delay: "-1.7s" },
    { key: "gemini", name: "Gemini", delay: "-3.4s" },
    { key: "lovable", name: "Lovable", delay: "-5.1s" },
    { key: "drive", name: "Drive", delay: "-6.8s" },
    { key: "slack", name: "Slack", delay: "-8.5s" },
    { key: "email", name: "Email", delay: "-10.2s" },
  ];

const GHOSTS = [
  "the question actually asked",
  "the draft that was thrown away",
  "why this number and not that one",
  "the assumption nobody wrote down",
  "the judgment call at 4pm",
  "what the second opinion said",
];

function FeedGlyph({ item }: { item: (typeof FEEDS)[number] }) {
  if (item.key === "drive" || item.key === "slack" || item.key === "email") {
    return (
      <span
        aria-hidden
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[4px] border border-graphite/50 font-mono text-[10px] text-graphite"
      >
        {item.name.slice(0, 1)}
      </span>
    );
  }
  return <VendorMark vendor={item.key} size={22} />;
}

export function InvisibleWorkStrip() {
  return (
    <div className="nb-gap-strip relative overflow-hidden rounded-[var(--radius)] border border-rule bg-nb-white p-4">
      <p className="micro-label mb-3">WHAT GOES IN</p>

      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {FEEDS.map((item) => (
          <li
            key={item.name}
            className="nb-gap-feed flex items-center gap-2.5"
            style={{ animationDelay: item.delay }}
          >
            <FeedGlyph item={item} />
            <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
              {item.name}
            </span>
            <span className="h-px flex-1 bg-rule" />
          </li>
        ))}
      </ul>

      {/* The band where the thinking stops being readable. */}
      <div className="relative mt-5">
        <div aria-hidden className="nb-gap-blur space-y-1.5">
          {GHOSTS.map((g) => (
            <p key={g} className="font-mono text-[11px] leading-snug text-graphite">
              {g}
            </p>
          ))}
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-nb-white/70 via-nb-white/10 to-nb-white/85"
        />
      </div>

      <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
        Judgment, decisions, drafts, process
      </p>
    </div>
  );
}
