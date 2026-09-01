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

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
}: RecoveryEmailProps) => (
  <Html lang="en" dir="ltr">
    <NotebookHead />
    <Preview>Reset your password for {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Wordmark />
        <Section style={card}>
          <Text style={h1}>Reset your password</Text>
          <Text style={text}>
            Someone asked to reset the password for your {siteName} account.
            Choose a new one with the link below.
          </Text>
          <Button className="dm-btn" style={button} href={confirmationUrl}>
            Choose a new password
          </Button>
          <Text style={quiet}>
            If this was not you, your password stays as it is and you can
            ignore this note.
          </Text>
        </Section>
        <Footer />
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail
