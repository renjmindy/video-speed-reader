// Server-side Supabase client for Server Components, Route Handlers, and
// Server Actions. Reads the cookie session so the current user is known.
//
// CRITICAL: cookies() from "next/headers" is async in Next.js 15+ — awaited
// here before being passed to createServerClient. Calling it synchronously
// is a type error on Next 15+.
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/integrations/supabase/types";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env["NEXT_PUBLIC_SUPABASE_URL"]!,
    process.env["NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"]!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // When invoked from a Server Component Next.js disallows setting
          // cookies; swallow the error so the component still renders.
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // noop
          }
        },
      },
    },
  );
}
