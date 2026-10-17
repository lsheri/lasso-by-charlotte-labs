// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { HAND_CHARACTER_ADVANCE_EM, Sketch, type SketchDetail } from '@/design/reference/Sketch';
import { sketchLabel } from '@/design/reference/work-types';

function renderedLabel(kind: 'doc' | 'deck', detail: SketchDetail, label: string) {
  const root = document.createElement('div');
  root.innerHTML = renderToStaticMarkup(<Sketch kind={kind} detail={detail} label={label} />);
  const text = root.querySelector('text');
  if (!text) throw new Error('Handwritten title required');
  const x = Number(text.getAttribute('x'));
  const fontSize = Number(text.style.fontSize.replace('px', ''));
  const page = text.parentElement?.querySelector(kind === 'deck' ? 'rect' : 'path');
  if (!page) throw new Error('Drawn page required');
  let right: number;
  if (kind === 'deck') {
    right = Number(page.getAttribute('x')) + Number(page.getAttribute('width'));
  } else {
    const geometry = page.getAttribute('d')?.match(/^M([\d.]+) [\d.]+ h([\d.]+) l([\d.]+)/);
    if (!geometry) throw new Error('Folded page geometry required');
    right = Number(geometry[1]) + Number(geometry[2]) + Number(geometry[3]);
  }
  return { label: text.textContent ?? '', fontSize, availableWidth: right - x };
}

describe('SKETCH-17 handwritten labels stay on their drawn page', () => {
  for (const kind of ['doc', 'deck'] as const) {
    for (const detail of ['compact', 'expanded'] as const) {
      it(`${kind} ${detail} clamps a long direct label within its own geometry`, () => {
        const result = renderedLabel(kind, detail, 'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW');
        expect(Array.from(result.label).length * result.fontSize * HAND_CHARACTER_ADVANCE_EM).toBeLessThanOrEqual(result.availableWidth);
        expect(result.availableWidth).toBe(kind === 'doc' ? 82 : 114);
        expect(result.label.endsWith('…')).toBe(true);
      });
      it(`${kind} ${detail} keeps the real screenshot title within its page`, () => {
        const result = renderedLabel(kind, detail, sketchLabel('Screenshot 2026-09-30 at 14.22.18'));
        expect(Array.from(result.label).length * result.fontSize * HAND_CHARACTER_ADVANCE_EM).toBeLessThanOrEqual(result.availableWidth);
        expect(result.label.endsWith('…')).toBe(true);
      });
      it(`${kind} ${detail} leaves a short title unchanged`, () => {
        const result = renderedLabel(kind, detail, sketchLabel('Plan'));
        expect(result.label).toBe('Plan');
        expect(result.label.includes('…')).toBe(false);
      });
    }
  }
  it('preserves the caller helper’s existing two-word, sixteen-character contract', () => {
    expect(sketchLabel('Screenshot 2026-09-30 at 14.22.18')).toBe('Screenshot 2026-');
    expect(sketchLabel('One two three')).toBe('One two');
  });
});