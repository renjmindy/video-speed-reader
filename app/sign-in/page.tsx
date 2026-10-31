import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Sign in — Video Speed Reader",
  description: "Sign in to Video Speed Reader.",
};

export default async function SignInPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/app");
  return <AuthForm mode="signin" />;
}
