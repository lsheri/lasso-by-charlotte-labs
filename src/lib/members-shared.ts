export type MemberRow = {
  id: string;
  display_name: string;
  email: string | null;
  role: string;
  created_at: string;
  deactivated_at: string | null;
};

export type InviteRow = {
  id: string;
  code: string;
  invited_role: string;
  email: string | null;
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
};

export type MembersPayload = {
  viewer_role: string;
  members: MemberRow[];
  invites: InviteRow[];
};

/** "a1b2c3d4e5f6" → "a1b2…e5f6" — enough to recognise, not enough to reuse. */
export function maskCode(code: string): string {
  if (code.length <= 8) return code;
  return `${code.slice(0, 4)}…${code.slice(-4)}`;
}
