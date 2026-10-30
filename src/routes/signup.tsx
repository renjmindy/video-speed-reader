import { createFileRoute } from "@tanstack/react-router";
import { AuthForm } from "@/components/AuthForm";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Sign up — Video Speed Reader" },
      { name: "description", content: "Create your Video Speed Reader account." },
      { property: "og:title", content: "Sign up — Video Speed Reader" },
      { property: "og:description", content: "Create your Video Speed Reader account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <AuthForm mode="signup" />,
});
