// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Sketch } from '@/design/reference/Sketch';

// jsdom cannot measure painted geometry, so this pins the structural invariant:
// the Sketch SVG clips everything outside its own viewBox.
describe('SK-CLIP the sketch drawing never paints outside its box', () => {
  for (const kind of ['deck', 'doc', 'chat', 'sheet', 'transcript'] as const) {
    for (const detail of ['compact', 'expanded'] as const) {
      it(`${kind} ${detail} clips to its viewBox`, () => {
        const root = document.createElement('div');
        root.innerHTML = renderToStaticMarkup(<Sketch kind={kind} detail={detail} label="Plan" />);
        const svg = root.querySelector('svg');
        if (!svg) throw new Error('Sketch svg required');
        expect(svg.getAttribute('viewBox') ?? svg.getAttribute('viewbox')).toMatch(/^\S+ \S+ \S+ \S+$/);
        expect(svg.style.overflow).toBe('hidden');
      });
    }
  }
});
