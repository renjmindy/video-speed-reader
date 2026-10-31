import Link from "next/link";
import { Clock, FileCheck2, ScrollText, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { Reveal } from "@/components/Reveal";

export const metadata = {
  title: "Video Speed Reader — Transcripts in three minutes",
  description:
    "上傳影片，三分鐘內拿到逐字稿。Upload your video, get a clean transcript in three minutes.",
  openGraph: {
    title: "Video Speed Reader — Transcripts in three minutes",
    description:
      "Upload your video, get a clean transcript in three minutes.",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

const features = [
  {
    icon: ScrollText,
    title: "高準確度逐字稿",
    en: "High-accuracy transcripts",
    body: "Powered by OpenAI Whisper, with support for both Chinese and English.",
  },
  {
    icon: Clock,
    title: "三分鐘交付",
    en: "Three-minute turnaround",
    body: "Processed in the background — you get an email when it's ready.",
  },
  {
    icon: FileCheck2,
    title: "可商用授權",
    en: "Commercial-use ready",
    body: "You own the output. Use it however you like.",
  },
];

export default function Index() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <Button asChild>
            <Link href="/sign-in">Sign in / 登入</Link>
          </Button>
        </div>
      </header>

      <main className="flex-1">
        <section className="hero-glow relative overflow-hidden">
          <div className="mx-auto max-w-4xl px-4 pb-24 pt-20 text-center sm:px-6 sm:pt-28">
            <Reveal>
              <p className="mb-6 inline-block rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
                For creators, educators & engineers
              </p>
              <h1 className="text-gradient text-5xl font-extrabold tracking-tight sm:text-7xl">
                Video Speed Reader
              </h1>
            </Reveal>
            <Reveal delay={120}>
              <p className="mt-6 text-2xl font-semibold text-foreground sm:text-3xl">
                上傳影片，三分鐘內拿到逐字稿。
              </p>
              <p className="mt-3 text-lg text-muted-foreground">
                Upload your video, get a clean transcript in three minutes.
              </p>
            </Reveal>
            <Reveal delay={240} className="mt-10 flex justify-center gap-3">
              <Button asChild size="lg">
                <Link href="/sign-up">
                  Get started <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </Reveal>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-28 sm:px-6">
          <div className="grid gap-6 md:grid-cols-3">
            {features.map((f, i) => (
              <Reveal key={f.en} delay={i * 100}>
                <div className="h-full rounded-2xl border border-border bg-card p-7 transition-colors hover:border-primary/50">
                  <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-primary-glow">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-semibold text-card-foreground">
                    {f.title}{" "}
                    <span className="text-muted-foreground">({f.en})</span>
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {f.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        © 2026 Video Speed Reader
      </footer>
    </div>
  );
}
