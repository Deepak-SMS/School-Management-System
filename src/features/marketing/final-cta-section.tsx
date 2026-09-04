"use client";

import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/features/marketing/reveal";
import { MockDashboard } from "@/features/marketing/mock-dashboard";
import { useScrollReveal } from "@/features/marketing/hooks";
import { APP_NAME } from "@/config/app";

export function FinalCtaSection() {
  const { ref, visible } = useScrollReveal<HTMLDivElement>(0.2);

  return (
    <section className="relative overflow-hidden border-t border-border py-24">
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[420px] bg-[radial-gradient(ellipse_60%_60%_at_50%_110%,var(--color-primary-500),transparent)] opacity-[0.12]"
        aria-hidden="true"
      />
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-6 text-center">
        <Reveal className="flex flex-col items-center gap-6">
          <h2 className="text-3xl font-semibold tracking-tight text-balance text-foreground sm:text-4xl">
            Your school deserves better infrastructure.
          </h2>
          <p className="max-w-xl text-muted-foreground text-balance">
            Bring admissions, academics, attendance, fees, HR, communication and intelligence into one connected
            platform — {APP_NAME} runs it.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <a href="mailto:hello@classlane.app?subject=Classlane%20demo%20request">
                Book a Demo <ArrowRight className="size-4" />
              </a>
            </Button>
            <Button asChild variant="secondary" size="lg">
              <a href="#platform">Explore Platform</a>
            </Button>
          </div>
        </Reveal>

        <div
          ref={ref}
          className="mt-8 w-full max-w-2xl transition-all duration-1000 ease-out"
          style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(24px)" }}
        >
          <MockDashboard active={visible} />
        </div>
      </div>
    </section>
  );
}
