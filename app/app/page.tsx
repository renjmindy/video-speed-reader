import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { SignOutButton } from "@/components/SignOutButton";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Dashboard — Video Speed Reader",
  description: "Your Video Speed Reader dashboard.",
  robots: "noindex",
  openGraph: { title: "Dashboard — Video Speed Reader", type: "website" },
};

export default async function AppPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <SignOutButton>
            <Button variant="secondary">
              <LogOut className="mr-1 h-4 w-4" /> Sign out
            </Button>
          </SignOutButton>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
        <div className="reveal is-visible rounded-2xl border border-border bg-card p-8">
          <h1 className="break-words text-3xl font-bold text-card-foreground">
            Hi {user.email}
          </h1>
          <p className="mt-4 text-muted-foreground">
            Your dashboard is coming soon. Upload functionality will be added in
            the next milestone.
          </p>
        </div>
      </main>
    </div>
  );
}
