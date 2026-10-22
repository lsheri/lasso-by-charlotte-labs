import * as React from 'react';
import { NoPreviewSketch } from './Sketch';
import type { NoPreviewReason } from '@/lib/workboard-card-preview.shared';

export const NO_PREVIEW_COPY: Record<NoPreviewReason, string> = {
  not_previewable: 'There is no preview for this kind of work.',
  no_text: 'Nothing readable could be taken from this file.',
  unreadable: 'This file could not be opened.',
  refused: 'You do not have access to the contents.',
};

const WHY = NO_PREVIEW_COPY;

export function NoPreview({ reason, contextAvailable }: { reason: NoPreviewReason; contextAvailable: boolean }) {
  return (
    <div className="absolute inset-0 flex min-h-0 flex-col items-center justify-center gap-2 px-4 text-center">
      <div className="h-[46%] w-[46%] shrink-0"><NoPreviewSketch /></div>
      <p style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: 11, lineHeight: 1.4, color: 'var(--text-secondary)' }}>{WHY[reason]}</p>
      {contextAvailable ? (
        <p style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: 10.5, lineHeight: 1.4, color: 'var(--text-muted)' }}>The work is still here and can be used as context.</p>
      ) : null}
    </div>
  );
}
