"use client";

import { useRouter } from "next/navigation";
import { cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton({ children }: { children: ReactNode }) {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/sign-in");
    router.refresh();
  }

  if (isValidElement(children)) {
    return cloneElement(children as ReactElement<{ onClick?: () => void }>, {
      onClick: signOut,
    });
  }
  return <button onClick={signOut}>{children}</button>;
}
