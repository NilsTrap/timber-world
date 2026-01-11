import { setRequestLocale } from "next-intl/server";
import { HeroSection } from "@/components/features/home";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      {/* Negative margin to offset layout padding and make hero full-screen */}
      <div className="-mt-16 md:-mt-20">
        <HeroSection />
      </div>

      {/* Placeholder for content below the hero - will be expanded in future stories */}
      <section className="container mx-auto px-4 py-16">
        <p className="text-center text-muted-foreground">
          {/* Content below hero will be added in subsequent stories */}
        </p>
      </section>
    </>
  );
}
