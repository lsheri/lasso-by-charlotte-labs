import * as React from 'react';
import type { Slide } from './work-types';

/** One real slide, authored at 960 x 540 and scaled to fit. */
export function SlideFace({ slide, scale }: { slide: Slide; scale: number }) {
  return (
    <div style={{ width: 960 * scale, height: 540 * scale, overflow: 'hidden', position: 'relative', background: '#ffffff' }}>
      <div
        className="font-sans"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: 960,
          height: 540,
          transform: `scale(${scale})`,
          transformOrigin: '0 0',
          padding: '72px 88px',
          boxSizing: 'border-box',
          background: '#ffffff',
          color: '#202124',
        }}
      >
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 14, background: '#F4B400' }} />
        {slide.kicker ? (
          <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: '#5F6368' }}>{slide.kicker}</div>
        ) : null}
        <div style={{ marginTop: 16, fontSize: 50, fontWeight: 700, lineHeight: 1.1, maxWidth: slide.stat ? 520 : 780 }}>{slide.title}</div>
        {slide.bullets ? (
          <ul style={{ marginTop: 36, paddingLeft: 30, fontSize: 25, lineHeight: 1.55, color: '#3C4043', listStyle: 'disc', maxWidth: slide.stat ? 480 : 780 }}>
            {slide.bullets.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        ) : null}
        {slide.stat ? (
          <div style={{ position: 'absolute', right: 88, bottom: 88, textAlign: 'right' }}>
            <div style={{ fontSize: 120, fontWeight: 700, lineHeight: 1 }}>{slide.stat.value}</div>
            <div style={{ marginTop: 10, fontSize: 22, color: '#5F6368' }}>{slide.stat.label}</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}