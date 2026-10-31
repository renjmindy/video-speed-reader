import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Sign up — Video Speed Reader",
  description: "Create your Video Speed Reader account.",
};

export default async function SignUpPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/app");
  return <AuthForm mode="signup" />;
}
