import * as React from 'react'

import {
  Body,
  Button,
  Container,
  Html,
  Link,
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
  link,
  main,
  quiet,
  text,
} from './notebook'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
  orgName?: string | undefined
}

export const InviteEmail = ({
  siteName,
  siteUrl,
  confirmationUrl,
  orgName,
}: InviteEmailProps) => (
  <Html lang="en" dir="ltr">
    <NotebookHead />
    <Preview>You are invited to {orgName || siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Wordmark />
        <Section style={card}>
          <Text style={h1}>You are invited</Text>
          <Text style={text}>
            Someone invited you to join{' '}
            <Link href={siteUrl} style={link}>
              <strong>{orgName || siteName}</strong>
            </Link>
            . Accept the invite to create your account and get started.
          </Text>
          <Button className="dm-btn" style={button} href={confirmationUrl}>
            Accept your invite
          </Button>
          <Text style={quiet}>
            If you were not expecting this, you can ignore it and nothing
            happens.
          </Text>
        </Section>
        <Footer />
      </Container>
    </Body>
  </Html>
)

export default InviteEmail
