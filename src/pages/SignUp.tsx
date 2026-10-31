import { AuthForm } from "@/components/AuthForm";
import { usePageMeta } from "@/hooks/use-page-meta";

export default function SignUpPage() {
  usePageMeta({
    title: "Sign up — Video Speed Reader",
    description: "Create your Video Speed Reader account.",
  });
  return <AuthForm mode="signup" />;
}
