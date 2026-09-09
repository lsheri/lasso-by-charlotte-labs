import * as React from 'react'

import { Column, Head, Img, Link, Row, Section, Text } from '@react-email/components'

/**
 * One shared visual system for every email Lasso sends. Email clients ignore
 * CSS custom properties, so the notebook palette is mirrored here as literals.
 */
export const NB = {
  paper: '#fafaf8',
  card: '#ffffff',
  rule: '#dadad5',
  ink: '#16181a',
  body: '#2a2d2b',
  cta: '#2a2d2b',
  muted: '#9a9c98',
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
  backgroundColor: NB.cta,
  color: '#ffffff',
  fontFamily: BODY_STACK,
  fontSize: '14px',
  border: `1px solid ${NB.cta}`,
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

// Animated mascot mark hosted on the umbrella domain; referenced, not copied.
export const LASSO_MARK_URL = 'https://charlotte-labs.com/email/lasso-mark.gif'

const wordmarkBlock = { marginBottom: '16px' }
const wordmarkImgCell = { width: '44px', verticalAlign: 'middle' }
const wordmarkTextCell = { verticalAlign: 'middle', paddingLeft: '12px' }
const wordmarkText = {
  fontFamily: `Archivo, Helvetica, Arial, sans-serif`,
  fontSize: '19px',
  fontWeight: 600,
  letterSpacing: '6px',
  color: NB.ink,
  margin: '0',
}
const wordmarkSub = {
  fontFamily: `'JetBrains Mono', ${MONO_STACK}`,
  fontSize: '10px',
  letterSpacing: '3px',
  color: NB.muted,
  margin: '4px 0 0',
}

// Rendered as a text child, which React may HTML-escape: keep this CSS free of >, &, and quotes.
export const darkModeCss = `
  @media (prefers-color-scheme: dark) {
    .dm-btn { background-color: ${NB.paper} !important; color: ${NB.ink} !important; }
  }
  [data-ogsc] .dm-btn { background-color: ${NB.paper} !important; color: ${NB.ink} !important; }
  [data-ogsb] .dm-btn { background-color: ${NB.paper} !important; color: ${NB.ink} !important; }
`

/** Head with the handwritten title face and the dark mode rules. */
export const NotebookHead = () => (
  <Head>
    <Link rel="stylesheet" href={CAVEAT_HREF} />
    <style>{darkModeCss}</style>
  </Head>
)

/** Site-style lockup on the light background: mascot mark + stacked live text. */
export const Wordmark = () => (
  <Section style={wordmarkBlock}>
    <Row>
      <Column style={wordmarkImgCell}>
        <Img src={LASSO_MARK_URL} alt="Lasso" width="44" height="44" />
      </Column>
      <Column style={wordmarkTextCell}>
        <Text style={wordmarkText}>LASSO</Text>
        <Text style={wordmarkSub}>BY CHARLOTTE LABS</Text>
      </Column>
    </Row>
  </Section>
)

export const Footer = () => <Text style={footerLine}>{FOOTER_LINE}</Text>
