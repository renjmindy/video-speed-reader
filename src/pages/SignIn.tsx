import { AuthForm } from "@/components/AuthForm";
import { usePageMeta } from "@/hooks/use-page-meta";

export default function SignInPage() {
  usePageMeta({
    title: "Sign in — Video Speed Reader",
    description: "Sign in to Video Speed Reader.",
  });
  return <AuthForm mode="signin" />;
}
