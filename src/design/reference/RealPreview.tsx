import * as React from 'react';
import { SlideFace } from './SlideFace';
import { SOURCE_LABEL } from './work-types';
import type { Work } from './work-types';

/**
 * The real work, authored at 480px wide and scaled to the card. A taller card
 * shows more of it: more slides, more of the page, more rows, more turns.
 * Nothing is drawn or invented. No content gives an honest empty state.
 *
 * PORT DEVIATION, deliberate. `fallback` is not in the design system copy.
 * The design system has no PDF or HTML branch, so a host that can render those
 * may pass its own node in place of the empty state. The opened readers render
 * PDFs and artifacts, but board cards did not: headerGutter rendered SourceMirror
 * and skipped WorkNote's file thumbnail. The board passes no fallback today.
 * Mirrored back to Magic.
 */

export const AUTHOR_WIDTH = 480;

const SANS = 'var(--font-sans)';
const MONO = 'var(--font-mono)';

const tag: React.CSSProperties = {
  margin: 0,
  fontFamily: MONO,
  fontSize: 9.5,
  fontWeight: 500,
  letterSpacing: '.06em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
};

export function RealPreview({ work, fallback }: { work: Work; fallback?: React.ReactNode }) {
  const c = work.content;
  if (!c) {
    if (fallback !== undefined && fallback !== null) return <>{fallback}</>;
    return (
      <div className="grid h-full place-items-center p-8 text-center" style={{ background: 'var(--surface-sunk)' }}>
        <p style={{ margin: 0, fontFamily: SANS, fontSize: 15, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
          {SOURCE_LABEL[work.source]} sent no preview for this. Double click to open it there.
        </p>
      </div>
    );
  }

  switch (c.kind) {
    case 'deck':
      return (
        <div className="flex flex-col gap-4 p-5" style={{ background: 'var(--surface-sunk-2)', minHeight: '100%' }}>
          {c.slides.map((s, n) => (
            <div key={n} style={{ boxShadow: 'var(--shadow-card)', alignSelf: 'center' }}>
              <SlideFace slide={s} scale={440 / 960} />
            </div>
          ))}
        </div>
      );
    case 'doc':
      return (
        <div className="px-8 pt-6" style={{ background: 'var(--neutral-60)', minHeight: '100%' }}>
          <div className="px-10 py-9" style={{ background: 'var(--surface-raised)', boxShadow: 'var(--shadow-float)', minHeight: 600 }}>
            <h3 style={{ margin: 0, fontFamily: SANS, fontSize: 20, fontWeight: 600, lineHeight: 1.25, color: 'var(--text-primary)' }}>{c.heading}</h3>
            {c.blocks.map((b, n) =>
              b.type === 'h2' ? (
                <h4 key={n} style={{ margin: '18px 0 0', fontFamily: SANS, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {b.text}
                </h4>
              ) : (
                <p key={n} style={{ margin: '10px 0 0', fontFamily: SANS, fontSize: 12.5, lineHeight: 1.6, color: 'var(--text-primary)' }}>
                  {b.text}
                </p>
              ),
            )}
          </div>
        </div>
      );
    case 'email':
      return (
        <div className="px-8 pt-6" style={{ background: 'var(--neutral-60)', minHeight: '100%' }}>
          <div className="px-10 py-9" style={{ background: 'var(--surface-raised)', boxShadow: 'var(--shadow-float)', minHeight: 600 }}>
            <h3 style={{ margin: 0, fontFamily: SANS, fontSize: 20, fontWeight: 600, lineHeight: 1.25, color: 'var(--text-primary)' }}>{c.subject}</h3>
            <dl className="mt-4 grid gap-1" style={{ gridTemplateColumns: 'auto 1fr' }}>
              <dt style={tag}>From</dt>
              <dd style={{ margin: 0, fontFamily: SANS, fontSize: 12.5, color: 'var(--text-primary)' }}>{c.from}</dd>
              <dt style={tag}>To</dt>
              <dd style={{ margin: 0, fontFamily: SANS, fontSize: 12.5, color: 'var(--text-primary)' }}>{c.to.join(', ')}</dd>
              {c.sent ? (<><dt style={tag}>Sent</dt><dd style={{ margin: 0, fontFamily: SANS, fontSize: 12.5, color: 'var(--text-primary)' }}>{c.sent}</dd></>) : null}
            </dl>
            <hr className="mt-5" style={{ border: 0, borderTop: '1px solid var(--line-pencil)' }} />
            {c.blocks.map((b, n) =>
              b.type === 'h2' ? (
                <h4 key={n} style={{ margin: '18px 0 0', fontFamily: SANS, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {b.text}
                </h4>
              ) : (
                <p key={n} style={{ margin: '10px 0 0', fontFamily: SANS, fontSize: 12.5, lineHeight: 1.6, color: 'var(--text-primary)' }}>
                  {b.text}
                </p>
              ),
            )}
          </div>
        </div>
      );
    case 'sheet':
      return (
        <div style={{ background: 'var(--surface-raised)', minHeight: '100%' }}>
          <table className="w-full border-collapse" style={{ fontFamily: SANS, fontSize: 12.5, color: 'var(--text-primary)' }}>
            <thead>
              <tr>
                <th style={{ width: 28, background: 'var(--surface-sunk)', borderRight: 'var(--border-weight) solid var(--line-hairline)', borderBottom: 'var(--border-weight) solid var(--line-hairline)' }} />
                {c.columns.map((_, n) => (
                  <th key={n} style={{ padding: '4px 0', fontWeight: 400, fontSize: 11, color: 'var(--text-muted)', background: 'var(--surface-sunk)', borderRight: 'var(--border-weight) solid var(--line-hairline)', borderBottom: 'var(--border-weight) solid var(--line-hairline)' }}>
                    {String.fromCharCode(65 + n)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[c.columns, ...c.rows].map((row, r) => (
                <tr key={r}>
                  <td style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', background: 'var(--surface-sunk)', borderRight: 'var(--border-weight) solid var(--line-hairline)', borderBottom: 'var(--border-weight) solid var(--line-hairline)' }}>{r + 1}</td>
                  {row.map((cell, n) => (
                    <td
                      key={n}
                      style={{
                        padding: '6px 8px',
                        whiteSpace: 'nowrap',
                        textAlign: typeof cell === 'number' ? 'right' : 'left',
                        fontWeight: r === 0 ? 600 : 400,
                        fontVariantNumeric: 'tabular-nums',
                        borderRight: 'var(--border-weight) solid var(--line-hairline)',
                        borderBottom: 'var(--border-weight) solid var(--line-hairline)',
                      }}
                    >
                      {typeof cell === 'number' ? cell.toLocaleString('en-US') : cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'chat':
      return (
        <div className="px-6 py-5" style={{ background: 'var(--surface-page)', minHeight: '100%' }}>
          {c.turns.map((t, n) => (
            <div key={n} style={{ marginTop: n === 0 ? 0 : 14 }}>
              <p style={tag}>{t.role === 'you' ? 'You' : SOURCE_LABEL[work.source]}</p>
              <p
                style={{
                  margin: '5px 0 0',
                  whiteSpace: 'pre-line',
                  fontFamily: SANS,
                  fontSize: 13,
                  lineHeight: 1.5,
                  color: 'var(--text-primary)',
                  ...(t.role === 'you' ? { background: 'var(--surface-sunk-2)', borderRadius: 9, padding: '9px 12px' } : {}),
                }}
              >
                {t.text}
              </p>
            </div>
          ))}
        </div>
      );
    case 'transcript':
      return (
        <div className="px-6 py-5" style={{ background: 'var(--surface-raised)', minHeight: '100%' }}>
          {c.date ? <p style={tag}>{c.date}{c.attendees ? ` · ${c.attendees.length} people` : ''}</p> : null}
          {c.notes && c.notes.length > 0 ? (
            <ul style={{ margin: '10px 0 0', paddingLeft: 18, fontFamily: SANS, fontSize: 13, lineHeight: 1.55, color: 'var(--text-primary)' }}>
              {c.notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          ) : null}
          <div style={{ marginTop: 16, paddingTop: 12, borderTop: 'var(--border-weight) solid var(--line-hairline)' }}>
            {c.turns.map((t, n) => (
              <div key={n} className="flex gap-3" style={{ marginTop: n === 0 ? 0 : 10 }}>
                <span style={{ ...tag, width: 34, flexShrink: 0, paddingTop: 2 }}>{t.at}</span>
                <p style={{ margin: 0, fontFamily: SANS, fontSize: 12.5, lineHeight: 1.5, color: 'var(--text-primary)' }}>
                  <strong style={{ fontWeight: 600 }}>{t.speaker}</strong> {t.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      );
    default:
      return null;
  }
}