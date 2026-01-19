import { setRequestLocale } from "next-intl/server";
import {
  HeroSection,
  ProductionJourneyWithErrorBoundary,
} from "@/components/features/home";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="-mt-16 md:-mt-20">
      {/* Hero section - sticky at z-0, first journey stage will slide over it */}
      <div className="stack-card h-screen w-full" style={{ zIndex: 0 }}>
        <HeroSection />
      </div>
      {/* Production Journey - 8 stages with stacking cards scroll effect */}
      <ProductionJourneyWithErrorBoundary />
    </div>
  );
}
