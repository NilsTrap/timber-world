"use client";

import { usePathname } from "next/navigation";
import { Footer } from "./Footer";
import { EuFundingBanner } from "./EuFundingBanner";

const HIDE_FOOTER_PATHS = ["/products", "/quote", "/privacy"];

export function ConditionalFooter() {
  const pathname = usePathname();

  // Check if current path should hide footer (remove locale prefix for comparison)
  const pathWithoutLocale = pathname.replace(/^\/[a-z]{2}(?:\/|$)/, "/");
  const shouldHideFooter = HIDE_FOOTER_PATHS.some(path => pathWithoutLocale.startsWith(path));

  if (shouldHideFooter) {
    return null;
  }

  // Show EU funding banner only on the homepage
  const isHomepage = pathWithoutLocale === "/";

  return (
    <>
      <Footer />
      {isHomepage && <EuFundingBanner />}
    </>
  );
}
