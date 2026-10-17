import type { Work, WorkKind, WorkSource } from '@/design/reference/work-types';
import { engagementDisplayTitle } from './clients';
import { displayName } from './work-item-name';
import { driveMarkKey } from './work-mark';
import { vendorFromSource } from './work-taxonomy';
import type { WorkItemRow, WorkType } from './work-types';

const BRAND_SOURCE: Partial<Record<string, WorkSource>> = {
  googleslides: 'slides',
  googledocs: 'docs',
  googlesheets: 'sheets',
  claude: 'claude',
  chatgpt: 'chatgpt',
  gemini: 'gemini',
  copilot: 'copilot',
  granola: 'granola',
  wispr: 'wispr',
};

const VENDOR_SOURCE: Partial<Record<string, WorkSource>> = {
  claude: 'claude',
  chatgpt: 'chatgpt',
  gemini: 'gemini',
  copilot: 'copilot',
  perplexity: 'perplexity',
  wispr: 'wispr',
};

const WORK_KIND: Record<WorkType, WorkKind> = {
  ai_thread: 'chat',
  document: 'doc',
  deck: 'deck',
  sheet: 'sheet',
  call: 'transcript',
  // Email, message and image have no drawing of their own and borrow one.
  // Their own drawings are recorded here as owed design work.
  email: 'doc',
  message: 'chat',
  image: 'doc',
};

function normalise(value: string | null | undefined): string | null {
  const result = value?.trim().toLowerCase();
  return result || null;
}

/**
 * Mirrors sourceVendorKey/sourceBrandKey in components/work/SourceMark.tsx
 * and brandForToolkit in components/connectors/BrandLogo.tsx without importing
 * their React component graphs. The two paths must be kept in step.
 */
function displayBrandKey(item: WorkItemRow): string {
  const direct = normalise(item.source_vendor) ?? normalise(item.source_meta?.vendor);
  let key: string | null = direct && direct !== 'other' ? direct : null;
  if (!key) {
    const source = normalise(item.source);
    if (source) {
      const prefix = ['connector:', 'mcp:', 'import:'].find((candidate) => source.startsWith(candidate));
      if (prefix) {
        const rest = source.slice(prefix.length);
        key = rest && !['push', 'other', 'mcp'].includes(rest) ? rest : null;
      } else if (!['manual', 'upload', 'mcp', 'paste'].includes(source)) {
        key = source;
      }
    }
  }
  if (!key) return item.source === 'upload' ? 'upload' : 'unknown';
  if (['googledrive', 'gdrive', 'google drive'].includes(key)) return driveMarkKey(item);

  const toolkit = key.toLowerCase().replace(/[_\s-]/g, '');
  if (toolkit.startsWith('googledrive') || toolkit === 'gdrive') return 'googledrive';
  if (toolkit.startsWith('gmail')) return 'gmail';
  if (toolkit.startsWith('onedrive')) return 'onedrive';
  if (toolkit.startsWith('sharepoint')) return 'sharepoint';
  if (toolkit.startsWith('notion')) return 'notion';
  if (toolkit.startsWith('slack')) return 'slack';
  if (toolkit.startsWith('granola')) return 'granola';
  if (toolkit.startsWith('googlecalendar')) return 'googlecalendar';
  if (toolkit.startsWith('claude') || toolkit === 'anthropic') return 'claude';
  if (toolkit.startsWith('chatgpt') || toolkit === 'openai') return 'chatgpt';
  if (toolkit.startsWith('copilot') || toolkit.startsWith('microsoftcopilot')) return 'copilot';
  if (toolkit.startsWith('gemini')) return 'gemini';
  if (toolkit.startsWith('lovable')) return 'lovable';
  return 'unknown';
}

/** Display only: never persisted to a row or emitted as an event dimension. */
export function sketchSource(item: WorkItemRow): WorkSource {
  const brand = BRAND_SOURCE[displayBrandKey(item)];
  if (brand) return brand;
  return VENDOR_SOURCE[vendorFromSource(item)] ?? 'other';
}

/** Derive a sketch face from row evidence, never fabricate viewer content. */
export function workToSketch(item: WorkItemRow): Work {
  const sourceDate = item.work_date ?? item.created_at_source;
  const dateValue = new Date(sourceDate ?? item.captured_at);
  const formattedDate = Number.isNaN(dateValue.getTime()) ? undefined : dateValue.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', timeZone: 'UTC',
  });
  const date = formattedDate === undefined ? undefined : sourceDate == null ? `Added ${formattedDate}` : formattedDate;

  // The first mapping is arbitrary: the placement query has no ordering.
  // This is a known limitation, shared with the current card's board label.
  const engagement = item.work_item_tasks?.[0]?.tasks?.engagements;
  const board = engagement ? engagementDisplayTitle(engagement) : undefined;
  const summary = item.work_item_extracts?.find((extract) => extract.summary !== null)?.summary ?? undefined;
  const url = item.meta?.web_view_link ?? item.source_meta?.url ?? item.meta?.chat_url ?? undefined;
  let prov: string | undefined;
  if (url !== undefined) {
    try {
      prov = new URL(url).hostname || undefined;
    } catch {
      // An invalid URL offers no truthful hostname.
    }
  }

  return {
    id: item.id,
    title: displayName(item),
    source: sketchSource(item),
    kind: WORK_KIND[item.type],
    onBoard: item.visibility !== 'unmapped',
    ...(date !== undefined ? { date } : {}),
    ...(board !== undefined ? { board } : {}),
    ...(summary !== undefined ? { summary } : {}),
    ...(url !== undefined ? { url } : {}),
    ...(prov !== undefined ? { prov } : {}),
    // content is deliberately absent: sketches do not read the real work.
  };
}