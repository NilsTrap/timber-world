import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Use .nosync suffix locally to prevent iCloud sync, but use .next on Vercel
  distDir: process.env.VERCEL ? ".next" : ".next.nosync",
  // Important for monorepo: transpile workspace packages
  transpilePackages: [
    "@timber/ui",
    "@timber/database",
    "@timber/auth",
    "@timber/config",
    "@timber/utils",
  ],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "placehold.co",
        pathname: "/**",
      },
    ],
  },
};

export default withNextIntl(nextConfig);
