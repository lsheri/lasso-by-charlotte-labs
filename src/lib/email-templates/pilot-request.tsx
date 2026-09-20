import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

import type { TemplateEntry } from "./registry";

export type PilotRequestEmailProps = {
  name: string;
  firm: string;
  email: string;
  teamSize: string;
  teamSizeLabel: string;
  note?: string | undefined;
  createdAt: string;
};

function PilotRequestEmail({
  name,
  firm,
  email,
  teamSizeLabel,
  note,
  createdAt,
}: PilotRequestEmailProps) {
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{`New Lasso pilot request from ${firm}`}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={heading}>New pilot request</Heading>
          <Section>
            <Text style={line}><strong>Name:</strong> {name}</Text>
            <Text style={line}><strong>Firm:</strong> {firm}</Text>
            <Text style={line}><strong>Email:</strong> {email}</Text>
            <Text style={line}><strong>Team size:</strong> {teamSizeLabel}</Text>
            <Text style={line}><strong>Created:</strong> {createdAt}</Text>
            <Text style={line}><strong>Note:</strong> {note || "None provided"}</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export const pilotRequestTemplate = {
  component: PilotRequestEmail,
  subject: (data) => {
    const props = data as PilotRequestEmailProps;
    return `Pilot request: ${props.firm} (${props.teamSizeLabel})`;
  },
  displayName: "Pilot request",
  to: "liam@charlotte-labs.com",
  previewData: {
    name: "Alex Morgan",
    firm: "Northwind Advisory",
    email: "alex@example.com",
    teamSize: "6-15",
    teamSizeLabel: "6 to 15",
    note: "One live client engagement.",
    createdAt: "20 September 2026, 05:32 UTC",
  },
} satisfies TemplateEntry;

const body = {
  backgroundColor: "#ffffff",
  color: "#16181a",
  fontFamily: "Arial, sans-serif",
  margin: "0",
};

const container = { margin: "0 auto", maxWidth: "620px", padding: "32px 24px" };
const heading = { fontSize: "28px", fontWeight: "400", margin: "0 0 24px" };
const line = { fontSize: "14px", lineHeight: "1.6", margin: "8px 0", whiteSpace: "pre-wrap" as const };