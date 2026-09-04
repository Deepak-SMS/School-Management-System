"use client";

import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Reveal } from "@/features/marketing/reveal";
import { APP_NAME } from "@/config/app";

const PRICING_TIERS = [
  {
    name: "Starter",
    description: "For a single campus getting off spreadsheets.",
    price: "Contact us",
    features: ["Up to 300 students", "Admissions & student records", "Attendance & ID cards", "Email support"],
    highlighted: false,
  },
  {
    name: "Professional",
    description: "For schools running HR, fees and exams together.",
    price: "Contact us",
    features: [
      "Up to 1,500 students",
      "Everything in Starter",
      "HR, payroll & recruitment",
      "Fees, exams & timetable",
      "Priority support",
    ],
    highlighted: true,
  },
  {
    name: "Enterprise",
    description: "For multi-campus groups with their own compliance needs.",
    price: "Custom",
    features: [
      "Unlimited students & campuses",
      "Everything in Professional",
      "Role-based access across campuses",
      "Audit logs & data export",
      "Dedicated onboarding",
    ],
    highlighted: false,
  },
];

export function PricingSection() {
  return (
    <section id="pricing" className="border-t border-border bg-surface py-24">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Plans that grow with your school</h2>
          <p className="mt-3 text-muted-foreground">
            Pricing depends on student count and modules — talk to us and we&apos;ll size a plan around your school.
          </p>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {PRICING_TIERS.map((tier, i) => (
            <Reveal key={tier.name} delayMs={i * 100}>
              <div
                className={`flex h-full flex-col gap-6 rounded-2xl border p-8 ${
                  tier.highlighted
                    ? "border-primary-600 bg-background shadow-lg ring-1 ring-primary-600"
                    : "border-border-strong bg-background"
                }`}
              >
                <div>
                  {tier.highlighted && (
                    <Badge variant="primary" className="mb-3">
                      Most popular
                    </Badge>
                  )}
                  <h3 className="text-lg font-semibold text-foreground">{tier.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{tier.description}</p>
                </div>
                <p className="text-3xl font-semibold text-foreground">{tier.price}</p>
                <ul className="flex flex-1 flex-col gap-2.5 text-sm">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-accent-600" aria-hidden="true" />
                      <span className="text-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button asChild variant={tier.highlighted ? "primary" : "secondary"}>
                  <a href={`mailto:hello@classlane.app?subject=${encodeURIComponent(`${APP_NAME} demo request — ${tier.name}`)}`}>
                    Talk to sales
                  </a>
                </Button>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
