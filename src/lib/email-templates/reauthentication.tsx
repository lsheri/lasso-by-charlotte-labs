import * as React from 'react'

import {
  Body,
  Container,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'

import {
  Footer,
  MONO_STACK,
  NB,
  NotebookHead,
  Wordmark,
  card,
  container,
  h1,
  main,
  quiet,
  text,
} from './notebook'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="en" dir="ltr">
    <NotebookHead />
    <Preview>Your verification code</Preview>
    <Body style={main}>
      <Container style={container}>
        <Wordmark />
        <Section style={card}>
          <Text style={h1}>Your verification code</Text>
          <Text style={text}>
            Enter this code to confirm it is you:
          </Text>
          <Text style={codeStyle}>{token}</Text>
          <Text style={quiet}>
            The code expires shortly. If you did not ask for it, you can ignore
            this note.
          </Text>
        </Section>
        <Footer />
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const codeStyle = {
  fontFamily: MONO_STACK,
  fontSize: '24px',
  letterSpacing: '0.18em',
  fontWeight: 'bold' as const,
  color: NB.ink,
  margin: '0 0 6px',
}
