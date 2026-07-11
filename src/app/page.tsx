import Nav from "@/app/components/nav";
import Hero from "@/app/components/hero";
import Demo from "@/app/components/demo";
import Trust from "@/app/components/trust";
import PricingSection from "@/app/components/pricing-section";
import { FinalCta, Footer } from "@/app/components/cta-footer";

export default function HomePage() {
  return (
    <>
      <Nav />
      <Hero />
      <Demo />
      <Trust />
      <PricingSection />
      <FinalCta />
      <Footer />
    </>
  );
}
