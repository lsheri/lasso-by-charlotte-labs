export type ParsedTurn = { turn_no: number; role: "user" | "assistant"; content: string };

const MARKERS: { re: RegExp; role: "user" | "assistant" }[] = [
  { re: /^(you said:|user:|human:|me:|prompt:)\s*(.*)$/i, role: "user" },
  {
    re: /^(chatgpt said:|assistant:|claude said:|claude:|gemini said:|gemini:|ai:|gpt:|response:)\s*(.*)$/i,
    role: "assistant",
  },
];

export function parseThread(raw: string): { turns: ParsedTurn[]; resolved: boolean } {
  const text = raw.replace(/\r\n/g, "\n").trim();
  const lines = text.split("\n");
  const turns: ParsedTurn[] = [];
  let current: { role: "user" | "assistant"; buf: string[] } | null = null;
  let matched = 0;

  const flush = () => {
    if (current) {
      const content = current.buf.join("\n").trim();
      if (content) turns.push({ turn_no: turns.length + 1, role: current.role, content });
    }
  };

  for (const line of lines) {
    let hit: { role: "user" | "assistant"; rest: string } | null = null;
    for (const mk of MARKERS) {
      const m = line.trim().match(mk.re);
      if (m) {
        hit = { role: mk.role, rest: m[2] ?? "" };
        break;
      }
    }
    if (hit) {
      matched++;
      flush();
      current = { role: hit.role, buf: hit.rest ? [hit.rest] : [] };
    } else if (current) {
      current.buf.push(line);
    } else {
      current = { role: "user", buf: [line] };
    }
  }
  flush();

  if (matched >= 2 && turns.length >= 2) return { turns, resolved: true };
  return { turns: [{ turn_no: 1, role: "user", content: text }], resolved: false };
}

export async function sha256(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
