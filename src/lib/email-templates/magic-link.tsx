import * as React from 'react'

import {
  Body,
  Button,
  Container,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'

import {
  Footer,
  NotebookHead,
  Wordmark,
  button,
  card,
  container,
  h1,
  main,
  quiet,
  text,
} from './notebook'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({
  siteName,
  confirmationUrl,
}: MagicLinkEmailProps) => (
  <Html lang="en" dir="ltr">
    <NotebookHead />
    <Preview>Your sign in link for {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Wordmark />
        <Section style={card}>
          <Text style={h1}>Your sign in link</Text>
          <Text style={text}>
            Use the link below to sign in to {siteName}. It works once, and it
            expires shortly.
          </Text>
          <Button className="dm-btn" style={button} href={confirmationUrl}>
            Sign in
          </Button>
          <Text style={quiet}>
            If you did not ask for this link, you can ignore it.
          </Text>
        </Section>
        <Footer />
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail
