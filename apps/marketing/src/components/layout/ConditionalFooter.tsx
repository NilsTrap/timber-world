"use client";

import { usePathname } from "next/navigation";
import { Footer } from "./Footer";

const HIDE_FOOTER_PATHS = ["/products", "/quote"];

export function ConditionalFooter() {
  const pathname = usePathname();

  // Check if current path should hide footer (remove locale prefix for comparison)
  const pathWithoutLocale = pathname.replace(/^\/[a-z]{2}(?:\/|$)/, "/");
  const shouldHideFooter = HIDE_FOOTER_PATHS.some(path => pathWithoutLocale.startsWith(path));

  if (shouldHideFooter) {
    return null;
  }

  return <Footer />;
}
