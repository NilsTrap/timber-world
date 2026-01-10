import Link from "next/link";
import { siteConfig } from "@/config/site";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-charcoal text-warm-cream" role="contentinfo">
      <div className="container mx-auto px-4 py-12 md:py-16">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {/* Company Info */}
          <div className="lg:col-span-2">
            <Link
              href="/"
              className="inline-block font-heading text-2xl font-semibold"
            >
              Timber International
            </Link>
            <p className="mt-4 max-w-md text-warm-cream/80">
              Premium oak panels and wood products. From forest to finished product,
              we deliver quality timber solutions for discerning professionals worldwide.
            </p>
          </div>

          {/* Navigation Links */}
          <div>
            <h3 className="font-heading text-lg font-semibold">Navigation</h3>
            <nav aria-label="Footer navigation" className="mt-4">
              <ul className="space-y-3">
                {siteConfig.navigation.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="text-warm-cream/80 transition-colors hover:text-warm-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warm-cream focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal rounded"
                    >
                      {item.name}
                    </Link>
                  </li>
                ))}
                <li>
                  <Link
                    href="/quote"
                    className="text-warm-cream/80 transition-colors hover:text-warm-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warm-cream focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal rounded"
                  >
                    Request Quote
                  </Link>
                </li>
              </ul>
            </nav>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="font-heading text-lg font-semibold">Contact</h3>
            <address className="mt-4 not-italic space-y-3 text-warm-cream/80">
              <p>Timber International</p>
              <p>
                <a
                  href="mailto:info@timber-international.com"
                  className="transition-colors hover:text-warm-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warm-cream focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal rounded"
                >
                  info@timber-international.com
                </a>
              </p>
            </address>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 border-t border-warm-cream/20 pt-8">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <p className="text-sm text-warm-cream/60">
              &copy; {currentYear} {siteConfig.name}. All rights reserved.
            </p>
            <div className="flex gap-6 text-sm text-warm-cream/60">
              <Link
                href="/privacy"
                className="transition-colors hover:text-warm-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warm-cream focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal rounded"
              >
                Privacy Policy
              </Link>
              <Link
                href="/terms"
                className="transition-colors hover:text-warm-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warm-cream focus-visible:ring-offset-2 focus-visible:ring-offset-charcoal rounded"
              >
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
