// Browser-side Supabase client. Reads NEXT_PUBLIC_SUPABASE_URL and
// NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (the browser-safe, RLS-gated key —
// formerly the "anon key") from the environment.
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/integrations/supabase/types";

export function createClient() {
  return createBrowserClient<Database>(
    process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
    process.env["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]!,
  );
}
