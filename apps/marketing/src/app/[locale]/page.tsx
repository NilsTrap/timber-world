import { setRequestLocale } from "next-intl/server";
import {
  HeroSection,
  ProductionJourneyWithErrorBoundary,
  JourneyStageNav,
} from "@/components/features/home";
import { EuFundingBanner } from "@/components/layout/EuFundingBanner";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="journey-scroll-container -mt-20 md:-mt-28 bg-charcoal">
      {/* Stage navigation - fixed on left side */}
      <JourneyStageNav />
      {/* Hero section - first snap point */}
      <div className="journey-snap-page h-screen w-full" data-hero>
        <HeroSection />
      </div>
      {/* Production Journey - 6 stages with stacking cards scroll effect */}
      <ProductionJourneyWithErrorBoundary />
      {/* EU Funding - last snap page */}
      <div className="journey-snap-page">
        <EuFundingBanner />
      </div>
    </div>
  );
}
