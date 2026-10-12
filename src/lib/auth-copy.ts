/** AU-1: strings on /auth pinned by tests. */
export const AUTH_COPY = {
  continueInvite: "Continue to the invite",
  useKeyOn: (workspace: string) => `Use this key on ${workspace}`,
  signupHeading: "Create your Lasso account",
  keyInvalid: "This key link is not valid. Ask whoever sent it for a new one.",
} as const;
