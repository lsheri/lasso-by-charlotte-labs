import type { DocBlock, SheetCell, Work } from '@/design/reference/work-types';
import type { WorkboardCardPreview, WorkboardFilePreview } from './workboard-card-preview.shared';
import { workToSketch } from './work-sketch';
import type { WorkItemRow } from './work-types';
import { slidesFromMap } from './workboard-file-preview';
import type { Json } from '@/integrations/supabase/types';

/** Split one preview CSV line, preserving quoted commas and escaped quotes. */
function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      cells.push(cell);
      cell = '';
    } else {
      cell += char;
    }
  }
  cells.push(cell);
  return cells;
}

function sheetCell(cell: string): SheetCell {
  const trimmed = cell.trim();
  return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(trimmed) ? Number(trimmed) : cell;
}

/** Display-only content from real preview evidence, never inferred from a label. */
export function workToBoardCard(
  item: WorkItemRow,
  chatPreview?: WorkboardCardPreview,
  filePreview?: WorkboardFilePreview,
): Work {
  const work = workToSketch(item);
  if (chatPreview?.turns && chatPreview.turns.length > 0) {
    const turns = [...chatPreview.turns].sort((a, b) => a.turnNo - b.turnNo);
    const first = chatPreview.firstUserTurn;
    if (first && !turns.some((turn) => turn.turnNo === first.turnNo)) turns.unshift(first);
    return { ...work, content: { kind: 'chat', turns: turns.map((turn) => ({
      role: ['user', 'you'].includes(turn.role.toLowerCase()) ? 'you' : 'assistant',
      text: turn.content,
    })) } };
  }

  if (filePreview?.kind === 'slide' && filePreview.pages?.length) {
    const slides = filePreview.pages
      .filter((page) => Boolean(page.title?.trim()) || (page.lines?.length ?? 0) > 0)
      .map((page) => ({ title: page.title ?? '', bullets: page.lines ?? [] }));
    if (slides.length > 0) return { ...work, content: { kind: 'deck', slides } };
  }

  const hasUsableFilePreview = Boolean(filePreview && (
    (filePreview.kind === 'slide' && filePreview.pages?.some((page) => page.title?.trim() || page.lines?.length))
    || (filePreview.kind === 'text' && filePreview.lines.some((line) => line.trim()))
    || (filePreview.kind === 'pdf' && filePreview.url)
    || ((filePreview.kind === 'html' || filePreview.kind === 'mermaid') && filePreview.html)
  ));
  const meta: unknown = item.source_meta;
  const rendition = meta && typeof meta === 'object' && !Array.isArray(meta) ? (meta as Record<string, unknown>).rendition : undefined;
  const rawSlides = rendition && typeof rendition === 'object' && !Array.isArray(rendition) ? (rendition as Record<string, unknown>).slides : undefined;
  if (item.type === 'deck' && !hasUsableFilePreview && Array.isArray(rawSlides)
    && rawSlides.every((slide) => slide && typeof slide === 'object' && !Array.isArray(slide)
      && typeof slide.title === 'string'
      && (slide.bullets === undefined || (Array.isArray(slide.bullets) && slide.bullets.every((bullet: unknown) => typeof bullet === 'string')))
      && (slide.notes === undefined || typeof slide.notes === 'string'))) {
    const slides = slidesFromMap({ slides: rawSlides } as Json)
      .map((slide) => ({ title: slide.title ?? '', bullets: slide.lines, ...(slide.notes !== null ? { notes: slide.notes } : {}) }));
    if (slides.length > 0) return { ...work, content: { kind: 'deck', slides } };
  }

  if (filePreview?.kind === 'text') {
    const lines = (filePreview.lines ?? []).filter((line) => line.trim().length > 0);
    if (item.type === 'sheet') {
      const usable = lines.filter((line) => !/^##\s*Sheet:/.test(line));
      const [header, ...rows] = usable;
      if (header !== undefined && rows.length > 0) {
        return { ...work, content: { kind: 'sheet', columns: splitCsvLine(header),
          rows: rows.map((line) => splitCsvLine(line).map(sheetCell)) } };
      }
    }
    if (item.type === 'email') {
      const header = new Map<string, string>();
      let bodyFrom = 0;
      for (let i = 0; i < lines.length && i < 8; i++) {
        const m = /^\s*(from|to|cc|sent|date|subject)\s*:\s*(.*)$/i.exec(lines[i] ?? '');
        if (!m) break;
        const name = m[1];
        if (name === undefined) break;
        header.set(name.toLowerCase(), (m[2] ?? '').trim());
        bodyFrom = i + 1;
      }
      const emailBlocks: DocBlock[] = lines.slice(bodyFrom).map((line) => /^#+/.test(line)
        ? { type: 'h2', text: line.replace(/^#+\s*/, '') }
        : { type: 'p', text: line });
      const to = (header.get('to') ?? '').split(/[;,]/).map((one) => one.trim()).filter(Boolean);
      const sent = header.get('sent') ?? header.get('date');
      return { ...work, content: { kind: 'email',
        from: header.get('from') ?? 'Unknown sender',
        to,
        subject: header.get('subject') ?? work.title,
        ...(sent ? { sent } : {}),
        blocks: emailBlocks } };
    }
    const blocks: DocBlock[] = lines.map((line) => /^#+/.test(line)
      ? { type: 'h2', text: line.replace(/^#+\s*/, '') }
      : { type: 'p', text: line });
    if (blocks.length > 0) return { ...work, content: { kind: 'doc', heading: work.title, blocks } };
  }

  // The design system's RealPreview has no pdf or html branch yet, so those two
  // kinds would fall to its honest empty state. Adding those branches is owed
  // design work in Magic Patterns, and until then the board must keep its existing
  // renderer for pdf and html rather than losing them.
  return work;
}