import { createServerFn } from "@tanstack/react-start";

import type { TextConsentResult } from "@/lib/text-consent-shared";

/**
 * 19 Nov 2026: the public page at /texts stores one agreement to receive text messages. No sign-in: the person
 * agreeing is usually not a Lasso user. The handler in text-consent.server.ts limits how often it can be called,
 * checks every field again, and writes one row with the service role. It reads nothing back and never says whether
 * a number was already on file.
 */
export const recordTextConsentFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
    // Shape and size only. The rules live in checkTextConsent, which the handler runs.
    return {
      name: typeof raw["name"] === "string" ? raw["name"].slice(0, 400) : "",
      phone: typeof raw["phone"] === "string" ? raw["phone"].slice(0, 64) : "",
      agreed: raw["agreed"] === true,
      workspace: typeof raw["workspace"] === "string" ? raw["workspace"].slice(0, 64) : null,
    };
  })
  .handler(async ({ data }): Promise<TextConsentResult> =>
    (await import("./text-consent.server")).handleTextConsent(data),
  );
