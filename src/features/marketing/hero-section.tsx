"use client";

import Link from "next/link";
import { ArrowRight, Cloud, Sparkles, Users2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MockDashboard } from "@/features/marketing/mock-dashboard";
import { useScrollReveal } from "@/features/marketing/hooks";

const TRUST_INDICATORS = [
  { icon: Cloud, label: "Cloud based" },
  { icon: Sparkles, label: "AI powered" },
  { icon: Users2, label: "Multi-role" },
  { icon: ShieldCheck, label: "Built for modern schools" },
];

export function HeroSection() {
  const { ref, visible } = useScrollReveal<HTMLDivElement>(0.1);

  return (
    <section ref={ref} className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[640px] bg-[radial-gradient(ellipse_60%_50%_at_50%_-10%,var(--color-primary-500),transparent)] opacity-[0.12]"
        aria-hidden="true"
      />

      <div className="mx-auto grid max-w-6xl gap-12 px-6 pb-20 pt-20 sm:pt-28 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        <div
          className="flex flex-col items-start gap-6 transition-all duration-700 ease-out"
          style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(16px)" }}
        >
          <Badge variant="primary">Built for multi-campus schools</Badge>
          <h1 className="text-4xl font-semibold tracking-tight text-balance text-foreground sm:text-5xl lg:text-[3.25rem]">
            Run your entire school from one intelligent platform.
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground text-balance">
            Admissions, academics, attendance, fees, exams, HR, transport, communication and analytics — connected in
            one school management system, not eleven spreadsheets pretending to be one.
          </p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <a href="#pricing">
                Book a Demo <ArrowRight className="size-4" />
              </a>
            </Button>
            <Button asChild variant="secondary" size="lg">
              <a href="#platform">Explore Platform</a>
            </Button>
          </div>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
            {TRUST_INDICATORS.map((item) => (
              <span key={item.label} className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <item.icon className="size-3.5 text-primary-600" /> {item.label}
              </span>
            ))}
          </div>
        </div>

        <div
          className="transition-all duration-1000 ease-out"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? "scale(1) rotate(0deg)" : "scale(0.9) rotate(1.5deg)",
            transitionDelay: "150ms",
          }}
        >
          <MockDashboard active={visible} />
        </div>
      </div>

      <p className="mx-auto -mt-8 max-w-6xl px-6 pb-16 text-center text-xs font-medium tracking-wide text-muted-foreground">
        Sign in as an existing school{" "}
        <Link href="/login" className="text-primary-600 hover:underline">
          here
        </Link>
        .
      </p>
    </section>
  );
}
