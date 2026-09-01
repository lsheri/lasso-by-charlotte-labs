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

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="en" dir="ltr">
    <NotebookHead />
    <Preview>Confirm your email for {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Wordmark />
        <Section style={card}>
          <Text style={h1}>Confirm your email</Text>
          <Text style={text}>
            You created an account on{' '}
            <Link href={siteUrl} style={link}>
              {siteName}
            </Link>{' '}
            with{' '}
            <Link href={`mailto:${recipient}`} style={link}>
              {recipient}
            </Link>
            . Confirm the address and you can sign in and set up your
            workspace.
          </Text>
          <Button className="dm-btn" style={button} href={confirmationUrl}>
            Confirm your email
          </Button>
          <Text style={quiet}>
            If this was not you, no account is active until the address is
            confirmed, and you can ignore this note.
          </Text>
        </Section>
        <Footer />
      </Container>
    </Body>
  </Html>
)

export default SignupEmail
