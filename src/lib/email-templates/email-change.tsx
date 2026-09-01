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

interface EmailChangeEmailProps {
  siteName: string
  // oldEmail is the user's current address (HookData.OldEmail). For the
  // NEW-recipient half of a secure email_change fanout, `email` equals the
  // recipient (NEW), so the "from" line must render oldEmail to read
  // "from OLD to NEW" instead of "from NEW to NEW".
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName,
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="en" dir="ltr">
    <NotebookHead />
    <Preview>Confirm your new email for {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Wordmark />
        <Section style={card}>
          <Text style={h1}>Confirm your new email</Text>
          <Text style={text}>
            You asked to move your {siteName} account from{' '}
            <Link href={`mailto:${oldEmail}`} style={link}>
              {oldEmail}
            </Link>{' '}
            to{' '}
            <Link href={`mailto:${newEmail}`} style={link}>
              {newEmail}
            </Link>
            . Confirm the change and the new address becomes your sign in.
          </Text>
          <Button className="dm-btn" style={button} href={confirmationUrl}>
            Confirm the change
          </Button>
          <Text style={quiet}>
            If you did not ask for this, your address stays as it is. Reach out
            to your organization admin so they know.
          </Text>
        </Section>
        <Footer />
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail
