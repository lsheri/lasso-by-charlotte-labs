import { supabase } from "@/integrations/supabase/client";

/**
 * The one place a workboard signs a work-files object. Card previews and
 * DD1-f board images both read through it. Null when signing is refused.
 */
export async function signWorkboardFileUrl(path: string, seconds = 600): Promise<string | null> {
  const signed = await supabase.storage.from("work-files").createSignedUrl(path, seconds);
  return !signed.error && signed.data?.signedUrl ? signed.data.signedUrl : null;
}
