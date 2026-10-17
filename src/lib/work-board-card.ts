import type { DocBlock, SheetCell, Work } from '@/design/reference/work-types';
import type { WorkboardCardPreview, WorkboardFilePreview } from './workboard-card-preview.shared';
import { workToSketch } from './work-sketch';
import type { WorkItemRow } from './work-types';

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
  if (chatPreview && chatPreview.turns.length > 0) {
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
      .filter((page) => Boolean(page.title?.trim()) || page.lines.length > 0)
      .map((page) => ({ title: page.title ?? '', bullets: page.lines }));
    if (slides.length > 0) return { ...work, content: { kind: 'deck', slides } };
  }

  if (filePreview?.kind === 'text') {
    const lines = filePreview.lines.filter((line) => line.trim().length > 0);
    if (item.type === 'sheet') {
      const usable = lines.filter((line) => !/^##\s*Sheet:/.test(line));
      const [header, ...rows] = usable;
      if (header !== undefined && rows.length > 0) {
        return { ...work, content: { kind: 'sheet', columns: splitCsvLine(header),
          rows: rows.map((line) => splitCsvLine(line).map(sheetCell)) } };
      }
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