import { MarketingNavbar } from "@/features/marketing/navbar";
import { HeroSection } from "@/features/marketing/hero-section";
import { TrustSection } from "@/features/marketing/trust-section";
import { ProblemSection } from "@/features/marketing/problem-section";
import { ModulesSection } from "@/features/marketing/modules-section";
import { ShowcaseSection } from "@/features/marketing/showcase-section";
import { AiSection } from "@/features/marketing/ai-section";
import { RolesSection } from "@/features/marketing/roles-section";
import { MobileSection } from "@/features/marketing/mobile-section";
import { AnalyticsSection } from "@/features/marketing/analytics-section";
import { SecuritySection } from "@/features/marketing/security-section";
import { PricingSection } from "@/features/marketing/pricing-section";
import { TestimonialsSection } from "@/features/marketing/testimonials-section";
import { FaqSection } from "@/features/marketing/faq-section";
import { FinalCtaSection } from "@/features/marketing/final-cta-section";
import { FooterSection } from "@/features/marketing/footer-section";
import { APP_NAME } from "@/config/app";

export const metadata = {
  title: `${APP_NAME} — Run your entire school from one intelligent platform`,
  description: "Admissions, academics, attendance, fees, exams, HR, transport, communication and analytics — connected in one school management system.",
};

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-background text-foreground">
      <MarketingNavbar />
      <HeroSection />
      <TrustSection />
      <ProblemSection />
      <ModulesSection />
      <ShowcaseSection />
      <AiSection />
      <RolesSection />
      <MobileSection />
      <AnalyticsSection />
      <SecuritySection />
      <PricingSection />
      <TestimonialsSection />
      <FaqSection />
      <FinalCtaSection />
      <FooterSection />
    </div>
  );
}
