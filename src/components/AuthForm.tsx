"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";

export function AuthForm({ mode }: { mode: "signin" | "signup" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const isSignup = mode === "signup";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    const { data, error } = isSignup
      ? await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/app" },
        })
      : await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!data.session) {
      toast.success("Check your email to confirm your account.");
      return;
    }
    router.replace("/app");
    router.refresh();
  }

  return (
    <div className="hero-glow flex min-h-screen flex-col items-center justify-center px-4">
      <div className="mb-8">
        <Logo />
      </div>
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-5 rounded-2xl border border-border bg-card p-7"
      >
        <div>
          <h1 className="text-2xl font-bold text-card-foreground">
            {isSignup ? "Create account / 註冊" : "Sign in / 登入"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isSignup
              ? "Start turning videos into transcripts."
              : "Welcome back."}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            required
            minLength={6}
            autoComplete={isSignup ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Please wait…" : isSignup ? "Sign up" : "Sign in"}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          {isSignup ? "Already have an account? " : "No account yet? "}
          <Link
            href={isSignup ? "/sign-in" : "/sign-up"}
            className="font-medium text-primary-glow hover:underline"
          >
            {isSignup ? "Sign in" : "Sign up"}
          </Link>
        </p>
      </form>
    </div>
  );
}
