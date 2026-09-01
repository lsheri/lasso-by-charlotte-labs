import * as React from 'react'

import { Column, Head, Img, Link, Row, Section, Text } from '@react-email/components'

/**
 * One shared visual system for every email Lasso sends. Email clients ignore
 * CSS custom properties, so the notebook palette is mirrored here as literals.
 */
export const NB = {
  paper: '#fafafa',
  card: '#ffffff',
  rule: '#e3e5e1',
  ink: '#111413',
  body: '#2f3331',
  green: '#12653d',
  muted: '#8b8f8d',
} as const

export const MONO_STACK = `'Courier New', Courier, monospace`
export const TITLE_STACK = `'Caveat', 'Segoe Script', 'Bradley Hand', cursive`
export const BODY_STACK = `Arial, Helvetica, sans-serif`

export const FOOTER_LINE = 'Sent by Lasso · lasso.charlotte-labs.com'
export const CAVEAT_HREF =
  'https://fonts.googleapis.com/css2?family=Caveat:wght@700&display=swap'

export const main = { backgroundColor: NB.paper, fontFamily: BODY_STACK }
export const container = { padding: '28px 16px', maxWidth: '540px' }
export const card = {
  backgroundColor: NB.card,
  border: `1px solid ${NB.rule}`,
  borderRadius: '8px',
  padding: '26px 24px',
}
export const h1 = {
  fontFamily: TITLE_STACK,
  fontSize: '30px',
  fontWeight: 'bold' as const,
  color: NB.ink,
  margin: '0 0 14px',
}
export const text = {
  fontFamily: BODY_STACK,
  fontSize: '14px',
  color: NB.body,
  lineHeight: '1.6',
  margin: '0 0 20px',
}
export const link = { color: 'inherit', textDecoration: 'underline' }
export const button = {
  backgroundColor: NB.green,
  color: '#ffffff',
  fontFamily: BODY_STACK,
  fontSize: '14px',
  border: `1px solid ${NB.green}`,
  borderRadius: '6px',
  padding: '12px 20px',
  textDecoration: 'none',
}
export const quiet = {
  fontFamily: BODY_STACK,
  fontSize: '12px',
  color: NB.muted,
  lineHeight: '1.6',
  margin: '22px 0 0',
}
export const footerLine = {
  fontFamily: MONO_STACK,
  fontSize: '11px',
  letterSpacing: '0.08em',
  color: NB.muted,
  margin: '18px 0 0',
}

const wordmarkBlock = {
  backgroundColor: NB.ink,
  borderRadius: '8px',
  padding: '18px 20px',
  marginBottom: '16px',
}
const wordmarkText = {
  fontFamily: MONO_STACK,
  fontSize: '20px',
  letterSpacing: '0.24em',
  color: '#ffffff',
  margin: '0',
}
const wordmarkSub = {
  fontFamily: MONO_STACK,
  fontSize: '11px',
  letterSpacing: '0.16em',
  color: '#b9bcba',
  margin: '6px 0 0',
}

// Rendered as a text child, which React may HTML-escape: keep this CSS free of >, &, and quotes.
export const darkModeCss = `
  @media (prefers-color-scheme: dark) {
    .dm-btn { background-color: #12653d !important; color: #ffffff !important; }
  }
  [data-ogsc] .dm-btn { background-color: #12653d !important; color: #ffffff !important; }
  [data-ogsb] .dm-btn { background-color: #12653d !important; color: #ffffff !important; }
`

/** Head with the handwritten title face and the dark mode rules. */
export const NotebookHead = () => (
  <Head>
    <Link rel="stylesheet" href={CAVEAT_HREF} />
    <style>{darkModeCss}</style>
  </Head>
)

/** The wordmark, drawn as styled text so no image has to load. */
export const Wordmark = () => (
  <Section style={wordmarkBlock}>
    <Text style={wordmarkText}>LASSO</Text>
    <Text style={wordmarkSub}>by Charlotte Labs</Text>
  </Section>
)

export const Footer = () => <Text style={footerLine}>{FOOTER_LINE}</Text>
